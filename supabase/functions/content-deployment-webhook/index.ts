import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { adminClient } from '../_shared/supabaseAdmin.ts';
import { errorEnvelope, successEnvelope } from '../_shared/apiEnvelope.ts';
import { parseDeploymentStatus, parseSanityPublish } from '../_shared/contentDeployment.ts';
import { constantTimeEqual, verifyHexHmac, verifySanitySignature } from '../_shared/secretAuth.ts';

const MAX_BODY_BYTES = 64 * 1024;

async function record(db: any, input: {
  eventId: string;
  deploymentId?: string | null;
  documentId: string;
  documentType?: string | null;
  version?: string | null;
  status: string;
  previewUrl?: string | null;
  productionUrl?: string | null;
  providerDeploymentId?: string | null;
  error?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<any> {
  const { data, error } = await db.rpc('upsert_content_deployment_event_tx', {
    p_event_id: input.eventId,
    p_deployment_id: input.deploymentId ?? null,
    p_sanity_document_id: input.documentId,
    p_sanity_document_type: input.documentType ?? null,
    p_sanity_version: input.version ?? null,
    p_status: input.status,
    p_preview_url: input.previewUrl ?? null,
    p_deployment_url: input.productionUrl ?? null,
    p_provider_deployment_id: input.providerDeploymentId ?? null,
    p_error_message: input.error ?? null,
    p_metadata: input.metadata ?? {},
  });
  if (error) throw new Error(error.message);
  return data;
}

function eventId(req: Request): string | null {
  const value = (
    req.headers.get('idempotency-key')
    ?? req.headers.get('sanity-webhook-id')
  )?.trim();
  return value && value.length >= 8 && value.length <= 256 && /^[A-Za-z0-9._:-]+$/.test(value) ? value : null;
}

function configuredStatusSecret(): string | undefined {
  const secret = Deno.env.get('CONTENT_STATUS_SECRET');
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const sanity = Deno.env.get('SANITY_WEBHOOK_SECRET') ?? Deno.env.get('CONTENT_WEBHOOK_SECRET');
  if (!secret || secret.length < 24) return undefined;
  if ((service && constantTimeEqual(secret, service)) || (sanity && constantTimeEqual(secret, sanity))) return undefined;
  return secret;
}

serve(async (req: Request) => {
  if (req.method !== 'POST') return errorEnvelope('method_not_allowed', 'Use POST.', 405);
  const declaredLength = Number(req.headers.get('content-length') ?? 0);
  if (declaredLength > MAX_BODY_BYTES) return errorEnvelope('payload_too_large', 'Webhook body is too large.', 413);
  let raw: string;
  try {
    raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return errorEnvelope('payload_too_large', 'Webhook body is too large.', 413);
  } catch {
    return errorEnvelope('invalid_body', 'Webhook body could not be read.', 400);
  }

  const sanitySecret = Deno.env.get('SANITY_WEBHOOK_SECRET') ?? Deno.env.get('CONTENT_WEBHOOK_SECRET');
  const sanitySigned = await verifySanitySignature(raw, req.headers.get('sanity-webhook-signature'), sanitySecret);
  const statusSigned = await verifyHexHmac(raw, req.headers.get('x-detour-signature'), configuredStatusSecret());
  if (!sanitySigned && !statusSigned) return errorEnvelope('invalid_signature', 'Webhook signature is invalid.', 401);

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return errorEnvelope('invalid_json', 'Webhook body is not valid JSON.', 400);
  }
  const db = adminClient();

  if (statusSigned && !sanitySigned) {
    const parsed = parseDeploymentStatus(payload);
    if (!parsed.ok) return errorEnvelope(parsed.code, parsed.message, 422);
    try {
      const value = parsed.value;
      const result = await record(db, {
        eventId: value.eventId,
        deploymentId: value.deploymentId,
        documentId: value.documentId,
        documentType: value.documentType,
        version: value.version,
        status: value.status,
        previewUrl: value.previewUrl,
        productionUrl: value.productionUrl,
        providerDeploymentId: value.providerDeploymentId,
        error: value.error,
      });
      return successEnvelope({ deploymentId: result.deployment_id, status: result.status, idempotent: Boolean(result.idempotent) });
    } catch {
      console.error('[content-deployment-webhook] status transaction failed');
      return errorEnvelope('deployment_status_failed', 'Deployment status could not be recorded.', 503);
    }
  }

  const deliveryId = eventId(req);
  if (!deliveryId) return errorEnvelope('invalid_idempotency_key', 'Sanity idempotency-key is required.', 422);
  const parsed = parseSanityPublish(payload);
  if (!parsed.ok) return errorEnvelope(parsed.code, parsed.message, 422);
  const value = parsed.value;
  let requested: any;
  try {
    requested = await record(db, {
      eventId: deliveryId,
      documentId: value.documentId,
      documentType: value.documentType,
      version: value.version,
      status: 'requested',
      metadata: {
        ...(value.title ? { documentTitle: value.title } : {}),
        ...(value.path ? { path: value.path } : {}),
        ...(value.updatedAt ? { contentUpdatedAt: value.updatedAt } : {}),
        ...(value.pricingSnapshot ? { pricingSnapshot: value.pricingSnapshot } : {}),
      },
    });
  } catch {
    console.error('[content-deployment-webhook] publish transaction failed');
    return errorEnvelope('deployment_record_failed', 'Publish could not be recorded.', 503);
  }
  const deploymentId = requested.deployment_id as string;
  if (requested.idempotent) {
    return successEnvelope({ deploymentId, status: requested.status, idempotent: true });
  }

  const hook = Deno.env.get('VERCEL_DEPLOY_HOOK_URL');
  let hookUrl: URL | null = null;
  try {
    hookUrl = hook ? new URL(hook) : null;
    if (hookUrl?.protocol !== 'https:') hookUrl = null;
  } catch {
    hookUrl = null;
  }
  if (!hookUrl) {
    await record(db, {
      eventId: `${deliveryId.slice(0, 240)}:relay`, deploymentId,
      documentId: value.documentId, documentType: value.documentType, version: value.version,
      status: 'failed', error: 'vercel_deploy_hook_unconfigured',
    }).catch(() => undefined);
    return errorEnvelope('deploy_hook_unconfigured', 'Publishing is recorded, but the deploy hook is not configured.', 503);
  }

  let response: Response;
  try {
    response = await fetch(hookUrl, { method: 'POST' });
  } catch {
    response = new Response(null, { status: 502 });
  }
  if (!response.ok) {
    await record(db, {
      eventId: `${deliveryId.slice(0, 240)}:relay`, deploymentId,
      documentId: value.documentId, documentType: value.documentType, version: value.version,
      status: 'failed', error: `vercel_deploy_hook_failed_${response.status}`,
    }).catch(() => undefined);
    return errorEnvelope('deploy_hook_failed', 'Vercel did not accept the deployment request.', 502);
  }

  let providerDeploymentId: string | null = null;
  try {
    const body = await response.json() as Record<string, any>;
    providerDeploymentId = typeof body.id === 'string' ? body.id
      : typeof body.job?.id === 'string' ? body.job.id : null;
  } catch {
    // Vercel may respond without JSON; the accepted state remains canonical.
  }
  try {
    await record(db, {
      eventId: `${deliveryId.slice(0, 240)}:relay`, deploymentId,
      documentId: value.documentId, documentType: value.documentType, version: value.version,
      status: 'building', providerDeploymentId,
    });
  } catch {
    return successEnvelope(
      { deploymentId, status: 'requested', idempotent: false },
      { status: 202, meta: { warnings: ['deployment_accepted_status_update_failed'] } },
    );
  }
  return successEnvelope({ deploymentId, status: 'building', idempotent: false }, { status: 202 });
});
