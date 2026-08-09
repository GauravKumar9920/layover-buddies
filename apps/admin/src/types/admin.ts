export type AdminRole = 'owner' | 'operations' | 'finance' | 'growth';
export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type HealthState = 'healthy' | 'degraded' | 'failed' | 'unconfigured' | 'unknown';

export interface ApiMeta {
  generatedAt?: string;
  nextCursor?: string | null;
  warnings?: string[];
  freshness?: Record<string, string | null>;
  total?: number;
}

export interface ApiFailure {
  code: string;
  message: string;
}

export interface ApiEnvelope<T> {
  data: T | null;
  error: ApiFailure | null;
  meta?: ApiMeta;
}

export interface AdminSession {
  userId: string;
  email: string;
  role: AdminRole;
  mfaRequired: boolean;
  aal: 'aal1' | 'aal2';
}

export interface PageRequest {
  cursor?: string;
  pageSize?: number;
  status?: string;
  query?: string;
}

export interface PageData<T> {
  items: T[];
  total?: number;
}

export interface ActionItem {
  id: string;
  kind: string;
  severity: Severity;
  title: string;
  description?: string;
  owner?: { id: string; name: string } | null;
  createdAt: string;
  ageSeconds: number;
  slaSeconds: number;
  dueAt?: string | null;
  nextAction: string;
  href: string;
}

export interface FunnelStep {
  label: string;
  value: number;
  changePercent?: number | null;
}

export interface OverviewData {
  metrics: {
    travelers: number;
    buddies: number;
    openInquiries: number;
    activeTrips: number;
    completedTrips: number;
    websiteLeads: number;
  };
  funnel: FunnelStep[];
  todayTrips: BookingSummary[];
  actionCounts?: Record<string, number>;
}

export interface PersonSummary {
  id: string;
  fullName?: string | null;
  email?: string | null;
  role?: string;
  avatarUrl?: string | null;
}

export interface UserSummary extends PersonSummary {
  isVerified?: boolean | null;
  isBanned?: boolean;
  joinedAt?: string;
  profileCompleteness?: number | null;
  totalTrips?: number | null;
  rating?: number | null;
  responseTimeMinutes?: number | null;
  university?: string | null;
  nationality?: string | null;
  lastActiveAt?: string | null;
}

export interface UserDetail extends UserSummary {
  phone?: string | null;
  bio?: string | null;
  languages?: unknown[];
  safetyFlags?: string[];
  stats?: Record<string, number>;
  recentBookings?: BookingSummary[];
  reviews?: Array<{ id: string; rating: number; comment?: string | null; createdAt: string }>;
  verification?: Record<string, boolean | null>;
}

export interface BookingSummary {
  id: string;
  status: string;
  paymentStatus?: string | null;
  traveler?: PersonSummary | null;
  buddy?: PersonSummary | null;
  itineraryTitle?: string | null;
  arrivalTime?: string | null;
  departureTime?: string | null;
  tripStartsAt?: string | null;
  createdAt: string;
  totalPaise?: number | null;
  proofsDueAt?: string | null;
  updatedAt?: string | null;
}

export interface TimelineEvent {
  id: string;
  type: string;
  title: string;
  description?: string | null;
  occurredAt: string;
  status?: string | null;
  actor?: PersonSummary | null;
  amountPaise?: number | null;
}

export interface BookingDetail extends BookingSummary {
  flights?: {
    arrivalNumber?: string | null;
    departureNumber?: string | null;
  };
  tourStartTime?: string | null;
  tourEndTime?: string | null;
  agreement?: Record<string, unknown> | null;
  deposits?: Array<Record<string, unknown>>;
  payments?: Array<Record<string, unknown>>;
  expenseProofs?: Array<Record<string, unknown>>;
  payouts?: Array<Record<string, unknown>>;
  messages?: Array<Record<string, unknown>>;
  timeline: TimelineEvent[];
  financials?: Record<string, number | null>;
}

export interface LeadSummary {
  id: string;
  requestType: string;
  status: string;
  contactName?: string | null;
  contactEmail?: string | null;
  landingPage?: string | null;
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  owner?: PersonSummary | null;
  createdAt: string;
  updatedAt?: string;
  linkedBookingId?: string | null;
  linkedUserId?: string | null;
}

export interface SosSummary {
  id: string;
  status: string;
  dispatchStatus?: string | null;
  dispatchAttempts?: number;
  dispatchLastError?: string | null;
  triggeredAt: string;
  resolvedAt?: string | null;
  bookingId: string;
  triggeredBy?: PersonSummary | null;
  latitude?: number | null;
  longitude?: number | null;
  resolutionNotes?: string | null;
}

export interface ReportSummary {
  id: string;
  status: string;
  reason: string;
  details?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
  reporter?: PersonSummary | null;
  reportedUser?: PersonSummary | null;
  bookingId?: string | null;
  adminNotes?: string | null;
}

export interface DisputeSummary {
  id: string;
  status: 'disputed';
  traveler: PersonSummary;
  guide: PersonSummary;
  createdAt: string;
  updatedAt?: string | null;
  reports: Array<{ id: string; status: string; reason: string; createdAt: string }>;
  paymentStatus?: string | null;
  totalAmount?: number | null;
}

export interface MoneyRow {
  id: string;
  kind: string;
  status: string;
  amountPaise: number;
  bookingId?: string | null;
  person?: PersonSummary | null;
  occurredAt: string;
  failureReason?: string | null;
}

export interface FinanceSummary {
  capturedPaise: number;
  refundedPaise: number;
  payoutPaise: number;
  platformRevenuePaise: number;
  pendingPaise: number;
  reconciliationDeltaPaise: number;
  periodStart?: string;
  periodEnd?: string;
}

export interface DeploymentSummary {
  id: string;
  documentId?: string | null;
  documentTitle?: string | null;
  version?: string | null;
  status: string;
  requestedBy?: PersonSummary | null;
  requestedAt: string;
  completedAt?: string | null;
  previewUrl?: string | null;
  productionUrl?: string | null;
  error?: string | null;
}

export interface HealthCheck {
  id: string;
  label: string;
  state: HealthState;
  message?: string | null;
  checkedAt?: string | null;
  href?: string | null;
}

export interface PlatformHealth {
  checks: HealthCheck[];
}

export interface AuditEntry {
  id: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  reason?: string | null;
  actor?: PersonSummary | null;
  createdAt: string;
  before?: unknown;
  after?: unknown;
}

export interface AdminMember {
  id: string;
  userId: string;
  email?: string | null;
  role: AdminRole;
  active: boolean;
  invitedAt?: string | null;
  lastSeenAt?: string | null;
}

export interface SettingsData {
  earlyAccessMode: boolean;
  platformFeeUpRate: number;
  platformFeeDownRate: number;
  commissionRate: number;
  gstRate: number;
  tdsRate: number;
  lateFeePaise: number;
  updatedAt?: string | null;
  currentContentDeploymentId?: string | null;
}

export interface GrowthMetric {
  key: string;
  label: string;
  value: number;
  previousValue?: number | null;
  changePercent?: number | null;
  format?: 'number' | 'percent' | 'duration';
}

export interface GrowthRow {
  dimensions: Record<string, string>;
  metrics: Record<string, number>;
}

export interface GrowthReportData {
  report: 'overview' | 'acquisition' | 'content' | 'search' | 'health';
  metrics: GrowthMetric[];
  rows: GrowthRow[];
  funnel?: FunnelStep[];
  opportunities?: Array<{ id: string; title: string; description: string; priority: Severity; href?: string }>;
  providers?: Array<{ name: string; state: HealthState; dataAvailableSince?: string | null; updatedAt?: string | null; message?: string | null }>;
}

export interface SearchResult {
  id: string;
  type: 'booking' | 'user' | 'lead' | 'report' | 'sos';
  title: string;
  subtitle?: string | null;
  href: string;
}

export interface OperationMap {
  'session.get': { input: undefined; output: AdminSession };
  'overview.get': { input: undefined; output: OverviewData };
  'actions.list': { input: PageRequest; output: PageData<ActionItem> };
  'users.list': { input: PageRequest; output: PageData<UserSummary> };
  'users.get': { input: { id: string }; output: UserDetail };
  'users.suspension': { input: UserSuspensionInput; output: UserSuspensionResult };
  'bookings.list': { input: PageRequest; output: PageData<BookingSummary> };
  'bookings.get': { input: { id: string }; output: BookingDetail };
  'inquiries.list': { input: PageRequest; output: PageData<BookingSummary> };
  'live-trips.list': { input: PageRequest; output: PageData<BookingSummary> };
  'disputes.list': { input: PageRequest; output: PageData<DisputeSummary> };
  'disputes.resolve': { input: DisputeResolutionInput; output: BookingSummary };
  'sos.list': { input: PageRequest; output: PageData<SosSummary> };
  'sos.transition': { input: SosTransitionInput; output: SosSummary };
  'reports.list': { input: PageRequest; output: PageData<ReportSummary> };
  'reports.transition': { input: ReportTransitionInput; output: ReportSummary };
  'leads.list': { input: PageRequest; output: PageData<LeadSummary> };
  'leads.update': { input: LeadUpdateInput; output: LeadSummary };
  'finance.summary': { input: { startDate?: string; endDate?: string }; output: FinanceSummary };
  'payments.list': { input: PageRequest; output: PageData<MoneyRow> };
  'payouts.list': { input: PageRequest; output: PageData<MoneyRow> };
  'payouts.retry': { input: MoneyCommandInput; output: MoneyRow };
  'refunds.issue': { input: MoneyCommandInput; output: MoneyRow };
  'cancellations.list': { input: PageRequest; output: PageData<BookingSummary> };
  'content.deployments.list': { input: PageRequest; output: PageData<DeploymentSummary> };
  'platform.health': { input: undefined; output: PlatformHealth };
  'audit.list': { input: PageRequest; output: PageData<AuditEntry> };
  'admins.list': { input: PageRequest; output: PageData<AdminMember> };
  'admins.membership.update': { input: MembershipUpdateInput; output: AdminMember };
  'settings.get': { input: undefined; output: SettingsData };
  'settings.update': { input: SettingsUpdateInput; output: SettingsData };
  'search.global': { input: { query: string; limit?: number }; output: PageData<SearchResult> };
}

export interface SosTransitionInput {
  id: string;
  status: string;
  reason: string;
  resolutionNotes?: string;
  idempotencyKey: string;
}

export interface ReportTransitionInput {
  id: string;
  status: string;
  reason: string;
  adminNotes?: string;
  idempotencyKey: string;
}

export interface DisputeResolutionInput {
  id: string;
  resolution: 'resume_reconciliation' | 'cancel_force_majeure';
  reason: string;
  idempotencyKey: string;
}

export interface MoneyCommandInput {
  id: string;
  reason: string;
  idempotencyKey: string;
}

export interface LeadUpdateInput {
  id: string;
  status: string;
  ownerId?: string;
  linkedUserId?: string | null;
  linkedBookingId?: string | null;
  reason: string;
  idempotencyKey: string;
}

export interface UserSuspensionInput {
  id: string;
  suspended: boolean;
  reason: string;
  idempotencyKey: string;
}

export interface UserSuspensionResult {
  id: string;
  isBanned: boolean;
  bannedAt: string | null;
  bannedReason: string | null;
  authBanEnforced: boolean;
  auditId: string;
  idempotent: boolean;
}

export interface MembershipUpdateInput {
  id: string;
  role?: AdminRole;
  active?: boolean;
  reason: string;
  idempotencyKey: string;
}

export type SettingsUpdateInput = SettingsData & {
  reason: string;
  idempotencyKey: string;
  contentDeploymentId?: string;
};

export type OperationName = keyof OperationMap;
export type OperationInput<K extends OperationName> = OperationMap[K]['input'];
export type OperationOutput<K extends OperationName> = OperationMap[K]['output'];

export interface GrowthReportRequest {
  report: GrowthReportData['report'];
  startDate: string;
  endDate: string;
  limit?: number;
}
