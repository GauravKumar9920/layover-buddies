// Vercel deployment webhook payloads → Detour content-deployment statuses.
//
// This is the missing half of the publishing loop documented in
// `apps/studio/docs/publishing.md`: `content-deployment-webhook` relays a Sanity
// publish to a Vercel deploy hook and records `building`, but nothing told us
// whether the build ever landed. Vercel's project webhook does, so we translate
// it here rather than trusting the site to report on itself.

import type { DeploymentStatus } from './contentDeployment.ts';

type Result<T> = { ok: true; value: T } | { ok: false; code: string; message: string };

/**
 * Vercel emits more event types than we model. Anything absent from this map is
 * acknowledged and ignored, so enabling extra triggers in the Vercel UI can
 * never push a deployment into a wrong state.
 */
const STATUS_BY_EVENT: Record<string, DeploymentStatus> = {
  'deployment.created': 'building',
  'deployment.succeeded': 'ready',
  'deployment.ready': 'ready',
  'deployment.promoted': 'ready',
  'deployment.error': 'failed',
  'deployment.canceled': 'cancelled',
  'deployment.cancelled': 'cancelled',
};

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= max ? trimmed : null;
}

/** Vercel reports `deployment.url` as a bare host, never a full URL. */
function deploymentUrl(value: unknown): string | null {
  const host = text(value, 2000);
  if (!host) return null;
  const candidate = /^https?:\/\//i.test(host) ? host : `https://${host}`;
  try {
    const url = new URL(candidate);
    return url.protocol === 'https:' && url.hostname.includes('.') ? url.toString() : null;
  } catch {
    return null;
  }
}

export interface VercelDeploymentEvent {
  /** Vercel's own delivery id, namespaced so it cannot collide with a Sanity one. */
  eventId: string;
  eventType: string;
  status: DeploymentStatus;
  providerDeploymentId: string;
  projectId: string | null;
  target: string | null;
  deploymentUrl: string | null;
  /** A short, non-sensitive summary. Vercel does not send build logs here. */
  error: string | null;
}

export function parseVercelDeploymentEvent(value: unknown): Result<VercelDeploymentEvent> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, code: 'invalid_payload', message: 'Vercel payload must be an object.' };
  }
  const row = value as Record<string, unknown>;
  const eventType = text(row.type, 100);
  if (!eventType) return { ok: false, code: 'invalid_event_type', message: 'Event type is required.' };

  const deliveryId = text(row.id, 200);
  if (!deliveryId || !/^[A-Za-z0-9._:-]+$/.test(deliveryId)) {
    return { ok: false, code: 'invalid_event_id', message: 'Vercel delivery id is invalid.' };
  }

  const payload = (row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload))
    ? row.payload as Record<string, unknown>
    : null;
  if (!payload) return { ok: false, code: 'invalid_payload', message: 'Vercel payload body is missing.' };

  const deployment = (payload.deployment && typeof payload.deployment === 'object' && !Array.isArray(payload.deployment))
    ? payload.deployment as Record<string, unknown>
    : null;
  const providerDeploymentId = text(deployment?.id, 200) ?? text(payload.deploymentId, 200);
  if (!providerDeploymentId || !/^[A-Za-z0-9._-]+$/.test(providerDeploymentId)) {
    return { ok: false, code: 'invalid_deployment_id', message: 'Vercel deployment id is invalid.' };
  }

  const project = (payload.project && typeof payload.project === 'object' && !Array.isArray(payload.project))
    ? payload.project as Record<string, unknown>
    : null;

  const status = STATUS_BY_EVENT[eventType];
  if (!status) {
    return { ok: false, code: 'ignored_event_type', message: `Event ${eventType} is not tracked.` };
  }

  return {
    ok: true,
    value: {
      eventId: `vercel:${deliveryId}`,
      eventType,
      status,
      providerDeploymentId,
      projectId: text(project?.id, 200),
      target: text(payload.target, 50),
      deploymentUrl: deploymentUrl(deployment?.url),
      // `failed` rows require a summary, and Vercel's payload carries no safe
      // build output — the event name is the most we can honestly report.
      error: status === 'failed' ? `vercel_${eventType.replace(/[^a-z0-9_.]/gi, '_')}` : null,
    },
  };
}
