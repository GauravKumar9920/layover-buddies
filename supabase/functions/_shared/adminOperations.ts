import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import type { Database } from './database.types.ts';
import {
  encodeCursor,
  parseListPayload,
  type AdminOperation,
  type AdminRole,
} from './adminContract.ts';

export class AdminOperationError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export interface OperationContext {
  db: SupabaseClient<Database>;
  userId: string;
  role: AdminRole;
  requestId: string;
}

export interface OperationResult {
  data: unknown;
  meta?: { nextCursor?: string; warnings?: string[]; [key: string]: unknown };
}

type DbResult = { data: any; error: { message: string; code?: string } | null; count?: number | null };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIVE_BOOKING_STATUSES = [
  'pending', 'guide_accepted', 'confirmed', 'chat_open', 'agreement_drafting',
  'agreement_sent', 'agreement_signed_traveler', 'agreement_signed_buddy',
  'awaiting_deposits', 'deposits_held', 'awaiting_balance', 'late_fee_due',
  'balance_paid', 'trip_ready', 'in_progress', 'awaiting_proofs', 'reconciling',
];
const INQUIRY_STATUSES = ['chat_open', 'agreement_drafting', 'agreement_sent'];
const CANCELLED_STATUSES = [
  'cancelled', 'cancelled_no_pay', 'cancelled_traveler_voluntary',
  'cancelled_buddy', 'cancelled_force_majeure', 'cancelled_pre_signing',
  'cancelled_no_deposit',
];
const ALL_BOOKING_STATUSES = new Set([
  ...ACTIVE_BOOKING_STATUSES, ...CANCELLED_STATUSES,
  'completed', 'rated', 'disputed',
]);

function uuid(value: unknown, field = 'id'): string {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    throw new AdminOperationError(`invalid_${field}`, `${field} must be a UUID.`);
  }
  return value;
}

function cleanSearch(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const cleaned = value.replace(/[^a-z0-9 @.+-]/gi, ' ').replace(/\s+/g, ' ').trim();
  return cleaned || undefined;
}

function listInput(payload: Record<string, unknown>) {
  const parsed = parseListPayload(payload);
  if (!parsed.ok) throw new AdminOperationError(parsed.code, parsed.message);
  return { ...parsed.value, query: cleanSearch(parsed.value.query) };
}

function pageResult(result: DbResult, offset: number, pageSize: number): OperationResult {
  if (result.error) throw new AdminOperationError('data_unavailable', 'Requested data is unavailable.', 503);
  const items = result.data ?? [];
  return {
    data: { items, total: result.count ?? null },
    meta: {
      nextCursor: items.length === pageSize ? encodeCursor(offset + pageSize) : undefined,
    },
  };
}

function bookingStatuses(filter?: string): string[] | null {
  if (!filter || filter === 'all') return null;
  if (filter === 'active') return ACTIVE_BOOKING_STATUSES;
  if (filter === 'inquiry') return INQUIRY_STATUSES;
  if (filter === 'cancelled') return CANCELLED_STATUSES;
  if (!ALL_BOOKING_STATUSES.has(filter)) {
    throw new AdminOperationError('invalid_status', 'Unknown booking status filter.');
  }
  return [filter];
}

async function overview(ctx: OperationContext): Promise<OperationResult> {
  // Mumbai operational day expressed as UTC bounds (IST is UTC+05:30 and has
  // no DST). Using UTC midnight misclassifies trips between 00:00–05:29 IST.
  const istOffsetMs = 330 * 60_000;
  const istNow = new Date(Date.now() + istOffsetMs);
  const dayStart = new Date(Date.UTC(
    istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate(),
  ) - istOffsetMs);
  const dayEnd = new Date(dayStart.getTime() + 86400_000);

  const [travelers, guides, openInquiries, activeTrips, completed, leads, qualifiedLeads, bookingsTotal, reviews, todayTrips] = await Promise.all([
    ctx.db.from('users').select('id', { count: 'exact', head: true }).eq('role', 'traveler'),
    ctx.db.from('users').select('id', { count: 'exact', head: true }).eq('role', 'guide'),
    ctx.db.from('bookings').select('id', { count: 'exact', head: true }).in('status', INQUIRY_STATUSES),
    ctx.db.from('bookings').select('id', { count: 'exact', head: true }).in('status', ['trip_ready', 'in_progress']),
    ctx.db.from('bookings').select('id', { count: 'exact', head: true }).in('status', ['completed', 'rated']),
    ctx.db.from('marketing_leads').select('id', { count: 'exact', head: true }),
    ctx.db.from('marketing_leads').select('id', { count: 'exact', head: true }).in('status', ['qualified', 'converted']),
    ctx.db.from('bookings').select('id', { count: 'exact', head: true }),
    ctx.db.from('reviews').select('id', { count: 'exact', head: true }),
    ctx.db.from('bookings')
      .select('id,status,payment_status,total_amount,tour_start_time,created_at,traveler:users!traveler_id(id,full_name),guide:users!guide_id(id,full_name)')
      .gte('tour_start_time', dayStart.toISOString()).lt('tour_start_time', dayEnd.toISOString())
      .order('tour_start_time', { ascending: true }).limit(25),
  ]) as DbResult[];

  const all = [travelers, guides, openInquiries, activeTrips, completed, leads, qualifiedLeads, bookingsTotal, reviews, todayTrips];
  if (all.some((result) => result.error)) {
    throw new AdminOperationError('overview_unavailable', 'Marketplace overview data is unavailable.', 503);
  }
  const value = (result: DbResult) => result.count ?? 0;
  return {
    data: {
      metrics: {
        travelers: value(travelers),
        buddies: value(guides),
        openInquiries: value(openInquiries),
        activeTrips: value(activeTrips),
        completedTrips: value(completed),
        websiteLeads: value(leads),
      },
      funnel: [
        { label: 'Website leads', value: value(leads) },
        { label: 'Qualified leads', value: value(qualifiedLeads) },
        { label: 'Bookings', value: value(bookingsTotal) },
        { label: 'Completed trips', value: value(completed) },
        { label: 'Reviews', value: value(reviews) },
      ],
      todayTrips: todayTrips.data ?? [],
    },
  };
}

interface ActionItem {
  id: string;
  kind: string;
  severity: 'critical' | 'high' | 'medium';
  title: string;
  targetType: string;
  targetId: string;
  ownerId: string | null;
  createdAt: string;
  ageMinutes: number;
  slaMinutes: number;
  overdue: boolean;
  nextAction: string;
}

function action(
  kind: string,
  row: Record<string, any>,
  options: Pick<ActionItem, 'severity' | 'title' | 'targetType' | 'slaMinutes' | 'nextAction'>
    & { timestamp: string; ownerId?: string | null },
): ActionItem {
  const ageMinutes = Math.max(0, Math.floor((Date.now() - new Date(options.timestamp).getTime()) / 60000));
  return {
    id: `${kind}:${row.id}`,
    kind,
    severity: options.severity,
    title: options.title,
    targetType: options.targetType,
    targetId: row.id,
    ownerId: options.ownerId ?? null,
    createdAt: options.timestamp,
    ageMinutes,
    slaMinutes: options.slaMinutes,
    overdue: ageMinutes >= options.slaMinutes,
    nextAction: options.nextAction,
  };
}

async function actions(ctx: OperationContext, payload: Record<string, unknown>): Promise<OperationResult> {
  const input = listInput(payload);
  const cutoff72h = new Date(Date.now() + 72 * 3600_000).toISOString();
  const [sos, payments, payouts, notifications, leads, bookings] = await Promise.all([
    ctx.db.from('sos_alerts').select('id,status,triggered_at').in('status', ['triggered', 'acknowledged']).limit(200),
    ctx.db.from('payment_events').select('id,status,initiated_at,booking_id').eq('status', 'failed').limit(200),
    ctx.db.from('payout_dispatches').select('id,status,initiated_at,booking_id').eq('status', 'failed').limit(200),
    ctx.db.from('notifications').select('id,push_failed_at,created_at,booking_id').not('push_failed_at', 'is', null).limit(200),
    ctx.db.from('marketing_leads').select('id,status,created_at,owner_admin_id').eq('status', 'new').limit(200),
    ctx.db.from('bookings').select('id,status,created_at,tour_start_time,proofs_due_at')
      .or(`and(tour_start_time.not.is.null,tour_start_time.lte.${cutoff72h}),and(proofs_due_at.not.is.null,proofs_due_at.lte.${new Date().toISOString()})`)
      .limit(300),
  ]) as DbResult[];

  const sources = {
    sos: !sos.error,
    payments: !payments.error,
    payouts: !payouts.error,
    notifications: !notifications.error,
    leads: !leads.error,
    bookings: !bookings.error,
  };
  const items: ActionItem[] = [];
  if (!sos.error && ctx.role !== 'finance') for (const row of sos.data ?? []) {
    items.push(action('sos', row, {
      severity: 'critical', title: 'Open SOS alert', targetType: 'sos_alert',
      timestamp: row.triggered_at, slaMinutes: 0, nextAction: 'Acknowledge and contact both parties',
    }));
  }
  if (!payments.error && ctx.role !== 'operations') for (const row of payments.data ?? []) {
    items.push(action('payment_failed', row, {
      severity: 'high', title: 'Payment failed', targetType: 'payment_event',
      timestamp: row.initiated_at, slaMinutes: 15, nextAction: 'Review failure and contact the payer',
    }));
  }
  if (!payouts.error && ctx.role !== 'operations') for (const row of payouts.data ?? []) {
    items.push(action('payout_failed', row, {
      severity: 'high', title: 'Payout or refund failed', targetType: 'payout_dispatch',
      timestamp: row.initiated_at, slaMinutes: 15, nextAction: 'Review and retry the dispatch',
    }));
  }
  if (!notifications.error && ctx.role !== 'finance') for (const row of notifications.data ?? []) {
    items.push(action('notification_failed', row, {
      severity: 'high', title: 'Safety or trip notification failed', targetType: 'notification',
      timestamp: row.push_failed_at ?? row.created_at, slaMinutes: 15, nextAction: 'Retry or contact the user manually',
    }));
  }
  if (!leads.error && ctx.role !== 'finance') for (const row of leads.data ?? []) {
    items.push(action('lead_unanswered', row, {
      severity: 'medium', title: 'Website lead awaiting reply', targetType: 'marketing_lead',
      timestamp: row.created_at, ownerId: row.owner_admin_id, slaMinutes: 240, nextAction: 'Reply and qualify the request',
    }));
  }
  if (!bookings.error && ctx.role !== 'finance') for (const row of bookings.data ?? []) {
    if (row.status === 'awaiting_proofs' && row.proofs_due_at && new Date(row.proofs_due_at).getTime() <= Date.now()) {
      items.push(action('proofs_overdue', row, {
        severity: 'high', title: 'Expense proofs overdue', targetType: 'booking',
        timestamp: row.proofs_due_at, slaMinutes: 0, nextAction: 'Contact the Buddy and review proof status',
      }));
    } else if (row.tour_start_time && new Date(row.tour_start_time).getTime() <= Date.now() + 72 * 3600_000
      && !['trip_ready', 'in_progress', 'completed', 'rated', ...CANCELLED_STATUSES].includes(row.status)) {
      items.push(action('trip_not_ready', row, {
        severity: 'high', title: 'Trip within 72h is not ready', targetType: 'booking',
        timestamp: row.created_at, slaMinutes: 0, nextAction: 'Resolve agreement, deposit, balance, or assignment blocker',
      }));
    }
  }

  const severityOrder = { critical: 0, high: 1, medium: 2 };
  items.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || b.ageMinutes - a.ageMinutes);
  const page = items.slice(input.cursor, input.cursor + input.pageSize);
  const warnings = Object.entries(sources).filter(([, ok]) => !ok).map(([name]) => `${name}_unavailable`);
  return {
    data: { items: page, total: items.length, sources },
    meta: {
      nextCursor: input.cursor + input.pageSize < items.length ? encodeCursor(input.cursor + input.pageSize) : undefined,
      warnings,
    },
  };
}

async function usersList(ctx: OperationContext, payload: Record<string, unknown>): Promise<OperationResult> {
  const input = listInput(payload);
  let query: any = ctx.db.from('users')
    .select('id,email,full_name,role,is_verified,avatar_url,is_banned,banned_at,created_at,guide_profiles(university,bio,languages,avg_rating,total_trips,response_time_minutes,profile_status,profile_completed_at),traveler_profiles(nationality,about_me,onboarded_at)', { count: 'exact' })
    .order('created_at', { ascending: false }).range(input.cursor, input.cursor + input.pageSize - 1);
  if (input.status && input.status !== 'all') {
    if (!['traveler', 'guide', 'admin', 'suspended'].includes(input.status)) {
      throw new AdminOperationError('invalid_status', 'Unknown user filter.');
    }
    query = input.status === 'suspended' ? query.eq('is_banned', true) : query.eq('role', input.status);
  }
  if (input.query) query = query.or(`full_name.ilike.%${input.query}%,email.ilike.%${input.query}%`);
  return pageResult(await query as DbResult, input.cursor, input.pageSize);
}

async function userDetail(ctx: OperationContext, payload: Record<string, unknown>): Promise<OperationResult> {
  const id = uuid(payload.id);
  const [user, guideProfile, travelerProfile, bookings, reviews] = await Promise.all([
    ctx.db.from('users').select('id,email,phone,full_name,role,avatar_url,is_verified,is_banned,banned_at,banned_reason,created_at,updated_at').eq('id', id).maybeSingle(),
    ctx.db.from('guide_profiles').select('*').eq('user_id', id).maybeSingle(),
    ctx.db.from('traveler_profiles').select('*').eq('user_id', id).maybeSingle(),
    ctx.db.from('bookings').select('id,status,payment_status,tour_start_time,total_amount,created_at').or(`traveler_id.eq.${id},guide_id.eq.${id}`).order('created_at', { ascending: false }).limit(50),
    ctx.db.from('reviews').select('id,overall_rating,comment,created_at').eq('reviewee_id', id).order('created_at', { ascending: false }).limit(25),
  ]) as DbResult[];
  if (user.error) throw new AdminOperationError('data_unavailable', 'User data is unavailable.', 503);
  if (!user.data) throw new AdminOperationError('not_found', 'User not found.', 404);
  const warnings: string[] = [];
  if (guideProfile.error) warnings.push('guide_profile_unavailable');
  if (travelerProfile.error) warnings.push('traveler_profile_unavailable');
  if (bookings.error) warnings.push('booking_history_unavailable');
  if (reviews.error) warnings.push('reviews_unavailable');
  return {
    data: {
      user: user.data,
      guideProfile: guideProfile.error ? null : guideProfile.data,
      travelerProfile: travelerProfile.error ? null : travelerProfile.data,
      bookings: bookings.error ? null : bookings.data ?? [],
      reviews: reviews.error ? null : reviews.data ?? [],
    },
    meta: { warnings },
  };
}

async function bookingsList(
  ctx: OperationContext,
  payload: Record<string, unknown>,
  forcedStatuses?: string[],
): Promise<OperationResult> {
  const input = listInput(payload);
  let query: any = ctx.db.from('bookings').select(
    'id,status,payment_status,total_amount,buddy_cost,platform_fee,arrival_time,departure_time,tour_start_time,tour_end_time,created_at,updated_at,traveler_id,guide_id,traveler:users!traveler_id(id,full_name,email),guide:users!guide_id(id,full_name,email)',
    { count: 'exact' },
  ).order('created_at', { ascending: false }).range(input.cursor, input.cursor + input.pageSize - 1);
  const statuses = forcedStatuses ?? bookingStatuses(input.status);
  if (statuses) query = query.in('status', statuses);
  if (input.query) {
    if (UUID_RE.test(input.query)) query = query.eq('id', input.query);
    else throw new AdminOperationError('invalid_query', 'Booking search requires a full booking UUID.');
  }
  return pageResult(await query as DbResult, input.cursor, input.pageSize);
}

async function bookingDetail(ctx: OperationContext, payload: Record<string, unknown>): Promise<OperationResult> {
  const id = uuid(payload.id);
  const finance = ctx.role === 'finance';
  const bookingSelect = finance
    ? 'id,status,payment_status,total_amount,buddy_cost,platform_fee,gst_amount,created_at,updated_at,traveler_id,guide_id,traveler:users!traveler_id(id,full_name),guide:users!guide_id(id,full_name)'
    : '*,traveler:users!traveler_id(id,full_name,email,phone),guide:users!guide_id(id,full_name,email,phone),itinerary:itineraries(id,title)';
  const booking = await ctx.db.from('bookings').select(bookingSelect).eq('id', id).maybeSingle() as DbResult;
  if (booking.error) throw new AdminOperationError('data_unavailable', 'Booking data is unavailable.', 503);
  if (!booking.data) throw new AdminOperationError('not_found', 'Booking not found.', 404);

  const queries: Record<string, PromiseLike<unknown>> = finance ? {
    agreements: ctx.db.from('agreements').select(
      'id,booking_id,status,buddy_fee_paise,buffer_paise,itinerary_fund_paise,traveler_gst_paise,traveler_subtotal_paise,traveler_total_paise,platform_fee_down_rate,platform_fee_up_rate,gst_rate,tds_rate,trip_starts_at,trip_ends_at,created_at,updated_at,drafted_at,sent_at,traveler_signed_at,buddy_signed_at,cancelled_at',
    ).eq('booking_id', id).order('created_at'),
    deposits: ctx.db.from('deposits').select(
      'id,booking_id,side,status,amount_paise,created_at,held_at,resolved_at',
    ).eq('booking_id', id).order('created_at'),
    payments: ctx.db.from('payment_events').select(
      'id,booking_id,kind,status,amount_paise,original_amount_minor_units,original_currency,initiated_at,captured_at,failed_reason',
    ).eq('booking_id', id).order('initiated_at'),
    topUps: ctx.db.from('top_up_requests').select(
      'id,booking_id,requested_paise,category,status,created_at,expires_at,traveler_decided_at,payment_event_id',
    ).eq('booking_id', id).order('created_at'),
    // Proof URLs, free-text descriptions and uploader identities are withheld
    // from finance. This summary proves an amount/category was submitted; a
    // future asset-view command must mint a short-lived URL and audit access.
    proofs: ctx.db.from('expense_proofs').select(
      'id,booking_id,category,amount_paise,created_at',
    ).eq('booking_id', id).order('created_at'),
    payouts: ctx.db.from('payout_dispatches').select(
      'id,booking_id,kind,status,gross_paise,tds_paise,buffer_clawback_paise,deposit_component_paise,net_paise,initiated_at,completed_at,failed_reason',
    ).eq('booking_id', id).order('initiated_at'),
  } : {
    agreements: ctx.db.from('agreements').select('*').eq('booking_id', id).order('created_at'),
    deposits: ctx.db.from('deposits').select('*').eq('booking_id', id).order('created_at'),
    payments: ctx.db.from('payment_events').select('*').eq('booking_id', id).order('initiated_at'),
    topUps: ctx.db.from('top_up_requests').select('*').eq('booking_id', id).order('created_at'),
    proofs: ctx.db.from('expense_proofs').select('*').eq('booking_id', id).order('created_at'),
    payouts: ctx.db.from('payout_dispatches').select('*').eq('booking_id', id).order('initiated_at'),
  };
  if (!finance) {
    queries.messages = ctx.db.from('messages').select('id,sender_id,content,is_read,created_at').eq('booking_id', id).order('created_at');
    queries.reviews = ctx.db.from('reviews').select('*').eq('booking_id', id).order('created_at');
    queries.sos = ctx.db.from('sos_alerts').select('*').eq('booking_id', id).order('triggered_at');
    queries.reports = ctx.db.from('reports').select('*').eq('booking_id', id).order('created_at');
  }
  const names = Object.keys(queries);
  const settled = await Promise.all(Object.values(queries)) as DbResult[];
  const data: Record<string, unknown> = { booking: booking.data };
  const warnings: string[] = [];
  settled.forEach((result, index) => {
    const name = names[index];
    if (result.error) {
      data[name] = null;
      warnings.push(`${name}_unavailable`);
    } else data[name] = result.data ?? [];
  });

  if (!finance && Array.isArray(data.sos) && data.sos.length > 0) {
    const { error } = await ctx.db.rpc('admin_log_sensitive_access_tx', {
      p_actor_id: ctx.userId,
      p_actor_role: ctx.role,
      p_target_type: 'sos_alert',
      p_target_id: (data.sos[0] as { id: string }).id,
      p_reason: 'View booking safety history',
      p_idempotency_key: ctx.requestId,
      p_request_id: ctx.requestId,
      p_metadata: { booking_id: id, alert_count: data.sos.length },
    });
    if (error) throw new AdminOperationError('audit_unavailable', 'Safety data access could not be audited.', 503);
  }
  return { data, meta: { warnings } };
}

async function sosList(ctx: OperationContext, payload: Record<string, unknown>): Promise<OperationResult> {
  const input = listInput(payload);
  let query: any = ctx.db.from('sos_alerts').select(
    'id,booking_id,triggered_by,latitude,longitude,status,resolution_notes,triggered_at,resolved_at,dispatch_status,dispatch_attempts,dispatch_last_attempt_at,dispatch_last_error,dispatch_channels,delivered_at,user:users!triggered_by(id,full_name,email,phone,role),booking:bookings!booking_id(id,status)',
    { count: 'exact' },
  ).order('triggered_at', { ascending: false }).range(input.cursor, input.cursor + input.pageSize - 1);
  if (input.status === 'open') query = query.in('status', ['triggered', 'acknowledged']);
  else if (input.status && input.status !== 'all') {
    if (!['triggered', 'acknowledged', 'resolved'].includes(input.status)) throw new AdminOperationError('invalid_status', 'Unknown SOS status.');
    query = query.eq('status', input.status);
  }
  const result = await query as DbResult;
  if (result.error) throw new AdminOperationError('data_unavailable', 'SOS data is unavailable.', 503);
  const { error: auditError } = await ctx.db.rpc('admin_log_sensitive_access_tx', {
    p_actor_id: ctx.userId,
    p_actor_role: ctx.role,
    p_target_type: 'sos_queue',
    p_target_id: input.status ?? 'all',
    p_reason: 'View SOS queue',
    p_idempotency_key: ctx.requestId,
    p_request_id: ctx.requestId,
    p_metadata: { row_count: (result.data ?? []).length },
  });
  if (auditError) throw new AdminOperationError('audit_unavailable', 'SOS data access could not be audited.', 503);
  return pageResult(result, input.cursor, input.pageSize);
}

async function reportsList(ctx: OperationContext, payload: Record<string, unknown>): Promise<OperationResult> {
  const input = listInput(payload);
  let query: any = ctx.db.from('reports').select(
    'id,reporter_id,reported_user_id,booking_id,reason,details,status,admin_notes,created_at,reviewed_at,reporter:users!reporter_id(id,full_name,email),reported:users!reported_user_id(id,full_name,email)',
    { count: 'exact' },
  ).order('created_at', { ascending: false }).range(input.cursor, input.cursor + input.pageSize - 1);
  if (input.status && input.status !== 'all') {
    if (!['open', 'reviewing', 'actioned', 'dismissed'].includes(input.status)) throw new AdminOperationError('invalid_status', 'Unknown report status.');
    query = query.eq('status', input.status);
  }
  return pageResult(await query as DbResult, input.cursor, input.pageSize);
}

async function disputesList(ctx: OperationContext, payload: Record<string, unknown>): Promise<OperationResult> {
  const input = listInput(payload);
  const result = await ctx.db.from('bookings').select(
    'id,status,payment_status,total_amount,created_at,updated_at,traveler:users!traveler_id(id,full_name,email),guide:users!guide_id(id,full_name,email),reports(id,status,reason,created_at)',
    { count: 'exact' },
  ).eq('status', 'disputed').order('updated_at', { ascending: false })
    .range(input.cursor, input.cursor + input.pageSize - 1) as DbResult;
  return pageResult(result, input.cursor, input.pageSize);
}

async function leadsList(ctx: OperationContext, payload: Record<string, unknown>): Promise<OperationResult> {
  const input = listInput(payload);
  let query: any = ctx.db.from('marketing_leads').select(
    'id,request_type,status,name,email,arrival,departure,flight_numbers,interests,landing_page,first_attribution,last_attribution,owner_admin_id,linked_user_id,linked_booking_id,created_at,updated_at,first_contacted_at,qualified_at,converted_at,closed_at,pii_redact_after,pii_redacted_at',
    { count: 'exact' },
  ).order('created_at', { ascending: false }).range(input.cursor, input.cursor + input.pageSize - 1);
  if (input.status && input.status !== 'all') {
    if (!['new', 'contacted', 'qualified', 'converted', 'closed', 'spam'].includes(input.status)) throw new AdminOperationError('invalid_status', 'Unknown lead status.');
    query = query.eq('status', input.status);
  }
  if (input.query) query = query.or(`name.ilike.%${input.query}%,email.ilike.%${input.query}%`);
  return pageResult(await query as DbResult, input.cursor, input.pageSize);
}

function financeDate(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AdminOperationError('invalid_date_range', `${field} must be YYYY-MM-DD.`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new AdminOperationError('invalid_date_range', `${field} must be a real calendar date.`);
  }
  return value;
}

async function financeSummary(ctx: OperationContext, payload: Record<string, unknown>): Promise<OperationResult> {
  const endDate = payload.endDate === undefined
    ? new Date().toISOString().slice(0, 10)
    : financeDate(payload.endDate, 'endDate');
  const startDate = payload.startDate === undefined ? null : financeDate(payload.startDate, 'startDate');
  if (startDate) {
    const span = new Date(`${endDate}T00:00:00Z`).getTime() - new Date(`${startDate}T00:00:00Z`).getTime();
    if (span < 0 || span > 365 * 86_400_000) {
      throw new AdminOperationError('invalid_date_range', 'Explicit finance ranges are limited to 366 inclusive days.');
    }
  }
  const result = await ctx.db.rpc('admin_finance_summary', {
    p_start_date: startDate,
    p_end_date: endDate,
  }) as DbResult;
  if (result.error || !result.data) {
    throw new AdminOperationError('finance_unavailable', 'Financial ledgers are unavailable.', 503);
  }
  return { data: result.data };
}

async function paymentsList(ctx: OperationContext, payload: Record<string, unknown>): Promise<OperationResult> {
  const input = listInput(payload);
  let query: any = ctx.db.from('payment_events').select(
    'id,booking_id,user_id,kind,amount_paise,original_amount_minor_units,original_currency,status,initiated_at,captured_at,failed_reason,is_late_fee_component,booking:bookings!booking_id(id,status)',
    { count: 'exact' },
  ).order('initiated_at', { ascending: false }).range(input.cursor, input.cursor + input.pageSize - 1);
  if (input.status && input.status !== 'all') {
    if (!['initiated', 'captured', 'failed', 'refunded'].includes(input.status)) throw new AdminOperationError('invalid_status', 'Unknown payment status.');
    query = query.eq('status', input.status);
  }
  if (input.query) {
    if (!UUID_RE.test(input.query)) throw new AdminOperationError('invalid_query', 'Ledger search requires a booking UUID.');
    query = query.eq('booking_id', input.query);
  }
  return pageResult(await query as DbResult, input.cursor, input.pageSize);
}

async function payoutsList(ctx: OperationContext, payload: Record<string, unknown>): Promise<OperationResult> {
  const input = listInput(payload);
  if (input.status === 'processing') {
    // Dispatch is synchronous today, so the canonical enum has no processing
    // state. Return the truthful empty slice rather than aliasing pending rows.
    return { data: { items: [], total: 0 } };
  }
  let query: any = ctx.db.from('payout_dispatches').select(
    'id,booking_id,recipient_user_id,kind,gross_paise,tds_paise,buffer_clawback_paise,deposit_component_paise,net_paise,status,initiated_at,completed_at,failed_reason,recipient:users!recipient_user_id(id,full_name)',
    { count: 'exact' },
  ).order('initiated_at', { ascending: false }).range(input.cursor, input.cursor + input.pageSize - 1);
  if (input.status && input.status !== 'all') {
    if (!['pending', 'completed', 'failed', 'stubbed'].includes(input.status)) throw new AdminOperationError('invalid_status', 'Unknown payout status.');
    if (input.status === 'completed') query = query.eq('status', 'sent');
    else if (input.status === 'stubbed') query = query.eq('status', 'failed').eq('failed_reason', 'razorpay_live_not_configured');
    else if (input.status === 'failed') query = query.eq('status', 'failed').neq('failed_reason', 'razorpay_live_not_configured');
    else query = query.eq('status', input.status);
  }
  return pageResult(await query as DbResult, input.cursor, input.pageSize);
}

async function cancellationsList(ctx: OperationContext, payload: Record<string, unknown>): Promise<OperationResult> {
  const input = listInput(payload);
  let query: any = ctx.db.from('bookings').select(
    'id,status,cancellation_trigger_event,cancelled_at,cancelled_resolution_jsonb,payment_status,traveler:users!traveler_id(id,full_name,email),guide:users!guide_id(id,full_name,email),payout_dispatches(id,kind,net_paise,status,failed_reason,completed_at)',
    { count: 'exact' },
  ).in('status', CANCELLED_STATUSES).order('cancelled_at', { ascending: false })
    .range(input.cursor, input.cursor + input.pageSize - 1);
  if (input.status && input.status !== 'all') query = query.eq('cancellation_trigger_event', input.status);
  return pageResult(await query as DbResult, input.cursor, input.pageSize);
}

async function contentDeployments(ctx: OperationContext, payload: Record<string, unknown>): Promise<OperationResult> {
  const input = listInput(payload);
  let query: any = ctx.db.from('content_deployments').select(
    'id,sanity_document_id,sanity_document_type,sanity_version,status,requested_by,preview_url,deployment_url,provider_deployment_id,error_message,requested_at,started_at,completed_at,updated_at,metadata',
    { count: 'exact' },
  ).order('requested_at', { ascending: false }).range(input.cursor, input.cursor + input.pageSize - 1);
  if (input.status && input.status !== 'all') {
    if (!['requested', 'building', 'ready', 'failed', 'cancelled'].includes(input.status)) throw new AdminOperationError('invalid_status', 'Unknown deployment status.');
    query = query.eq('status', input.status);
  }
  return pageResult(await query as DbResult, input.cursor, input.pageSize);
}

async function platformHealth(ctx: OperationContext): Promise<OperationResult> {
  const [push, sosDispatch, deployments, growth] = await Promise.all([
    ctx.db.from('notifications').select('id', { count: 'exact', head: true }).not('push_failed_at', 'is', null),
    ctx.db.from('sos_alerts').select('id', { count: 'exact', head: true }).in('dispatch_status', ['failed', 'partial']),
    ctx.db.from('content_deployments').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
    ctx.db.from('growth_report_cache').select('generated_at').order('generated_at', { ascending: false }).limit(1).maybeSingle(),
  ]) as DbResult[];
  const queue = (result: DbResult) => result.error
    ? { available: false, count: null }
    : { available: true, count: result.count ?? 0 };
  const warnings: string[] = [];
  if (push.error) warnings.push('push_health_unavailable');
  if (sosDispatch.error) warnings.push('sos_dispatch_health_unavailable');
  if (deployments.error) warnings.push('deployment_health_unavailable');
  if (growth.error) warnings.push('growth_cache_health_unavailable');
  return {
    data: {
      queues: {
        failedPush: queue(push),
        failedSosDispatch: queue(sosDispatch),
        failedContentDeployments: queue(deployments),
      },
      providers: {
        ga4: { configured: Boolean(/^\d+$/.test(Deno.env.get('GA4_PROPERTY_ID')?.trim() ?? '') && Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL') && Deno.env.get('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')) },
        searchConsole: { configured: Boolean(Deno.env.get('SEARCH_CONSOLE_SITE_URL') && Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL') && Deno.env.get('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')) },
        contentWebhook: { configured: Boolean(
          (Deno.env.get('SANITY_WEBHOOK_SECRET') ?? Deno.env.get('CONTENT_WEBHOOK_SECRET'))
          && Deno.env.get('CONTENT_STATUS_SECRET')
          && Deno.env.get('VERCEL_DEPLOY_HOOK_URL')
        ) },
        leadEmail: { configured: Boolean(Deno.env.get('RESEND_API_KEY') && Deno.env.get('LEAD_NOTIFICATION_FROM')) },
      },
      latestGrowthSyncAt: growth.error ? null : growth.data?.generated_at ?? null,
    },
    meta: { warnings },
  };
}

async function auditList(ctx: OperationContext, payload: Record<string, unknown>): Promise<OperationResult> {
  const input = listInput(payload);
  let query: any = ctx.db.from('admin_action_log').select(
    'id,actor_id,actor_role,action,target_type,target_id,reason,before_state,after_state,request_id,metadata,created_at',
    { count: 'exact' },
  ).order('created_at', { ascending: false }).range(input.cursor, input.cursor + input.pageSize - 1);
  if (input.status && input.status !== 'all') query = query.eq('action', input.status);
  return pageResult(await query as DbResult, input.cursor, input.pageSize);
}

async function adminsList(ctx: OperationContext): Promise<OperationResult> {
  const [{ data: memberships, error }, authUsers] = await Promise.all([
    ctx.db.from('admin_memberships').select('user_id,role,is_active,invited_by,invited_at,accepted_at,created_at,updated_at').order('created_at'),
    ctx.db.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);
  if (error || authUsers.error) throw new AdminOperationError('data_unavailable', 'Administrator list is unavailable.', 503);
  const emailById = new Map(authUsers.data.users.map((user) => [user.id, user.email ?? null]));
  return { data: { items: (memberships ?? []).map((row: any) => ({ ...row, email: emailById.get(row.user_id) ?? null })) } };
}

async function settings(ctx: OperationContext): Promise<OperationResult> {
  const result = await ctx.db.from('platform_settings').select(
    'id,early_access_mode,platform_fee_up_rate,platform_fee_down_rate,commission_rate,gst_rate,tds_rate,late_fee_paise,pricing_content_deployment_id,updated_at',
  ).eq('id', 1).maybeSingle() as DbResult;
  if (result.error) throw new AdminOperationError('data_unavailable', 'Platform settings are unavailable.', 503);
  if (!result.data) throw new AdminOperationError('not_found', 'Platform settings are missing.', 404);
  return { data: result.data };
}

async function globalSearch(ctx: OperationContext, payload: Record<string, unknown>): Promise<OperationResult> {
  const query = cleanSearch(typeof payload.query === 'string' ? payload.query : undefined);
  if (!query || query.length < 2) throw new AdminOperationError('invalid_query', 'Enter at least two search characters.');
  const usersQuery = ctx.role === 'finance'
    ? ctx.db.from('users').select('id,full_name,role').ilike('full_name', `%${query}%`).limit(8)
    : ctx.db.from('users').select('id,full_name,email,role,is_banned').or(`full_name.ilike.%${query}%,email.ilike.%${query}%`).limit(8);
  const bookingQuery = UUID_RE.test(query)
    ? ctx.db.from('bookings').select('id,status,payment_status,traveler:users!traveler_id(id,full_name),guide:users!guide_id(id,full_name)').eq('id', query).limit(8)
    : ctx.db.from('bookings').select('id,status,payment_status,traveler:users!traveler_id(id,full_name),guide:users!guide_id(id,full_name)').order('created_at', { ascending: false }).limit(50);
  const promises: PromiseLike<unknown>[] = [usersQuery, bookingQuery];
  if (ctx.role !== 'finance') {
    promises.push(ctx.db.from('marketing_leads').select('id,name,email,status,request_type,created_at').or(`name.ilike.%${query}%,email.ilike.%${query}%`).limit(8));
  }
  const results = await Promise.all(promises) as DbResult[];
  const warnings: string[] = [];
  const users = results[0].error ? (warnings.push('users_unavailable'), null) : results[0].data ?? [];
  let bookings = results[1].error ? (warnings.push('bookings_unavailable'), null) : results[1].data ?? [];
  if (!UUID_RE.test(query) && Array.isArray(bookings)) {
    const lower = query.toLowerCase();
    bookings = bookings.filter((row: any) =>
      row.traveler?.full_name?.toLowerCase().includes(lower)
      || row.guide?.full_name?.toLowerCase().includes(lower)
    ).slice(0, 8);
  }
  const leads = results[2]
    ? (results[2].error ? (warnings.push('leads_unavailable'), null) : results[2].data ?? [])
    : undefined;
  return { data: { users, bookings, ...(leads !== undefined ? { leads } : {}) }, meta: { warnings } };
}

export async function executeReadOperation(
  operation: AdminOperation,
  payload: Record<string, unknown>,
  ctx: OperationContext,
): Promise<OperationResult> {
  switch (operation) {
    case 'overview.get': return await overview(ctx);
    case 'actions.list': return await actions(ctx, payload);
    case 'users.list': return await usersList(ctx, payload);
    case 'users.get': return await userDetail(ctx, payload);
    case 'bookings.list': return await bookingsList(ctx, payload);
    case 'bookings.get': return await bookingDetail(ctx, payload);
    case 'inquiries.list': return await bookingsList(ctx, payload, INQUIRY_STATUSES);
    case 'live-trips.list': return await bookingsList(ctx, payload, ['trip_ready', 'in_progress']);
    case 'sos.list': return await sosList(ctx, payload);
    case 'reports.list': return await reportsList(ctx, payload);
    case 'disputes.list': return await disputesList(ctx, payload);
    case 'leads.list': return await leadsList(ctx, payload);
    case 'finance.summary': return await financeSummary(ctx, payload);
    case 'payments.list': return await paymentsList(ctx, payload);
    case 'payouts.list': return await payoutsList(ctx, payload);
    case 'cancellations.list': return await cancellationsList(ctx, payload);
    case 'content.deployments.list': return await contentDeployments(ctx, payload);
    case 'platform.health': return await platformHealth(ctx);
    case 'audit.list': return await auditList(ctx, payload);
    case 'admins.list': return await adminsList(ctx);
    case 'settings.get': return await settings(ctx);
    case 'search.global': return await globalSearch(ctx, payload);
    default:
      throw new AdminOperationError('unsupported_operation', 'This read operation is not implemented.', 501);
  }
}

export { uuid as requireUuid };
