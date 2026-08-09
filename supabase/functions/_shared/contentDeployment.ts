export type DeploymentStatus = 'requested' | 'building' | 'ready' | 'failed' | 'cancelled';

type Result<T> = { ok: true; value: T } | { ok: false; code: string; message: string };

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= max ? trimmed : null;
}

function safeUrl(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  const candidate = text(value, 2048);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function pricingSnapshot(value: unknown): Record<string, number | boolean> | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'object' || Array.isArray(value)) return undefined;
  const row = value as Record<string, unknown>;
  const keys = [
    'earlyAccessMode', 'platformFeeUpRate', 'platformFeeDownRate', 'commissionRate',
    'gstRate', 'tdsRate', 'lateFeePaise',
  ] as const;
  if (Object.keys(row).some((key) => !keys.includes(key as typeof keys[number]))) return undefined;
  if (typeof row.earlyAccessMode !== 'boolean') return undefined;
  const result: Record<string, number | boolean> = { earlyAccessMode: row.earlyAccessMode };
  for (const key of keys.slice(1)) {
    const amount = Number(row[key]);
    if (!Number.isFinite(amount) || amount < 0 || (key !== 'lateFeePaise' && amount > 1)
      || (key === 'lateFeePaise' && (!Number.isInteger(amount) || amount > 100_000_000))) return undefined;
    result[key] = amount;
  }
  return result;
}

export interface SanityPublish {
  documentId: string;
  documentType: 'guide' | 'landingPage';
  version: string;
  title: string | null;
  path: string | null;
  updatedAt: string | null;
  pricingSnapshot?: Record<string, number | boolean>;
}

export function parseSanityPublish(value: unknown): Result<SanityPublish> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, code: 'invalid_payload', message: 'Webhook payload must be an object.' };
  }
  const row = value as Record<string, unknown>;
  const documentId = text(row._id, 256);
  const version = text(row._rev, 256);
  if (!documentId || documentId.startsWith('drafts.')) {
    return { ok: false, code: 'invalid_document_id', message: 'Only published documents are accepted.' };
  }
  if (row._type !== 'guide' && row._type !== 'landingPage') {
    return { ok: false, code: 'invalid_document_type', message: 'Document type is not publishable.' };
  }
  if (!version) return { ok: false, code: 'invalid_revision', message: 'A Sanity revision is required.' };
  const slug = typeof row.slug === 'object' && row.slug !== null
    ? text((row.slug as Record<string, unknown>).current, 160)
    : text(row.slug, 160);
  const rawPath = text(row.path, 300) ?? (slug ? `/guides/${slug}` : null);
  if (rawPath && !/^\/[a-z0-9/_-]*$/.test(rawPath)) {
    return { ok: false, code: 'invalid_path', message: 'Published path is invalid.' };
  }
  const snapshot = pricingSnapshot(row.pricingSnapshot);
  if (row.pricingSnapshot !== undefined && !snapshot) {
    return { ok: false, code: 'invalid_pricing_snapshot', message: 'Pricing snapshot is invalid.' };
  }
  const updatedAt = text(row._updatedAt, 64);
  if (updatedAt && Number.isNaN(Date.parse(updatedAt))) {
    return { ok: false, code: 'invalid_updated_at', message: 'updatedAt is invalid.' };
  }
  return {
    ok: true,
    value: {
      documentId,
      documentType: row._type,
      version,
      title: text(row.title, 200),
      path: rawPath,
      updatedAt,
      ...(snapshot ? { pricingSnapshot: snapshot } : {}),
    },
  };
}

export interface DeploymentStatusEvent {
  eventId: string;
  deploymentId: string;
  documentId: string;
  documentType: string | null;
  version: string | null;
  status: DeploymentStatus;
  previewUrl: string | null;
  productionUrl: string | null;
  providerDeploymentId: string | null;
  error: string | null;
}

export function parseDeploymentStatus(value: unknown): Result<DeploymentStatusEvent> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, code: 'invalid_payload', message: 'Status payload must be an object.' };
  }
  const row = value as Record<string, unknown>;
  const eventId = text(row.eventId, 256);
  const deploymentId = text(row.deploymentId, 64);
  const documentId = text(row.documentId, 256);
  const allowed = ['building', 'ready', 'failed', 'cancelled'];
  if (!eventId || !/^[A-Za-z0-9._:-]+$/.test(eventId)) return { ok: false, code: 'invalid_event_id', message: 'eventId is invalid.' };
  if (!deploymentId || !/^[0-9a-f-]{36}$/i.test(deploymentId)) return { ok: false, code: 'invalid_deployment_id', message: 'deploymentId is invalid.' };
  if (!documentId) return { ok: false, code: 'invalid_document_id', message: 'documentId is required.' };
  if (typeof row.status !== 'string' || !allowed.includes(row.status)) return { ok: false, code: 'invalid_status', message: 'Status is invalid.' };
  const previewUrl = safeUrl(row.previewUrl);
  const productionUrl = safeUrl(row.productionUrl);
  if ((row.previewUrl && !previewUrl) || (row.productionUrl && !productionUrl)) {
    return { ok: false, code: 'invalid_url', message: 'Deployment URLs must use HTTPS.' };
  }
  const error = text(row.error, 4000);
  if (row.status === 'failed' && !error) return { ok: false, code: 'missing_error', message: 'Failed deployments require a safe error summary.' };
  return {
    ok: true,
    value: {
      eventId,
      deploymentId,
      documentId,
      documentType: text(row.documentType, 100),
      version: text(row.version, 256),
      status: row.status as DeploymentStatus,
      previewUrl,
      productionUrl,
      providerDeploymentId: text(row.providerDeploymentId, 256),
      error,
    },
  };
}
