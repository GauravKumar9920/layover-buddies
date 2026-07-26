// ============================================================================
// TripTimeline — the booking journey, visualised
// ============================================================================
// One component for both sides of the marketplace:
//   - traveler trip detail  app/(traveler)/trips/[id].tsx   (viewer='traveler')
//   - guide booking detail  app/(guide)/bookings/[id].tsx   (viewer='buddy')
//
// Collapses the 25-state lifecycle into the 7 human stages from
// lib/booking/tripStages.ts, draws a progress rail with stage dots, and
// renders the single next action from lib/booking/cta.ts underneath. The two
// screens therefore always mirror each other: same rail, same stage,
// role-appropriate CTA.
//
// Cancelled/disputed bookings render a banner instead of the rail.
// ============================================================================

import { useEffect } from 'react';
import { Text, TouchableOpacity, View, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Card } from '@/components/ui/Card';
import { theme } from '@/config/theme';
import { hapticImpactMedium } from '@/lib/haptics';
import { getBookingCta, type Viewer } from '@/lib/booking/cta';
import { TRIP_STAGES, isJourneyComplete, stageForState } from '@/lib/booking/tripStages';
import type { BookingState } from '@/lib/booking/stateMachine';

export interface TripTimelineProps {
  bookingId: string;
  status: BookingState;
  viewer: Viewer;
  style?: ViewStyle;
}

const DOT_SIZE = 16;
const RAIL_INSET = DOT_SIZE / 2;

// v3 mapping of cta.ts variants → warm-editorial button styling.
const VARIANT_STYLES: Record<string, { bg: string; fg: string; border: string }> = {
  primary:   { bg: theme.colors.primary,      fg: '#FCF7EA',                  border: theme.colors.primaryDark },
  secondary: { bg: theme.colors.surfaceMuted, fg: theme.colors.text,          border: theme.colors.divider },
  info:      { bg: theme.colors.surfaceMuted, fg: theme.colors.textSecondary, border: theme.colors.divider },
  success:   { bg: 'rgba(61,139,90,0.14)',    fg: theme.colors.success,       border: 'rgba(61,139,90,0.35)' },
  warning:   { bg: 'rgba(232,159,44,0.16)',   fg: '#8A5A0F',                  border: 'rgba(232,159,44,0.45)' },
  danger:    { bg: 'rgba(192,57,43,0.12)',    fg: theme.colors.error,         border: 'rgba(192,57,43,0.35)' },
};

function StageDot({ state }: { state: 'done' | 'current' | 'todo' }) {
  const scale = useSharedValue(state === 'current' ? 0 : 1);

  useEffect(() => {
    if (state === 'current') {
      scale.value = withDelay(250, withSpring(1, { damping: 15, stiffness: 150 }));
    }
  }, [state]);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const base: ViewStyle = {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  };

  if (state === 'done') {
    return (
      <View style={[base, { backgroundColor: theme.colors.inkLine, borderColor: theme.colors.inkLine }]}>
        <Text style={{ color: '#FCF7EA', fontSize: 8.5, lineHeight: 10, fontFamily: theme.fonts.bodyBold }}>✓</Text>
      </View>
    );
  }

  if (state === 'current') {
    return (
      <Animated.View
        style={[
          base,
          animStyle,
          {
            backgroundColor: theme.colors.primary,
            borderColor: theme.colors.primaryDark,
            // A soft terracotta halo so the "you are here" dot reads instantly.
            shadowColor: theme.colors.primary,
            shadowOpacity: 0.45,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 0 },
            elevation: 3,
          },
        ]}
      >
        <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#FCF7EA' }} />
      </Animated.View>
    );
  }

  return <View style={[base, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.divider }]} />;
}

function ProgressRail({ currentIndex, complete }: { currentIndex: number; complete: boolean }) {
  // Fraction of the rail that reads "done": all segments before the current
  // dot (or the whole rail once the journey is complete).
  const stageCount = TRIP_STAGES.length;
  const fraction = complete ? 1 : currentIndex / (stageCount - 1);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(fraction, { duration: 650 });
  }, [fraction]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <View style={{ height: DOT_SIZE, justifyContent: 'center' }}>
      {/* base rail */}
      <View
        style={{
          position: 'absolute',
          left: RAIL_INSET,
          right: RAIL_INSET,
          height: 2,
          backgroundColor: theme.colors.divider,
        }}
      />
      {/* animated done-fill */}
      <View style={{ position: 'absolute', left: RAIL_INSET, right: RAIL_INSET, height: 2 }}>
        <Animated.View style={[{ height: 2, backgroundColor: theme.colors.inkLine }, fillStyle]} />
      </View>
      {/* dots */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {TRIP_STAGES.map((stage, i) => {
          const state = complete || i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'todo';
          return <StageDot key={stage.id} state={state} />;
        })}
      </View>
    </View>
  );
}

export function TripTimeline({ bookingId, status, viewer, style }: TripTimelineProps) {
  const router = useRouter();
  const cta = getBookingCta(status, viewer);
  const position = stageForState(status);
  const complete = isJourneyComplete(status);

  const handlePress = () => {
    if (cta.disabled || !cta.route) return;
    hapticImpactMedium();
    // cta.ts routes use both `[bookingId]` and `[id]` placeholders (e.g.
    // `/(traveler)/trips/live/[id]`) — substitute whichever is present.
    const path = cta.route.pathname.replace('[bookingId]', bookingId).replace('[id]', bookingId);
    router.push(path as never);
  };

  const variantStyles = VARIANT_STYLES[cta.variant] ?? VARIANT_STYLES.info;

  const ctaButton = cta.label ? (
    <TouchableOpacity
      onPress={handlePress}
      disabled={cta.disabled || !cta.route}
      activeOpacity={cta.disabled ? 1 : 0.75}
      style={{
        backgroundColor: variantStyles.bg,
        borderWidth: 1.5,
        borderColor: variantStyles.border,
        paddingHorizontal: 16,
        paddingVertical: 13,
        borderRadius: theme.borderRadius.md,
        alignItems: 'center',
        opacity: cta.disabled ? 0.9 : 1,
      }}
    >
      <Text style={{ fontFamily: theme.fonts.bodySemi, fontSize: 15, color: variantStyles.fg }}>
        {cta.label}
      </Text>
    </TouchableOpacity>
  ) : null;

  // ── Off-the-rail bookings: cancelled / disputed banner ─────────────────────
  if (position.status !== 'active') {
    const isCancelled = position.status === 'cancelled';
    return (
      <Card style={{ marginBottom: 16, padding: 16, ...style }} framed elevation="none">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: cta.label ? 12 : 0 }}>
          <View
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isCancelled ? 'rgba(192,57,43,0.12)' : 'rgba(45,123,169,0.12)',
            }}
          >
            <Text style={{ fontSize: 12, color: isCancelled ? theme.colors.error : theme.colors.accent }}>
              {isCancelled ? '✕' : '⚖'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: theme.fonts.displaySemi, fontSize: 15, color: theme.colors.text }}>
              {isCancelled ? 'This booking was cancelled' : 'This booking is under review'}
            </Text>
            <Text style={{ fontFamily: theme.fonts.mono, fontSize: 10.5, color: theme.colors.textMuted, letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 3 }}>
              {isCancelled ? 'The journey ended early' : 'Our team is looking into it'}
            </Text>
          </View>
        </View>
        {ctaButton}
      </Card>
    );
  }

  // ── Active bookings: rail + current stage + next action ────────────────────
  const currentStage = TRIP_STAGES[position.index];
  const nextStage = TRIP_STAGES[position.index + 1];

  return (
    <Card style={{ marginBottom: 16, padding: 16, ...style }} framed elevation="none">
      <Text style={{ ...theme.typography.eyebrow, color: theme.colors.textSecondary, marginBottom: 14 }}>
        Trip journey
      </Text>

      <ProgressRail currentIndex={position.index} complete={complete} />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 10, marginBottom: cta.label ? 14 : 0 }}>
        <Text style={{ fontFamily: theme.fonts.monoMed, fontSize: 11, color: theme.colors.primary, letterSpacing: 1.2, textTransform: 'uppercase' }}>
          {complete
            ? 'Journey complete'
            : `Step ${position.index + 1} of ${TRIP_STAGES.length} · ${currentStage.label}`}
        </Text>
        {!complete && nextStage && (
          <Text style={{ fontFamily: theme.fonts.mono, fontSize: 10, color: theme.colors.textMuted, letterSpacing: 0.4, textTransform: 'uppercase' }}>
            Next: {nextStage.label}
          </Text>
        )}
      </View>

      {ctaButton}
    </Card>
  );
}
