// ============================================================================
// ADMIN-API — single authenticated, allowlisted Detour Admin boundary
// ============================================================================
// Request:  { operation: AdminOperation, payload?: object }
// Response: { data, error:{code,message}|null, meta:{generatedAt,...} }
//
// `session.get` verifies active membership at aal1 so the UI can drive TOTP
// enrollment/challenge. Every other operation requires aal2. Reads are fixed
// server-side query models; writes call narrow transactional RPCs that validate
// role, transition, idempotency, and append the audit record atomically.
// ============================================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { errorEnvelope, successEnvelope } from '../_shared/apiEnvelope.ts';
import {
  ADMIN_OPERATION_RULES,
  parseAdminRequest,
  type AdminOperation,
} from '../_shared/adminContract.ts';
import { authenticateAdmin, type AdminIdentity } from '../_shared/adminAuth.ts';
import {
  AdminOperationError,
  executeReadOperation,
  requireUuid,
  type OperationContext,
  type OperationResult,
} from '../_shared/adminOperations.ts';
import { presentAdminResult } from '../_shared/adminPresentation.ts';

const MAX_BODY_BYTES = 32 * 1024;
const MUTATIONS = new Set<AdminOperation>(
  Object.entries(ADMIN_OPERATION_RULES)
    .filter(([, rule]) => rule.mutation)
    .map(([operation]) => operation as AdminOperation),
);

function requiredString(
  payload: Record<string, unknown>,
  key: string,
  options: { min?: number; max?: number } = {},
): string {
  const value = payload[key];
  const min = options.min ?? 1;
  const max = options.max ?? 2000;
  if (typeof value !== 'string' || value.trim().length < min || value.length > max) {
    throw new AdminOperationError(`invalid_${key}`, `${key} must contain ${min}-${max} characters.`);
  }
  return value.trim();
}

function optionalUuid(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  if (value === null || value === undefined || value === '') return null;
  return requireUuid(value, key);
}

function numberField(payload: Record<string, unknown>, key: string): number {
  const value = Number(payload[key]);
  if (!Number.isFinite(value)) throw new AdminOperationError(`invalid_${key}`, `${key} must be a number.`);
  return value;
}

function boolField(payload: Record<string, unknown>, key: string): boolean {
  if (typeof payload[key] !== 'boolean') throw new AdminOperationError(`invalid_${key}`, `${key} must be boolean.`);
  return payload[key] as boolean;
}

function rpcError(error: { message?: string; code?: string }): never {
  const message = error.message ?? '';
  const known = [
    'admin_forbidden', 'reason_required', 'invalid_idempotency_key', 'idempotency_key_reused',
    'sos_alert_not_found', 'invalid_sos_status', 'invalid_sos_transition',
    'resolution_notes_required', 'resolution_notes_too_long',
    'report_not_found', 'invalid_report_status', 'invalid_report_transition',
    'report_already_final', 'admin_notes_required', 'admin_notes_too_long',
    'marketing_lead_not_found', 'invalid_lead_status', 'invalid_lead_transition',
    'lead_already_final', 'conversion_link_required', 'lead_owner_not_active_admin',
    'linked_user_not_found', 'linked_booking_not_found',
    'user_not_found', 'cannot_suspend_admin_here', 'auth_user_not_found',
    'invalid_admin_role', 'owner_cannot_demote_self', 'last_owner_required',
    'platform_settings_missing', 'invalid_pricing_values',
    'matching_ready_content_deployment_required', 'booking_not_found',
    'booking_not_disputed', 'invalid_dispute_resolution',
    'payout_dispatch_not_found', 'dispatch_not_retryable', 'dispatch_is_not_refund',
    'dispatch_is_not_payout', 'invalid_dispatch_family',
  ];
  const code = known.find((candidate) => message.includes(candidate));
  if (!code) throw new AdminOperationError('command_failed', 'The command could not be completed.', 500);
  const status = code.endsWith('_not_found') || code === 'auth_user_not_found' ? 404
    : code === 'admin_forbidden' ? 403
    : code.includes('already_') || code.includes('transition') || code.includes('required')
      || code === 'idempotency_key_reused' || code === 'dispatch_not_retryable' || code === 'booking_not_disputed'
      ? 409
      : 422;
  throw new AdminOperationError(code, code.replaceAll('_', ' '), status);
}

async function invokeRpc(
  ctx: OperationContext,
  name: string,
  args: Record<string, unknown>,
): Promise<any> {
  // Dynamic dispatch is confined to this fixed switch-owned helper; operation
  // names and payloads never come directly from the request.
  const { data, error } = await (ctx.db as any).rpc(name, args);
  if (error) rpcError(error);
  return data;
}

async function hydrateIdempotentResult(
  ctx: OperationContext,
  rpc: any,
  table: string,
  select: string,
  id: string,
  always = false,
): Promise<any> {
  if (!always && !rpc?.idempotent) return rpc;
  // The four table/select pairs are fixed call sites in command() above.
  const { data, error } = await (ctx.db as any).from(table).select(select).eq('id', id).maybeSingle();
  if (error || !data) throw new AdminOperationError('data_unavailable', 'The current command result is unavailable.', 503);
  return { ...rpc, result: data };
}

async function command(
  operation: AdminOperation,
  payload: Record<string, unknown>,
  ctx: OperationContext,
): Promise<OperationResult> {
  const actor = { p_actor_id: ctx.userId, p_actor_role: ctx.role, p_request_id: ctx.requestId };
  const idempotencyKey = () => requiredString(payload, 'idempotencyKey', { min: 8, max: 128 });
  const reason = () => requiredString(payload, 'reason', { min: 3, max: 2000 });

  switch (operation) {
    case 'sos.transition': {
      const id = requireUuid(payload.id);
      const rpc = await invokeRpc(ctx, 'admin_transition_sos_tx', {
        ...actor,
        p_sos_alert_id: id,
        p_next_status: requiredString(payload, 'status', { max: 32 }),
        p_reason: reason(),
        p_resolution_notes: typeof payload.resolutionNotes === 'string' ? payload.resolutionNotes.trim() : null,
        p_idempotency_key: idempotencyKey(),
      });
      const data = await hydrateIdempotentResult(ctx, rpc, 'sos_alerts', '*', id);
      return { data };
    }
    case 'reports.transition': {
      const id = requireUuid(payload.id);
      const rpc = await invokeRpc(ctx, 'admin_transition_report_tx', {
        ...actor,
        p_report_id: id,
        p_next_status: requiredString(payload, 'status', { max: 32 }),
        p_reason: reason(),
        p_admin_notes: typeof payload.adminNotes === 'string'
          ? payload.adminNotes.trim()
          : typeof payload.resolutionNotes === 'string' ? payload.resolutionNotes.trim() : null,
        p_idempotency_key: idempotencyKey(),
      });
      const data = await hydrateIdempotentResult(ctx, rpc, 'reports', '*', id);
      return { data };
    }
    case 'disputes.resolve': {
      const id = requireUuid(payload.id);
      const rpc = await invokeRpc(ctx, 'admin_resolve_dispute_tx', {
        ...actor,
        p_booking_id: id,
        p_resolution: requiredString(payload, 'resolution', { max: 64 }),
        p_reason: reason(),
        p_idempotency_key: idempotencyKey(),
      });
      const data = await hydrateIdempotentResult(ctx, rpc, 'bookings', '*', id, true);
      return { data };
    }
    case 'leads.update': {
      const id = requireUuid(payload.id);
      const hasOwner = Object.prototype.hasOwnProperty.call(payload, 'ownerId');
      const hasUser = Object.prototype.hasOwnProperty.call(payload, 'linkedUserId');
      const hasBooking = Object.prototype.hasOwnProperty.call(payload, 'linkedBookingId');
      const rpc = await invokeRpc(ctx, 'admin_update_marketing_lead_tx', {
        ...actor,
        p_lead_id: id,
        p_next_status: requiredString(payload, 'status', { max: 32 }),
        p_owner_admin_id: optionalUuid(payload, 'ownerId'),
        p_owner_admin_id_set: hasOwner,
        p_linked_user_id: optionalUuid(payload, 'linkedUserId'),
        p_linked_user_id_set: hasUser,
        p_linked_booking_id: optionalUuid(payload, 'linkedBookingId'),
        p_linked_booking_id_set: hasBooking,
        p_reason: reason(),
        p_idempotency_key: idempotencyKey(),
      });
      const data = await hydrateIdempotentResult(ctx, rpc, 'marketing_leads', '*', id);
      return { data };
    }
    case 'users.suspension': {
      const data = await invokeRpc(ctx, 'admin_set_user_suspension_tx', {
        ...actor,
        p_user_id: requireUuid(payload.id),
        p_suspended: boolField(payload, 'suspended'),
        p_reason: reason(),
        p_idempotency_key: idempotencyKey(),
      });
      return { data };
    }
    case 'admins.membership.update': {
      const data = await invokeRpc(ctx, 'admin_upsert_membership_tx', {
        ...actor,
        p_user_id: requireUuid(payload.id),
        p_role: requiredString(payload, 'role', { max: 32 }),
        p_is_active: boolField(payload, 'active'),
        p_reason: reason(),
        p_idempotency_key: idempotencyKey(),
      });
      return { data };
    }
    case 'settings.update': {
      const data = await invokeRpc(ctx, 'admin_update_platform_settings_tx', {
        ...actor,
        p_early_access_mode: boolField(payload, 'earlyAccessMode'),
        p_platform_fee_up_rate: numberField(payload, 'platformFeeUpRate'),
        p_platform_fee_down_rate: numberField(payload, 'platformFeeDownRate'),
        p_commission_rate: numberField(payload, 'commissionRate'),
        p_gst_rate: numberField(payload, 'gstRate'),
        p_tds_rate: numberField(payload, 'tdsRate'),
        p_late_fee_paise: numberField(payload, 'lateFeePaise'),
        p_content_deployment_id: optionalUuid(payload, 'contentDeploymentId'),
        p_reason: reason(),
        p_idempotency_key: idempotencyKey(),
      });
      return { data };
    }
    case 'refunds.issue':
    case 'payouts.retry': {
      return await dispatchMoney(
        ctx,
        requireUuid(payload.id),
        operation === 'refunds.issue' ? 'refund' : 'payout',
        reason(),
        idempotencyKey(),
      );
    }
    default:
      throw new AdminOperationError('unsupported_operation', 'This command is not implemented.', 501);
  }
}

async function dispatchMoney(
  ctx: OperationContext,
  dispatchId: string,
  family: 'refund' | 'payout',
  reason: string,
  idempotencyKey: string,
): Promise<OperationResult> {
  const claim = await invokeRpc(ctx, 'admin_claim_money_dispatch_tx', {
    p_actor_id: ctx.userId,
    p_actor_role: ctx.role,
    p_dispatch_id: dispatchId,
    p_family: family,
    p_reason: reason,
    p_idempotency_key: idempotencyKey,
    p_request_id: ctx.requestId,
  });

  if (claim?.idempotent) {
    const { data, error } = await ctx.db.from('payout_dispatches')
      .select('id,booking_id,kind,net_paise,status,initiated_at,completed_at,failed_reason').eq('id', dispatchId).maybeSingle();
    if (error) throw new AdminOperationError('data_unavailable', 'Dispatch state is unavailable.', 503);
    return { data: { idempotent: true, dispatch: data } };
  }

  const baseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!baseUrl || !serviceKey) {
    throw new AdminOperationError('dispatch_service_unavailable', 'Money dispatch service is unavailable.', 503);
  }

  let response: Response | null = null;
  try {
    response = await fetch(`${baseUrl}/functions/v1/issue-refund`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ payout_dispatch_id: dispatchId }),
    });
  } catch {
    // The outcome RPC below records that the row stayed pending/failed.
  }

  const outcome = await invokeRpc(ctx, 'admin_record_money_dispatch_outcome_tx', {
    p_actor_id: ctx.userId,
    p_actor_role: ctx.role,
    p_dispatch_id: dispatchId,
    p_family: family,
    p_request_id: ctx.requestId,
    p_claim_idempotency_key: idempotencyKey,
  });

  if (!response?.ok || outcome?.result?.status === 'failed') {
    throw new AdminOperationError('dispatch_failed', 'The dispatch was audited but did not complete. Review its latest state before retrying.', 502);
  }
  return { data: { idempotent: false, dispatch: outcome.result, auditId: outcome.audit_id } };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorEnvelope('method_not_allowed', 'Use POST.', 405);
  const declaredLength = Number(req.headers.get('content-length') ?? 0);
  if (declaredLength > MAX_BODY_BYTES) return errorEnvelope('payload_too_large', 'Request body is too large.', 413);

  let raw: string;
  let body: unknown;
  try {
    raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
      return errorEnvelope('payload_too_large', 'Request body is too large.', 413);
    }
    body = JSON.parse(raw);
  } catch {
    return errorEnvelope('invalid_json', 'Request body is not valid JSON.', 400);
  }

  const parsed = parseAdminRequest(body);
  if (!parsed.ok) return errorEnvelope(parsed.code, parsed.message, 400);
  const { operation, payload = {} } = parsed.value;
  const rule = ADMIN_OPERATION_RULES[operation];
  const auth = await authenticateAdmin(req, {
    requireAal2: rule.aal2,
    allowedRoles: rule.roles,
  });
  if (!auth.ok) return errorEnvelope(auth.code, auth.message, auth.status);

  if (operation === 'session.get') {
    const identity: AdminIdentity = auth.identity;
    return successEnvelope({
      userId: identity.userId,
      email: identity.email,
      role: identity.role,
      aal: identity.aal,
      mfaRequired: identity.aal !== 'aal2',
    });
  }

  const ctx: OperationContext = {
    db: auth.db,
    userId: auth.identity.userId,
    role: auth.identity.role,
    requestId: crypto.randomUUID(),
  };

  try {
    const result = MUTATIONS.has(operation)
      ? await command(operation, payload, ctx)
      : await executeReadOperation(operation, payload, ctx);
    const presented = presentAdminResult(operation, result);
    return successEnvelope(presented.data, { meta: presented.meta });
  } catch (error) {
    if (error instanceof AdminOperationError) {
      return errorEnvelope(error.code, error.message, error.status);
    }
    console.error('[admin-api] unexpected operation failure', operation);
    return errorEnvelope('internal_error', 'The operation could not be completed.', 500);
  }
});
