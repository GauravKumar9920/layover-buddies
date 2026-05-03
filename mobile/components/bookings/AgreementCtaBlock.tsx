// ============================================================================
// AgreementCtaBlock — Phase 2
// ============================================================================
// Status-conditional Agreement & Deposit CTA, used by both
//   - mobile/app/(traveler)/trips/[id].tsx
//   - mobile/app/(guide)/bookings/[id].tsx
//
// All status→label/route logic lives in `mobile/lib/booking/cta.ts` (which
// is unit-tested in cta.test.ts). This component just renders the result.
// Returns null when there's no Phase 2 CTA for the given status × viewer
// (e.g. after `awaiting_balance`, where the existing pre-Phase-2 detail
// screens show their own CTAs).
// ============================================================================

import { Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Card } from '@/components/ui/Card';
import { theme } from '@/config/theme';
import { getBookingCta, type Viewer } from '@/lib/booking/cta';
import type { BookingState } from '@/lib/booking/stateMachine';

export interface AgreementCtaBlockProps {
  bookingId: string;
  bookingStatus: BookingState;
  viewer: Viewer;
}

export function AgreementCtaBlock({ bookingId, bookingStatus, viewer }: AgreementCtaBlockProps) {
  const router = useRouter();
  const cta = getBookingCta(bookingStatus, viewer);

  if (!cta.label) return null;

  const variantStyles = {
    primary:   { bg: theme.colors.primary, fg: '#FFFFFF' },
    secondary: { bg: theme.colors.surfaceMuted ?? '#F5F5F5', fg: theme.colors.text },
    info:      { bg: theme.colors.surfaceMuted ?? '#F5F5F5', fg: theme.colors.textSecondary },
    success:   { bg: '#DCFCE7', fg: '#166534' },
  }[cta.variant];

  const handlePress = () => {
    if (cta.disabled || !cta.route) return;
    // Map the abstract path with `[bookingId]` placeholder to a real router path.
    const path = cta.route.pathname.replace('[bookingId]', bookingId);
    router.push(path as never);
  };

  return (
    <Card style={{ marginBottom: 16, padding: 16 }}>
      <Text style={{
        fontSize: 13, fontWeight: '700',
        color: theme.colors.textSecondary, letterSpacing: 0.4,
        marginBottom: 10,
      }}>
        AGREEMENT &amp; DEPOSIT
      </Text>
      <TouchableOpacity
        onPress={handlePress}
        disabled={cta.disabled || !cta.route}
        activeOpacity={cta.disabled ? 1 : 0.7}
        style={{
          backgroundColor: variantStyles.bg,
          paddingHorizontal: 16, paddingVertical: 14,
          borderRadius: theme.borderRadius.md,
          alignItems: 'center',
          opacity: cta.disabled ? 0.85 : 1,
        }}
      >
        <Text style={{ fontSize: 15, fontWeight: '600', color: variantStyles.fg }}>
          {cta.label}
        </Text>
      </TouchableOpacity>
    </Card>
  );
}
