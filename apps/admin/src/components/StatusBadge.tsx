interface Props {
  value: string | null | undefined;
}

// Map a status string (booking_status, payment_status, sos_status, user role)
// to one of a small set of visual variants. Unknown values fall through to
// "neutral" so new enum values don't break rendering.
const VARIANT_MAP: Record<string, 'success' | 'warn' | 'danger' | 'info' | 'neutral'> = {
  // booking_status
  pending: 'warn',
  guide_accepted: 'info',
  confirmed: 'success',
  in_progress: 'info',
  completed: 'success',
  cancelled: 'neutral',
  disputed: 'danger',
  chat_open: 'info',
  agreement_drafting: 'warn',
  agreement_sent: 'warn',
  agreement_signed_traveler: 'info',
  agreement_signed_buddy: 'info',
  awaiting_deposits: 'warn',
  deposits_held: 'warn',
  awaiting_balance: 'warn',
  late_fee_due: 'danger',
  balance_paid: 'success',
  trip_ready: 'success',
  awaiting_proofs: 'warn',
  reconciling: 'info',
  rated: 'success',

  // payment_status
  paid: 'success',
  refunded: 'neutral',
  partial_refund: 'warn',
  captured: 'success',
  failed: 'danger',
  initiated: 'info',
  processing: 'info',
  sent: 'info',
  stubbed: 'warn',

  // sos_status
  triggered: 'danger',
  acknowledged: 'warn',
  resolved: 'success',
  dispatching: 'info',
  delivered: 'success',
  partial: 'warn',
  unconfigured: 'neutral',

  // user_role
  admin: 'info',
  guide: 'success',
  traveler: 'neutral',
  owner: 'info',
  operations: 'success',
  finance: 'warn',
  growth: 'info',
  active: 'success',
  inactive: 'neutral',
  suspended: 'danger',
  verified: 'success',
  unverified: 'warn',
  new: 'warn',
  contacted: 'info',
  qualified: 'info',
  converted: 'success',
  closed: 'neutral',
  reviewing: 'info',
  actioned: 'success',
  dismissed: 'neutral',
  critical: 'danger',
  high: 'danger',
  medium: 'warn',
  low: 'info',
  healthy: 'success',
  degraded: 'warn',
  unknown: 'neutral',
};

const CLASSES: Record<string, string> = {
  success: 'bg-success/10 text-success border-success/30',
  warn: 'bg-warn/10 text-warn border-warn/30',
  danger: 'bg-danger/10 text-danger border-danger/30',
  info: 'bg-secondary/10 text-secondary-dark border-secondary/30',
  neutral: 'bg-cream text-muted border-divider',
};

export default function StatusBadge({ value }: Props) {
  if (!value) return <span className="text-muted">—</span>;
  const variant = VARIANT_MAP[value] ?? 'neutral';
  const label = value.replace(/_/g, ' ');
  return (
    <span
      className={[
        'inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-medium border capitalize',
        CLASSES[variant],
      ].join(' ')}
    >
      {label}
    </span>
  );
}
