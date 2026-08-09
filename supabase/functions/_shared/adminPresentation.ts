// Stable camelCase presentation layer for the Admin SPA contract. Database
// column names and relation aliases never leak into the browser contract.

import type { AdminOperation } from './adminContract.ts';
import type { OperationResult } from './adminOperations.ts';

type Row = Record<string, any>;

function first(value: unknown): Row | null {
  if (Array.isArray(value)) return (value[0] as Row | undefined) ?? null;
  return value && typeof value === 'object' ? value as Row : null;
}

function person(value: unknown): Row | null {
  const row = first(value);
  if (!row) return null;
  return {
    id: row.id,
    fullName: row.full_name ?? row.fullName ?? null,
    email: row.email ?? null,
    role: row.role,
    avatarUrl: row.avatar_url ?? row.avatarUrl ?? null,
  };
}

function paiseFromRupees(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) : null;
}

function bookingSummary(row: Row): Row {
  return {
    id: row.id,
    status: row.status,
    paymentStatus: row.payment_status ?? row.paymentStatus ?? null,
    traveler: person(row.traveler),
    buddy: person(row.guide ?? row.buddy),
    itineraryTitle: first(row.itinerary)?.title ?? row.itinerary_title ?? null,
    arrivalTime: row.arrival_time ?? null,
    departureTime: row.departure_time ?? null,
    tripStartsAt: row.tour_start_time ?? row.trip_starts_at ?? null,
    createdAt: row.created_at ?? row.cancelled_at ?? row.updated_at ?? new Date(0).toISOString(),
    totalPaise: row.total_paise ?? paiseFromRupees(row.total_amount),
    proofsDueAt: row.proofs_due_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

function userSummary(row: Row): Row {
  const guide = first(row.guide_profiles ?? row.guideProfile);
  const traveler = first(row.traveler_profiles ?? row.travelerProfile);
  let profileCompleteness: number | null = null;
  if (guide) {
    const fields = [guide.university, guide.bio, guide.languages, guide.profile_completed_at];
    profileCompleteness = Math.round(fields.filter((value) =>
      Array.isArray(value) ? value.length > 0 : Boolean(value)
    ).length / fields.length * 100);
  } else if (traveler) {
    const fields = [traveler.nationality, traveler.about_me, traveler.onboarded_at];
    profileCompleteness = Math.round(fields.filter(Boolean).length / fields.length * 100);
  }
  return {
    id: row.id,
    fullName: row.full_name ?? null,
    email: row.email ?? null,
    role: row.role,
    avatarUrl: row.avatar_url ?? null,
    isVerified: row.is_verified ?? null,
    isBanned: Boolean(row.is_banned),
    joinedAt: row.created_at ?? null,
    profileCompleteness,
    totalTrips: guide?.total_trips ?? null,
    rating: guide?.avg_rating == null ? null : Number(guide.avg_rating),
    responseTimeMinutes: guide?.response_time_minutes ?? null,
    university: guide?.university ?? null,
    nationality: traveler?.nationality ?? null,
  };
}

function userDetail(raw: Row): Row {
  const row = raw.user ?? {};
  const guide = raw.guideProfile ?? null;
  const traveler = raw.travelerProfile ?? null;
  const summary = userSummary({ ...row, guide_profiles: guide, traveler_profiles: traveler });
  const recent = Array.isArray(raw.bookings) ? raw.bookings.map(bookingSummary) : undefined;
  const reviews = Array.isArray(raw.reviews) ? raw.reviews.map((review: Row) => ({
    id: review.id,
    rating: Number(review.overall_rating),
    comment: review.comment ?? null,
    createdAt: review.created_at,
  })) : undefined;
  const completed = recent?.filter((booking: Row) => ['completed', 'rated'].includes(booking.status)).length ?? 0;
  return {
    ...summary,
    phone: row.phone ?? null,
    bio: guide?.bio ?? traveler?.about_me ?? null,
    languages: guide?.languages ?? [],
    safetyFlags: [row.is_banned ? 'suspended' : null].filter(Boolean),
    stats: recent ? { totalTrips: recent.length, completedTrips: completed, reviews: reviews?.length ?? 0 } : undefined,
    recentBookings: recent,
    reviews,
    verification: guide ? {
      aadhaar: guide.aadhaar_verified ?? null,
      college: guide.college_verified ?? null,
      interview: guide.interview_passed ?? null,
      police: guide.police_verified ?? null,
    } : {},
  };
}

function timeline(raw: Row): Row[] {
  const events: Row[] = [];
  const add = (id: string, type: string, title: string, occurredAt: string | null | undefined, extra: Row = {}) => {
    if (occurredAt) events.push({ id, type, title, occurredAt, ...extra });
  };
  const booking = raw.booking ?? {};
  add(`booking:${booking.id}`, 'booking', 'Booking created', booking.created_at, { status: booking.status });
  for (const item of raw.agreements ?? []) {
    add(`agreement:${item.id}`, 'agreement', `Agreement ${String(item.status).replaceAll('_', ' ')}`, item.updated_at ?? item.created_at, { status: item.status });
  }
  for (const item of raw.deposits ?? []) {
    add(`deposit:${item.id}`, 'deposit', `${item.side} deposit ${item.status}`, item.held_at ?? item.created_at, { status: item.status, amountPaise: item.amount_paise });
  }
  for (const item of raw.payments ?? []) {
    add(`payment:${item.id}`, 'payment', `${item.kind} payment ${item.status}`, item.captured_at ?? item.initiated_at, { status: item.status, amountPaise: item.amount_paise });
  }
  for (const item of raw.topUps ?? []) {
    add(`topup:${item.id}`, 'top_up', `Top-up ${item.status}`, item.created_at, { status: item.status, amountPaise: item.requested_paise });
  }
  for (const item of raw.messages ?? []) {
    add(`message:${item.id}`, 'message', 'Inquiry message', item.created_at, { description: item.content, actor: { id: item.sender_id } });
  }
  for (const item of raw.proofs ?? []) {
    add(`proof:${item.id}`, 'proof', 'Expense proof submitted', item.created_at, { amountPaise: item.amount_paise });
  }
  for (const item of raw.payouts ?? []) {
    add(`payout:${item.id}`, 'payout', `${item.kind} ${item.status}`, item.completed_at ?? item.initiated_at, { status: item.status, amountPaise: item.net_paise });
  }
  for (const item of raw.sos ?? []) {
    add(`sos:${item.id}`, 'sos', `SOS ${item.status}`, item.triggered_at, { status: item.status });
  }
  for (const item of raw.reports ?? []) {
    add(`report:${item.id}`, 'report', `Report ${item.status}`, item.created_at, { status: item.status });
  }
  return events.sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
}

function bookingDetail(raw: Row): Row {
  const booking = raw.booking ?? {};
  const summary = bookingSummary(booking);
  const agreement = Array.isArray(raw.agreements) ? raw.agreements.at(-1) ?? null : null;
  return {
    ...summary,
    flights: {
      arrivalNumber: booking.arrival_flight_number ?? null,
      departureNumber: booking.departure_flight_number ?? null,
    },
    tourStartTime: booking.tour_start_time ?? null,
    tourEndTime: booking.tour_end_time ?? null,
    agreement,
    deposits: raw.deposits ?? undefined,
    payments: raw.payments ?? undefined,
    expenseProofs: raw.proofs ?? undefined,
    payouts: raw.payouts ?? undefined,
    messages: raw.messages ?? undefined,
    timeline: timeline(raw),
    financials: {
      buddyCostPaise: paiseFromRupees(booking.buddy_cost),
      platformFeePaise: paiseFromRupees(booking.platform_fee),
      gstPaise: paiseFromRupees(booking.gst_amount),
      totalPaise: paiseFromRupees(booking.total_amount),
    },
  };
}

function lead(row: Row): Row {
  const attribution = row.last_attribution ?? {};
  return {
    id: row.id,
    requestType: row.request_type,
    status: row.status,
    contactName: row.name ?? null,
    contactEmail: row.email ?? null,
    landingPage: row.landing_page ?? null,
    source: attribution.utm_source ?? attribution.attribution_first_source ?? null,
    medium: attribution.utm_medium ?? null,
    campaign: attribution.utm_campaign ?? null,
    owner: row.owner_admin_id ? { id: row.owner_admin_id, fullName: 'Assigned admin' } : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    linkedBookingId: row.linked_booking_id ?? null,
    linkedUserId: row.linked_user_id ?? null,
  };
}

function sos(row: Row): Row {
  return {
    id: row.id,
    status: row.status,
    dispatchStatus: row.dispatch_status ?? null,
    dispatchAttempts: row.dispatch_attempts ?? 0,
    dispatchLastError: row.dispatch_last_error ?? null,
    triggeredAt: row.triggered_at,
    resolvedAt: row.resolved_at ?? null,
    bookingId: row.booking_id,
    triggeredBy: person(row.user ?? row.triggeredBy),
    latitude: row.latitude == null ? null : Number(row.latitude),
    longitude: row.longitude == null ? null : Number(row.longitude),
    resolutionNotes: row.resolution_notes ?? null,
  };
}

function report(row: Row): Row {
  return {
    id: row.id,
    status: row.status,
    reason: row.reason,
    details: row.details ?? null,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at ?? null,
    reporter: person(row.reporter),
    reportedUser: person(row.reported),
    bookingId: row.booking_id ?? null,
    adminNotes: row.admin_notes ?? null,
  };
}

function dispute(row: Row): Row {
  return {
    id: row.id,
    status: 'disputed',
    traveler: person(row.traveler),
    guide: person(row.guide),
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? null,
    reports: (row.reports ?? []).map((item: Row) => ({
      id: item.id, status: item.status, reason: item.reason, createdAt: item.created_at,
    })),
    paymentStatus: row.payment_status ?? null,
    totalAmount: row.total_amount == null ? null : Number(row.total_amount),
  };
}

function money(row: Row, payout = false): Row {
  const payoutStatus = row.status === 'sent'
    ? 'completed'
    : row.status === 'failed' && row.failed_reason === 'razorpay_live_not_configured'
      ? 'stubbed'
      : row.status;
  return {
    id: row.id,
    kind: row.kind,
    status: payout ? payoutStatus : row.status,
    amountPaise: Number(payout ? row.net_paise ?? 0 : row.amount_paise ?? 0),
    bookingId: row.booking_id ?? null,
    person: person(row.recipient),
    occurredAt: payout ? row.completed_at ?? row.initiated_at : row.captured_at ?? row.initiated_at,
    failureReason: row.failed_reason ?? null,
  };
}

function deployment(row: Row): Row {
  return {
    id: row.id,
    documentId: row.sanity_document_id ?? null,
    documentTitle: row.metadata?.documentTitle ?? null,
    version: row.sanity_version ?? null,
    status: row.status,
    requestedBy: row.requested_by ? { id: row.requested_by } : null,
    requestedAt: row.requested_at,
    completedAt: row.completed_at ?? null,
    previewUrl: row.preview_url ?? null,
    productionUrl: row.deployment_url ?? null,
    error: row.error_message ?? null,
  };
}

function settings(row: Row): Row {
  return {
    earlyAccessMode: Boolean(row.early_access_mode),
    platformFeeUpRate: Number(row.platform_fee_up_rate),
    platformFeeDownRate: Number(row.platform_fee_down_rate),
    commissionRate: Number(row.commission_rate),
    gstRate: Number(row.gst_rate),
    tdsRate: Number(row.tds_rate),
    lateFeePaise: Number(row.late_fee_paise),
    updatedAt: row.updated_at ?? null,
    currentContentDeploymentId: row.pricing_content_deployment_id ?? null,
  };
}

function unwrapRpc(raw: Row): { result: Row; auditId: string | null; idempotent: boolean } {
  return {
    result: raw?.result ?? raw ?? {},
    auditId: raw?.audit_id ?? null,
    idempotent: Boolean(raw?.idempotent),
  };
}

function mapPage(raw: Row, mapper: (row: Row) => Row): Row {
  return { items: (raw?.items ?? []).map(mapper), ...(raw?.total !== undefined ? { total: raw.total } : {}) };
}

function actionItem(row: Row): Row {
  const href = row.targetType === 'sos_alert' ? '/trust/sos'
    : row.targetType === 'marketing_lead' ? '/operations/leads'
    : row.targetType === 'booking' ? `/operations/bookings/${row.targetId}`
    : row.targetType === 'payment_event' ? '/money/ledger'
    : row.targetType === 'payout_dispatch' ? '/money/payouts'
    : '/platform/notifications';
  return {
    id: row.id,
    kind: row.kind,
    severity: row.severity,
    title: row.title,
    owner: row.ownerId ? { id: row.ownerId, name: 'Assigned admin' } : null,
    createdAt: row.createdAt,
    ageSeconds: Number(row.ageMinutes ?? 0) * 60,
    slaSeconds: Number(row.slaMinutes ?? 0) * 60,
    nextAction: row.nextAction,
    href,
  };
}

export function presentAdminResult(operation: AdminOperation, value: OperationResult): OperationResult {
  const raw = value.data as Row;
  let data: unknown = raw;
  switch (operation) {
    case 'overview.get':
      data = { ...raw, todayTrips: (raw.todayTrips ?? []).map(bookingSummary) };
      break;
    case 'actions.list': data = mapPage(raw, actionItem); break;
    case 'users.list': data = mapPage(raw, userSummary); break;
    case 'users.get': data = userDetail(raw); break;
    case 'bookings.list':
    case 'inquiries.list':
    case 'live-trips.list':
    case 'cancellations.list': data = mapPage(raw, bookingSummary); break;
    case 'bookings.get': data = bookingDetail(raw); break;
    case 'sos.list': data = mapPage(raw, sos); break;
    case 'reports.list': data = mapPage(raw, report); break;
    case 'disputes.list': data = mapPage(raw, dispute); break;
    case 'leads.list': data = mapPage(raw, lead); break;
    case 'payments.list': data = mapPage(raw, (row) => money(row, false)); break;
    case 'payouts.list': data = mapPage(raw, (row) => money(row, true)); break;
    case 'content.deployments.list': data = mapPage(raw, deployment); break;
    case 'platform.health': {
      const checks: Row[] = [];
      for (const [id, item] of Object.entries(raw.queues ?? {}) as Array<[string, Row]>) {
        checks.push({
          id,
          label: id.replace(/([A-Z])/g, ' $1'),
          state: !item.available ? 'unknown' : Number(item.count) > 0 ? 'degraded' : 'healthy',
          message: !item.available ? 'Data unavailable' : `${item.count} item(s) need attention`,
        });
      }
      for (const [id, item] of Object.entries(raw.providers ?? {}) as Array<[string, Row]>) {
        checks.push({ id, label: id, state: item.configured ? 'healthy' : 'unconfigured' });
      }
      data = { checks };
      break;
    }
    case 'audit.list': data = mapPage(raw, (row) => ({
      id: row.id,
      action: row.action,
      targetType: row.target_type,
      targetId: row.target_id ?? null,
      reason: row.reason ?? null,
      actor: row.actor_id ? { id: row.actor_id, role: row.actor_role } : null,
      createdAt: row.created_at,
      before: row.before_state,
      after: row.after_state,
    })); break;
    case 'admins.list': data = mapPage(raw, (row) => ({
      id: row.user_id,
      userId: row.user_id,
      email: row.email ?? null,
      role: row.role,
      active: Boolean(row.is_active),
      invitedAt: row.invited_at ?? null,
    })); break;
    case 'settings.get': data = settings(raw); break;
    case 'search.global': {
      const items: Row[] = [];
      for (const row of raw.users ?? []) items.push({
        id: row.id, type: 'user', title: row.full_name ?? row.email ?? 'Member',
        subtitle: row.email ?? row.role, href: `/marketplace/users/${row.id}`,
      });
      for (const row of raw.bookings ?? []) items.push({
        id: row.id, type: 'booking', title: `Booking ${String(row.id).slice(0, 8)}`,
        subtitle: `${row.traveler?.full_name ?? 'Traveler'} with ${row.guide?.full_name ?? 'Buddy'} · ${row.status}`,
        href: `/operations/bookings/${row.id}`,
      });
      for (const row of raw.leads ?? []) items.push({
        id: row.id, type: 'lead', title: row.name ?? row.email ?? 'Website lead',
        subtitle: `${row.request_type} · ${row.status}`, href: '/operations/leads',
      });
      data = { items };
      break;
    }
    case 'sos.transition': {
      const rpc = unwrapRpc(raw); data = sos(rpc.result); break;
    }
    case 'reports.transition': {
      const rpc = unwrapRpc(raw); data = report(rpc.result); break;
    }
    case 'leads.update': {
      const rpc = unwrapRpc(raw); data = lead(rpc.result); break;
    }
    case 'disputes.resolve': {
      const rpc = unwrapRpc(raw); data = bookingSummary(rpc.result); break;
    }
    case 'users.suspension': {
      const rpc = unwrapRpc(raw);
      data = {
        id: rpc.result.id,
        isBanned: Boolean(rpc.result.is_banned),
        bannedAt: rpc.result.banned_at ?? null,
        bannedReason: rpc.result.banned_reason ?? null,
        authBanEnforced: rpc.result.auth_ban_enforced === true,
        auditId: rpc.auditId,
        idempotent: rpc.idempotent,
      };
      break;
    }
    case 'admins.membership.update': {
      const rpc = unwrapRpc(raw);
      data = {
        id: rpc.result.user_id,
        userId: rpc.result.user_id,
        role: rpc.result.role,
        active: Boolean(rpc.result.is_active),
        invitedAt: rpc.result.invited_at ?? null,
      };
      break;
    }
    case 'settings.update': {
      const rpc = unwrapRpc(raw); data = settings(rpc.result); break;
    }
    case 'refunds.issue':
    case 'payouts.retry': {
      const dispatch = raw.dispatch ?? {};
      const status = dispatch.status === 'sent'
        ? 'completed'
        : dispatch.status === 'failed' && dispatch.failed_reason === 'razorpay_live_not_configured'
          ? 'stubbed'
          : dispatch.status;
      data = {
        id: dispatch.id,
        kind: dispatch.kind ?? (operation === 'refunds.issue' ? 'refund' : 'payout'),
        status,
        amountPaise: Number(dispatch.net_paise ?? dispatch.amountPaise ?? 0),
        bookingId: dispatch.booking_id ?? null,
        occurredAt: dispatch.completed_at ?? dispatch.initiated_at ?? new Date().toISOString(),
        failureReason: dispatch.failed_reason ?? null,
      };
      break;
    }
  }
  return { data, meta: value.meta };
}
