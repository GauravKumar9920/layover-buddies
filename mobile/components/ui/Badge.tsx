import { View, Text, ViewStyle } from 'react-native';
import { BOOKING_STATUS } from '@/config/constants';
import { theme } from '@/config/theme';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'purple';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
}

const BADGE_COLORS: Record<BadgeVariant, { bg: string; text: string }> = {
  success: { bg: '#DCFCE7', text: theme.colors.success },
  warning: { bg: '#FEF3C7', text: theme.colors.warning },
  error: { bg: '#FFE8E8', text: theme.colors.error },
  info: { bg: theme.colors.primaryLight, text: theme.colors.primary },
  neutral: { bg: '#F3F4F6', text: theme.colors.textSecondary },
  purple: { bg: '#EDE9FE', text: theme.colors.purple },
};

export function Badge({ label, variant = 'neutral', style }: BadgeProps) {
  const { bg, text } = BADGE_COLORS[variant];
  return (
    <View
      style={[
        {
          backgroundColor: bg,
          borderRadius: theme.borderRadius.full,
          paddingHorizontal: 10,
          paddingVertical: 4,
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      <Text style={{ color: text, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

/** Maps a booking status string to a Badge variant */
export function bookingStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case BOOKING_STATUS.PENDING: return 'warning';
    case BOOKING_STATUS.GUIDE_ACCEPTED: return 'info';
    case BOOKING_STATUS.CONFIRMED: return 'success';
    case BOOKING_STATUS.IN_PROGRESS: return 'purple';
    case BOOKING_STATUS.COMPLETED: return 'neutral';
    case BOOKING_STATUS.CANCELLED_PRE_SIGNING:
    case BOOKING_STATUS.CANCELLED: return 'error';
    default: return 'neutral';
  }
}

/** Human-readable label for booking status */
export function bookingStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Awaiting Guide',
    guide_accepted: 'Guide Accepted',
    confirmed: 'Confirmed',
    in_progress: 'Happening Now',
    completed: 'Completed',
    cancelled_pre_signing: 'Cancelled',
    cancelled: 'Cancelled',
  };
  return labels[status] ?? status;
}
