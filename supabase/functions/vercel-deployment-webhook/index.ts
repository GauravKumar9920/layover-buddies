// Vercel project webhook → content deployment completion.
//
// This closes the publishing loop: `content-deployment-webhook` records a
// publish and fires the Vercel deploy hook, and this endpoint records whether
// the resulting build actually landed. Without it a publish stays `building`
// forever, which Admin reports honestly but which never becomes a success.
//
// Authentication is Vercel's raw-body HMAC-SHA1 signature. No JWT is involved,
// so `verify_jwt` is disabled for this function in `supabase/config.toml`.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { adminClient } from '../_shared/supabaseAdmin.ts';
import { errorEnvelope, successEnvelope } from '../_shared/apiEnvelope.ts';
import { parseVercelDeploymentEvent } from '../_shared/vercelDeployment.ts';
import { verifyVercelSignature } from '../_shared/secretAuth.ts';

const MAX_BODY_BYTES = 64 * 1024;

serve(async (req: Request) => {
  if (req.method !== 'POST') return errorEnvelope('method_not_allowed', 'Use POST.', 405);

  const declaredLength = Number(req.headers.get('content-length') ?? 0);
  if (declaredLength > MAX_BODY_BYTES) return errorEnvelope('payload_too_large', 'Webhook body is too large.', 413);

  let raw: string;
  try {
    raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
      return errorEnvelope('payload_too_large', 'Webhook body is too large.', 413);
    }
  } catch {
    return errorEnvelope('invalid_body', 'Webhook body could not be read.', 400);
  }

  const secret = Deno.env.get('VERCEL_WEBHOOK_SECRET');
  const signed = await verifyVercelSignature(raw, req.headers.get('x-vercel-signature'), secret);
  if (!signed) return errorEnvelope('invalid_signature', 'Webhook signature is invalid.', 401);

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return errorEnvelope('invalid_json', 'Webhook body is not valid JSON.', 400);
  }

  const parsed = parseVercelDeploymentEvent(payload);
  if (!parsed.ok) {
    // An untracked event type is a successful no-op, not a delivery failure —
    // returning non-2xx would make Vercel retry something we will never accept.
    if (parsed.code === 'ignored_event_type') {
      return successEnvelope({ ignored: true, reason: parsed.code });
    }
    return errorEnvelope(parsed.code, parsed.message, 422);
  }
  const event = parsed.value;

  // Scope to the marketing project and its production target when configured,
  // so a preview build or a second Vercel project cannot resolve a publish.
  const expectedProject = Deno.env.get('VERCEL_MARKETING_PROJECT_ID');
  if (expectedProject && event.projectId && event.projectId !== expectedProject) {
    return successEnvelope({ ignored: true, reason: 'other_project' });
  }
  if (event.target && event.target !== 'production') {
    return successEnvelope({ ignored: true, reason: 'non_production_target' });
  }

  const db = adminClient();

  let resolved: Record<string, unknown>;
  try {
    const { data, error } = await db.rpc('resolve_content_deployment_for_vercel', {
      p_provider_deployment_id: event.providerDeploymentId,
    });
    if (error) throw new Error(error.message);
    resolved = data as Record<string, unknown>;
  } catch {
    console.error('[vercel-deployment-webhook] correlation lookup failed');
    return errorEnvelope('correlation_failed', 'Deployment could not be correlated.', 503);
  }

  if (!resolved?.found) {
    // Vercel deploys for reasons other than a Sanity publish — a git push, a
    // manual redeploy. Those have no publish to update, and that is fine.
    return successEnvelope({ ignored: true, reason: 'no_pending_publish' });
  }

  try {
    const { data, error } = await db.rpc('upsert_content_deployment_event_tx', {
      p_event_id: event.eventId,
      p_deployment_id: resolved.deployment_id,
      p_sanity_document_id: resolved.sanity_document_id,
      p_sanity_document_type: resolved.sanity_document_type ?? null,
      p_sanity_version: resolved.sanity_version ?? null,
      p_status: event.status,
      p_preview_url: null,
      p_deployment_url: event.deploymentUrl,
      p_provider_deployment_id: event.providerDeploymentId,
      p_error_message: event.error,
      p_metadata: { vercelEventType: event.eventType },
    });
    if (error) throw new Error(error.message);
    const result = data as Record<string, unknown>;
    return successEnvelope({
      deploymentId: result.deployment_id,
      status: result.status,
      idempotent: Boolean(result.idempotent),
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : '';
    // The row already reached a terminal state — a late or duplicate delivery.
    // Acknowledge it so Vercel stops retrying a decided deployment.
    if (message.includes('deployment_already_final')) {
      return successEnvelope({ ignored: true, reason: 'already_final' });
    }
    console.error('[vercel-deployment-webhook] status transaction failed');
    return errorEnvelope('deployment_status_failed', 'Deployment status could not be recorded.', 503);
  }
});
