// ============================================================================
// DETOUR ADMIN API CONTRACT
// ============================================================================
// The Admin SPA mirrors this contract. Keep operation names stable; adding a
// handler requires adding its role rule here first. There is deliberately no
// arbitrary table/query operation.
// ============================================================================

export const ADMIN_ROLES = ['owner', 'operations', 'finance', 'growth'] as const;
export type AdminRole = typeof ADMIN_ROLES[number];

export const ADMIN_OPERATIONS = [
  'session.get',
  'overview.get',
  'actions.list',
  'users.list',
  'users.get',
  'users.suspension',
  'bookings.list',
  'bookings.get',
  'inquiries.list',
  'live-trips.list',
  'sos.list',
  'sos.transition',
  'reports.list',
  'reports.transition',
  'disputes.list',
  'disputes.resolve',
  'leads.list',
  'leads.update',
  'finance.summary',
  'payments.list',
  'payouts.list',
  'refunds.issue',
  'payouts.retry',
  'cancellations.list',
  'content.deployments.list',
  'platform.health',
  'audit.list',
  'admins.list',
  'admins.membership.update',
  'settings.get',
  'settings.update',
  'search.global',
] as const;

export type AdminOperation = typeof ADMIN_OPERATIONS[number];

export interface AdminApiRequest {
  operation: AdminOperation;
  payload?: Record<string, unknown>;
}

export const ADMIN_OPERATION_RULES: Readonly<Record<AdminOperation, {
  roles: readonly AdminRole[];
  mutation: boolean;
  aal2: boolean;
}>> = {
  'session.get':                 { roles: ADMIN_ROLES,                  mutation: false, aal2: false },
  'overview.get':                { roles: ADMIN_ROLES,                  mutation: false, aal2: true },
  'actions.list':                { roles: ['owner', 'operations', 'finance'], mutation: false, aal2: true },
  'users.list':                  { roles: ['owner', 'operations'],      mutation: false, aal2: true },
  'users.get':                   { roles: ['owner', 'operations'],      mutation: false, aal2: true },
  'users.suspension':            { roles: ['owner', 'operations'],      mutation: true,  aal2: true },
  'bookings.list':               { roles: ['owner', 'operations', 'finance'], mutation: false, aal2: true },
  'bookings.get':                { roles: ['owner', 'operations', 'finance'], mutation: false, aal2: true },
  'inquiries.list':              { roles: ['owner', 'operations'],      mutation: false, aal2: true },
  'live-trips.list':             { roles: ['owner', 'operations'],      mutation: false, aal2: true },
  'sos.list':                    { roles: ['owner', 'operations'],      mutation: false, aal2: true },
  'sos.transition':              { roles: ['owner', 'operations'],      mutation: true,  aal2: true },
  'reports.list':                { roles: ['owner', 'operations'],      mutation: false, aal2: true },
  'reports.transition':          { roles: ['owner', 'operations'],      mutation: true,  aal2: true },
  'disputes.list':               { roles: ['owner', 'operations'],      mutation: false, aal2: true },
  'disputes.resolve':            { roles: ['owner', 'operations'],      mutation: true,  aal2: true },
  'leads.list':                  { roles: ['owner', 'operations'],      mutation: false, aal2: true },
  'leads.update':                { roles: ['owner', 'operations'],      mutation: true,  aal2: true },
  'finance.summary':             { roles: ['owner', 'finance'],         mutation: false, aal2: true },
  'payments.list':               { roles: ['owner', 'finance'],         mutation: false, aal2: true },
  'payouts.list':                { roles: ['owner', 'finance'],         mutation: false, aal2: true },
  'refunds.issue':               { roles: ['owner', 'finance'],         mutation: true,  aal2: true },
  'payouts.retry':               { roles: ['owner', 'finance'],         mutation: true,  aal2: true },
  'cancellations.list':          { roles: ['owner', 'operations', 'finance'], mutation: false, aal2: true },
  'content.deployments.list':    { roles: ['owner', 'growth'],          mutation: false, aal2: true },
  'platform.health':             { roles: ADMIN_ROLES,                  mutation: false, aal2: true },
  'audit.list':                  { roles: ['owner'],                    mutation: false, aal2: true },
  'admins.list':                 { roles: ['owner'],                    mutation: false, aal2: true },
  'admins.membership.update':    { roles: ['owner'],                    mutation: true,  aal2: true },
  'settings.get':                { roles: ['owner', 'finance', 'growth'], mutation: false, aal2: true },
  'settings.update':             { roles: ['owner', 'finance'],         mutation: true,  aal2: true },
  'search.global':               { roles: ['owner', 'operations', 'finance'], mutation: false, aal2: true },
};

export type ParseAdminRequestResult =
  | { ok: true; value: AdminApiRequest }
  | { ok: false; code: string; message: string };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseAdminRequest(value: unknown): ParseAdminRequestResult {
  if (!isObject(value)) {
    return { ok: false, code: 'invalid_request', message: 'Request body must be an object.' };
  }
  if (typeof value.operation !== 'string' || !ADMIN_OPERATIONS.includes(value.operation as AdminOperation)) {
    return { ok: false, code: 'unsupported_operation', message: 'The requested admin operation is not supported.' };
  }
  if (value.payload !== undefined && !isObject(value.payload)) {
    return { ok: false, code: 'invalid_payload', message: 'payload must be an object when provided.' };
  }
  return {
    ok: true,
    value: {
      operation: value.operation as AdminOperation,
      payload: value.payload as Record<string, unknown> | undefined,
    },
  };
}

export function operationAllowedForRole(operation: AdminOperation, role: AdminRole): boolean {
  return ADMIN_OPERATION_RULES[operation].roles.includes(role);
}

export interface ListRequest {
  cursor: number;
  pageSize: number;
  status?: string;
  query?: string;
}

export type ParseListResult =
  | { ok: true; value: ListRequest }
  | { ok: false; code: string; message: string };

export function encodeCursor(offset: number): string {
  return btoa(String(Math.max(0, Math.trunc(offset))))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

export function decodeCursor(cursor: unknown): number | null {
  if (cursor === undefined || cursor === null || cursor === '') return 0;
  if (typeof cursor !== 'string' || cursor.length > 32 || !/^[A-Za-z0-9_-]+$/.test(cursor)) return null;
  try {
    const padded = cursor.replaceAll('-', '+').replaceAll('_', '/')
      + '='.repeat((4 - cursor.length % 4) % 4);
    const value = Number(atob(padded));
    return Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000 ? value : null;
  } catch {
    return null;
  }
}

export function parseListPayload(payload: Record<string, unknown> = {}): ParseListResult {
  const cursor = decodeCursor(payload.cursor);
  if (cursor === null) return { ok: false, code: 'invalid_cursor', message: 'cursor is invalid.' };
  const pageSize = payload.pageSize === undefined ? 50 : Number(payload.pageSize);
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    return { ok: false, code: 'invalid_page_size', message: 'pageSize must be an integer from 1 to 100.' };
  }
  const status = payload.status === undefined ? undefined : String(payload.status).trim();
  const query = payload.query === undefined ? undefined : String(payload.query).trim();
  if (status && status.length > 80) return { ok: false, code: 'invalid_status', message: 'status is too long.' };
  if (query && query.length > 120) return { ok: false, code: 'invalid_query', message: 'query is too long.' };
  return { ok: true, value: { cursor, pageSize, status: status || undefined, query: query || undefined } };
}
