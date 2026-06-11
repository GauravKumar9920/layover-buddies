import { View, Text, ViewStyle } from 'react-native';
import { BOOKING_STATUS } from '@/config/constants';
import { theme } from '@/config/theme';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'purple';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
}

// Warm Editorial "stamp" tags — tinted paper fills with a hairline border and
// a mono uppercase label, echoing the marketing site's tags.
const BADGE_COLORS: Record<BadgeVariant, { bg: string; text: string; border: string }> = {
  success: { bg: '#DCEAD8', text: '#2F6E45', border: 'rgba(61,139,90,0.30)' },
  warning: { bg: theme.colors.gold + '26', text: '#946312', border: 'rgba(232,159,44,0.35)' },
  error:   { bg: theme.colors.primaryLight, text: '#8E2C20', border: 'rgba(192,57,43,0.30)' },
  info:    { bg: theme.colors.accentLight, text: theme.colors.accentDark, border: 'rgba(45,123,169,0.30)' },
  neutral: { bg: theme.colors.surfaceMuted, text: theme.colors.textSecondary, border: 'rgba(14,25,41,0.12)' },
  purple:  { bg: '#E6E2FA', text: '#4B3FB0', border: 'rgba(108,92,231,0.30)' },
};

export function Badge({ label, variant = 'neutral', style }: BadgeProps) {
  const { bg, text, border } = BADGE_COLORS[variant];
  return (
    <View
      style={[
        {
          backgroundColor: bg,
          borderRadius: theme.borderRadius.sm,
          borderWidth: 1,
          borderColor: border,
          paddingHorizontal: 8,
          paddingVertical: 3,
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      <Text
        style={{
          color: text,
          fontFamily: theme.fonts.monoMed,
          fontSize: 10,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
    </View>
  );
}

/** Maps a booking status string to a Badge variant */
export function bookingStatusVariant(status: string): BadgeVariant {
  switch (status) {
    // Legacy statuses
    case BOOKING_STATUS.PENDING: return 'warning';
    case BOOKING_STATUS.GUIDE_ACCEPTED: return 'info';
    case BOOKING_STATUS.CONFIRMED: return 'success';
    case BOOKING_STATUS.IN_PROGRESS:
    case 'in_progress':
      return 'purple';
    case BOOKING_STATUS.COMPLETED: return 'neutral';

    // Phase-1 financial-lifecycle states
    case 'chat_open':
    case 'agreement_drafting':
    case 'agreement_sent':
      return 'warning';
    case 'agreement_signed_traveler':
    case 'agreement_signed_buddy':
    case 'awaiting_deposits':
      return 'info';
    case 'deposits_held':
    case 'awaiting_balance':
    case 'balance_paid':
    case 'trip_ready':
      return 'success';
    case 'late_fee_due':
      return 'warning';
    case 'awaiting_proofs':
    case 'reconciling':
    case 'rated':
      return 'purple';

    // All cancel variants
    case BOOKING_STATUS.CANCELLED_PRE_SIGNING:
    case BOOKING_STATUS.CANCELLED:
    case 'cancelled_no_pay':
    case 'cancelled_traveler_voluntary':
    case 'cancelled_buddy':
    case 'cancelled_force_majeure':
    case 'cancelled_no_deposit':
      return 'error';

    default: return 'neutral';
  }
}

/** Human-readable label for booking status. Phase-1 states added so the
 *  trip detail header doesn't show raw enum strings like "chat_open" to
 *  end users. */
export function bookingStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    // Legacy
    pending: 'Awaiting Guide',
    guide_accepted: 'Guide Accepted',
    confirmed: 'Confirmed',
    in_progress: 'Happening Now',
    completed: 'Completed',

    // Phase-1
    chat_open: 'Chat Open',
    agreement_drafting: 'Drafting Agreement',
    agreement_sent: 'Agreement Sent',
    agreement_signed_traveler: 'You Signed',
    agreement_signed_buddy: 'Guide Signed',
    awaiting_deposits: 'Awaiting Deposit',
    deposits_held: 'Deposits Secured',
    awaiting_balance: 'Balance Due',
    late_fee_due: 'Late Fee Due',
    balance_paid: 'Fully Paid',
    trip_ready: 'Ready to Go',
    awaiting_proofs: 'Awaiting Expenses',
    reconciling: 'Reconciling',
    rated: 'Rated',

    // Cancellations
    cancelled_pre_signing: 'Cancelled',
    cancelled: 'Cancelled',
    cancelled_no_pay: 'Cancelled',
    cancelled_traveler_voluntary: 'Cancelled',
    cancelled_buddy: 'Cancelled',
    cancelled_force_majeure: 'Cancelled',
    cancelled_no_deposit: 'Cancelled',
  };
  return labels[status] ?? status;
}
