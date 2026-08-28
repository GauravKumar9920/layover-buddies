import { getSupabase } from '@/lib/supabase';
import type {
  ApiEnvelope,
  ApiMeta,
  GrowthReportData,
  GrowthReportRequest,
  OperationInput,
  OperationName,
  OperationOutput,
} from '@/types/admin';

const ADMIN_API = 'admin-api';
const GROWTH_API = 'admin-growth-report';

export class AdminApiError extends Error {
  readonly code: string;
  readonly meta?: ApiMeta;

  constructor(code: string, message: string, meta?: ApiMeta) {
    super(message);
    this.name = 'AdminApiError';
    this.code = code;
    this.meta = meta;
  }
}

function unwrap<T>(envelope: ApiEnvelope<T> | null, fallback: string): { data: T; meta: ApiMeta } {
  if (!envelope) throw new AdminApiError('EMPTY_RESPONSE', fallback);
  if (envelope.error) {
    throw new AdminApiError(envelope.error.code, envelope.error.message, envelope.meta);
  }
  if (envelope.data === null || envelope.data === undefined) {
    throw new AdminApiError('EMPTY_DATA', fallback, envelope.meta);
  }
  return { data: envelope.data, meta: envelope.meta ?? {} };
}

async function translateFunctionError(error: unknown): Promise<AdminApiError> {
  const context = (error as { context?: unknown } | null)?.context;
  if (context instanceof Response) {
    try {
      const envelope = await context.clone().json() as ApiEnvelope<unknown>;
      if (envelope?.error?.code && envelope.error.message) {
        return new AdminApiError(envelope.error.code, envelope.error.message, envelope.meta);
      }
    } catch {
      // The platform may return an empty/non-JSON gateway response. Fall back
      // to the transport message while keeping the console fail-closed.
    }
  }
  return new AdminApiError('FUNCTION_UNAVAILABLE', error instanceof Error ? error.message : 'The server function is unavailable.');
}

export async function adminRequest<K extends OperationName>(
  operation: K,
  ...args: OperationInput<K> extends undefined ? [] : [payload: OperationInput<K>]
): Promise<{ data: OperationOutput<K>; meta: ApiMeta }> {
  const payload = args[0];
  const { data, error } = await getSupabase().functions.invoke<ApiEnvelope<OperationOutput<K>>>(ADMIN_API, {
    body: payload === undefined ? { operation } : { operation, payload },
  });
  if (error) throw await translateFunctionError(error);
  return unwrap(data, `${operation} returned no data.`);
}

export async function growthRequest(
  request: GrowthReportRequest,
): Promise<{ data: GrowthReportData; meta: ApiMeta }> {
  const { data, error } = await getSupabase().functions.invoke<ApiEnvelope<GrowthReportData>>(GROWTH_API, {
    body: request,
  });
  if (error) throw await translateFunctionError(error);
  return unwrap(data, `${request.report} report returned no data.`);
}

export function errorMessage(error: unknown): string {
  if (error instanceof AdminApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'The request failed. Try again or inspect platform health.';
}

export function idempotencyKey(scope: string, id: string): string {
  const random = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `admin:${scope}:${id}:${random}`;
}
