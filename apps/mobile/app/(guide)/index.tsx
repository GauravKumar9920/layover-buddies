import { useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import Feather from '@expo/vector-icons/Feather';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
} from 'react-native-reanimated';
import { Card } from '@/components/ui/Card';
import { BookingCard } from '@/components/bookings/BookingCard';
import { Loading } from '@/components/ui/Loading';
import { fetchGuideDashboardData } from '@/lib/api/guideDashboard';
import { fetchUnreadCounts } from '@/lib/api/messages';
import { supabase } from '@/lib/supabase';
import { theme } from '@/config/theme';
import {
  isActiveBookingState,
  isUpcomingBookingState,
} from '@/lib/booking/stateMachine';
import { getBookingCta } from '@/lib/booking/cta';
import { expectedNetPaise } from '@/lib/api/earnings';
import type { GuideInsights } from '@/lib/guide/metrics';
import type { Booking } from '@/types';
import type { BookingState } from '@/lib/booking/stateMachine';

function StatCard({ value, label, delay, onPress }: { value: string; label: string; delay: number; onPress?: () => void }) {
  // Slide-up entrance via translateY only — never gate visibility on opacity,
  // so a stalled animation can't leave the stats invisible.
  const translateY = useSharedValue(14);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  useLayoutEffect(() => {
    translateY.value = withDelay(
      delay,
      withSpring(0, { damping: 20, stiffness: 90, mass: 1 }),
    );
  }, [delay, translateY]);

  return (
    <Animated.View style={[{ flex: 1 }, animStyle]}>
      <Card style={{ alignItems: 'center', padding: 16 }} framed elevation="none" onPress={onPress}>
        <Text style={{ fontFamily: theme.fonts.monoMed, fontSize: 26, color: theme.colors.primary, letterSpacing: -0.5 }}>
          {value}
        </Text>
        <Text style={{ fontFamily: theme.fonts.mono, fontSize: 9.5, color: theme.colors.textSecondary, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 6, textAlign: 'center' }}>
          {label}
        </Text>
        {onPress && (
          <Text style={{ fontFamily: theme.fonts.mono, fontSize: 9, color: theme.colors.textMuted, marginTop: 4 }}>
            View →
          </Text>
        )}
      </Card>
    </Animated.View>
  );
}

function formatResponseTime(minutes: number | null): string {
  if (minutes === null) return 'New';
  if (minutes < 60) return `${minutes}m`;
  return `${Math.round(minutes / 60)}h`;
}

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      activeOpacity={0.75}
      style={{ flex: 1, alignItems: 'center', gap: 8, minHeight: 78 }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.primaryLight,
          borderWidth: 1,
          borderColor: 'rgba(200,84,42,0.2)',
        }}
      >
        <Feather name={icon} size={19} color={theme.colors.primaryDark} />
      </View>
      <Text
        style={{
          fontFamily: theme.fonts.bodySemi,
          fontSize: 11,
          color: theme.colors.text,
          textAlign: 'center',
          lineHeight: 15,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function PerformanceSnapshot({
  insights,
  onPress,
}: {
  insights: GuideInsights;
  onPress: () => void;
}) {
  const conversion = insights.performance.conversionRate;
  const rating = insights.performance.totalReviews
    ? insights.performance.avgRating.toFixed(1)
    : 'New';
  return (
    <Card onPress={onPress} style={{ marginBottom: 20, padding: 0, overflow: 'hidden' }} framed>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingTop: 15,
          paddingBottom: 12,
        }}
      >
        <View>
          <Text style={{ ...theme.typography.eyebrow, color: theme.colors.primary }}>
            Your momentum
          </Text>
          <Text style={{ fontFamily: theme.fonts.display, fontSize: 19, color: theme.colors.text, marginTop: 3 }}>
            Buddy performance
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={{ fontFamily: theme.fonts.bodyBold, fontSize: 12, color: theme.colors.primary }}>
            Insights
          </Text>
          <Feather name="arrow-up-right" size={15} color={theme.colors.primary} />
        </View>
      </View>
      <View style={{ height: 1, backgroundColor: theme.colors.divider }} />
      <View style={{ flexDirection: 'row', padding: 16 }}>
        <MetricCell
          value={conversion === null ? '—' : `${conversion}%`}
          label="Booking conversion"
        />
        <MetricCell
          value={formatResponseTime(insights.performance.responseTimeMinutes)}
          label="Average reply"
          bordered
        />
        <MetricCell value={rating} label="Traveler rating" bordered />
      </View>
    </Card>
  );
}

function MetricCell({
  value,
  label,
  bordered = false,
}: {
  value: string;
  label: string;
  bordered?: boolean;
}) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: 8,
        borderLeftWidth: bordered ? 1 : 0,
        borderLeftColor: theme.colors.divider,
      }}
    >
      <Text style={{ fontFamily: theme.fonts.monoMed, fontSize: 20, color: theme.colors.text }}>
        {value}
      </Text>
      <Text
        style={{
          fontFamily: theme.fonts.mono,
          fontSize: 8.5,
          lineHeight: 12,
          letterSpacing: 0.45,
          textTransform: 'uppercase',
          color: theme.colors.textMuted,
          textAlign: 'center',
          marginTop: 5,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export default function GuideDashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [guideName, setGuideName] = useState('Guide');
  const [guideUserId, setGuideUserId] = useState<string | null>(null);
  const [insights, setInsights] = useState<GuideInsights | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Use Marine Drive as the fixed dashboard hero — seed-based picking from
  // MUMBAI_CITY_PHOTOS can land on non-cityscape photos depending on seed hash.
  const dashboardHeroPhoto = 'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?auto=format&fit=crop&w=1200&q=80';

  const loadData = useCallback(async () => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;
    setLoadError(null);
    const dashboard = await fetchGuideDashboardData(user.id);
    setGuideUserId(user.id);
    setGuideName(dashboard.firstName);
    setBookings(dashboard.bookings);
    setInsights(dashboard.insights);
    // Any non-terminal booking can carry unread messages, not just the three
    // legacy states — same fix as the traveler trips list (review 2026-05-14).
    const activeIds = dashboard.bookings.filter((b) => isActiveBookingState(b.status)).map((b) => b.id);
    if (activeIds.length > 0) {
      const counts = await fetchUnreadCounts(activeIds);
      setUnreadCounts(counts);
    } else {
      setUnreadCounts({});
    }
  }, []);

  useEffect(() => {
    loadData()
      .catch(() => setLoadError('Your dashboard could not refresh. Pull down to try again.'))
      .finally(() => setLoading(false));
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData()
      .catch(() => setLoadError('Your dashboard could not refresh. Pull down to try again.'))
      .finally(() => setRefreshing(false));
  };

  if (loading) return <Loading fullScreen />;

  // Partition on the Phase 1+ lifecycle instead of the legacy three-state
  // whitelist, which left the dashboard empty for every modern booking
  // (chat_open, agreement_*, awaiting_*, balance_paid, trip_ready…).
  // Only chat_open is a genuine new request: legacy 'pending' maps to the
  // Agreement stage post-migration (like agreement_sent) and is not fetched by
  // the Requests screen, so counting it here would dead-end into an empty list.
  const REQUEST_STATES: BookingState[] = ['chat_open'];
  const pending = bookings.filter((b) => REQUEST_STATES.includes(b.status));
  const upcoming = bookings.filter(
    (b) => isUpcomingBookingState(b.status) && !REQUEST_STATES.includes(b.status),
  );
  const completed = bookings.filter((b) => b.status === 'completed' || b.status === 'rated');
  // Net buddy fee (platform-down + TDS), in rupees — NOT total_price − commission,
  // which would wrongly count the traveler's expense pot as guide income.
  const totalEarnings = completed.reduce((sum, b) => sum + expectedNetPaise(b) / 100, 0);
  // "Action needed" — every booking whose buddy CTA is an enabled *action*
  // (draft agreement, sign, pay deposit, scan QR, upload proofs…). Driven
  // entirely by cta.ts so this list stays in lock-step with the lifecycle;
  // primary/warning variants are the "you must act" ones — success/info are
  // confirmations, not chores.
  const actionNeeded = bookings
    .map((b) => ({ booking: b, cta: getBookingCta(b.status, 'buddy') }))
    .filter(({ booking: b, cta }) =>
      isActiveBookingState(b.status)
      && Boolean(cta.label)
      && !cta.disabled
      && cta.route !== null
      && (cta.variant === 'primary' || cta.variant === 'warning'),
    );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <LinearGradient
        colors={theme.gradients.hero}
        style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 24 }}
      >
        <Text style={{ fontFamily: theme.fonts.mono, color: 'rgba(252,247,234,0.7)', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase' }}>Welcome back,</Text>
        <Text style={{ fontFamily: theme.fonts.displayX, color: '#FCF7EA', fontSize: 32, letterSpacing: -0.6, marginTop: 4 }}>
          {guideName}
        </Text>
        {pending.length > 0 && (
          <View
            style={{
              marginTop: 14,
              alignSelf: 'flex-start',
              backgroundColor: theme.colors.primary,
              borderWidth: 1.5,
              borderColor: theme.colors.primaryDark,
              borderRadius: theme.borderRadius.sm,
              paddingHorizontal: 12,
              paddingVertical: 8,
            }}
          >
            <Text style={{ fontFamily: theme.fonts.bodyBold, color: '#FCF7EA', fontSize: 13 }}>
              {pending.length} new booking request{pending.length !== 1 ? 's' : ''}
            </Text>
          </View>
        )}
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            borderRadius: theme.borderRadius.lg,
            overflow: 'hidden',
            marginBottom: 16,
            borderWidth: 1.5,
            borderColor: theme.colors.inkLine,
          }}
        >
          <Image
            source={{ uri: dashboardHeroPhoto }}
            style={{ width: '100%', height: 140 }}
            contentFit="cover"
            transition={250}
          />
          <View
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(14,25,41,0.46)',
              justifyContent: 'flex-end',
              paddingHorizontal: 14,
              paddingVertical: 12,
            }}
          >
            <Text style={{ fontFamily: theme.fonts.display, color: '#FCF7EA', fontSize: 17, letterSpacing: -0.2 }}>Today&apos;s city mood</Text>
            <Text style={{ fontFamily: theme.fonts.mono, color: 'rgba(252,247,234,0.85)', fontSize: 10.5, letterSpacing: 0.3, textTransform: 'uppercase', marginTop: 5 }}>
              {insights
                ? `${insights.pipeline.openInquiries} open inquiries · ${insights.pipeline.upcomingTrips} trips in motion`
                : 'Keep routes tight, stories rich, returns on time.'}
            </Text>
          </View>
        </View>

        {loadError ? (
          <Card style={{ marginBottom: 16, borderColor: 'rgba(184,64,51,0.35)' }} elevation="none">
            <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.error }}>
              {loadError}
            </Text>
          </Card>
        ) : null}

        <Text style={{ ...theme.typography.eyebrow, color: theme.colors.textMuted, marginBottom: 10 }}>
          Quick actions
        </Text>
        <Card style={{ flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 15, marginBottom: 20 }} elevation="none">
          <QuickAction
            icon="plus-circle"
            label="New experience"
            onPress={() => router.push('/(guide)/itineraries/create' as never)}
          />
          <QuickAction
            icon="inbox"
            label="View requests"
            onPress={() => router.push('/(guide)/requests' as never)}
          />
          <QuickAction
            icon="edit-3"
            label="Edit profile"
            onPress={() => router.push('/(guide)/profile/edit' as never)}
          />
          <QuickAction
            icon="eye"
            label="Traveler view"
            onPress={() =>
              guideUserId && router.push(`/(traveler)/guide/${guideUserId}` as never)
            }
          />
        </Card>

        {/* Stats */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
          <StatCard value={String(completed.length)} label="Tours Done" delay={0} />
          <StatCard
            value={`₹${(totalEarnings / 1000).toFixed(1)}k`}
            label="Earned"
            delay={100}
            onPress={() => router.push('/(guide)/earnings' as never)}
          />
          <StatCard value={String(pending.length)} label="Pending" delay={200} />
        </View>

        {insights ? (
          <PerformanceSnapshot
            insights={insights}
            onPress={() => router.push('/(guide)/insights' as never)}
          />
        ) : null}

        {/* Action needed — the one next step per booking, straight from cta.ts */}
        {actionNeeded.length > 0 && (
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontFamily: theme.fonts.display, fontSize: 20, color: theme.colors.text, letterSpacing: -0.3, marginBottom: 12 }}>
              Action needed
            </Text>
            {actionNeeded.slice(0, 4).map(({ booking: b, cta }) => (
              <Card
                key={b.id}
                onPress={() => router.push(`/(guide)/bookings/${b.id}` as never)}
                style={{ marginBottom: 10, padding: 14 }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: theme.fonts.bodySemi, fontSize: 14, color: theme.colors.text }}>
                      {b.traveler?.name ?? 'Traveler'}
                    </Text>
                    <Text style={{ fontFamily: theme.fonts.mono, fontSize: 10.5, color: theme.colors.textMuted, letterSpacing: 0.3, textTransform: 'uppercase', marginTop: 3 }}>
                      {b.itinerary?.name ?? 'Tour'}
                    </Text>
                  </View>
                  <View
                    style={{
                      backgroundColor: theme.colors.primaryLight,
                      borderWidth: 1,
                      borderColor: 'rgba(200,84,42,0.3)',
                      borderRadius: theme.borderRadius.full,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                    }}
                  >
                    <Text style={{ fontFamily: theme.fonts.monoMed, fontSize: 10, color: theme.colors.primaryDark, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                      {cta.label}
                    </Text>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* Upcoming Tours */}
        {upcoming.length > 0 && (
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontFamily: theme.fonts.display, fontSize: 20, color: theme.colors.text, letterSpacing: -0.3, marginBottom: 12 }}>
              Upcoming Tours
            </Text>
            {upcoming.slice(0, 3).map((b) => (
              <BookingCard
                key={b.id}
                booking={b}
                showGuide={false}
                showTraveler
                unreadCount={unreadCounts[b.id] ?? 0}
                onPress={() => router.push(`/(guide)/bookings/${b.id}` as never)}
              />
            ))}
          </View>
        )}

        {/* Pending Requests */}
        {pending.length > 0 && (
          <View>
            <Text style={{ fontFamily: theme.fonts.display, fontSize: 20, color: theme.colors.text, letterSpacing: -0.3, marginBottom: 12 }}>
              New Requests
            </Text>
            {pending.slice(0, 3).map((b) => (
              <BookingCard
                key={b.id}
                booking={b}
                showGuide={false}
                showTraveler
                onPress={() => router.push('/(guide)/requests')}
              />
            ))}
            {pending.length > 3 && (
              <Text
                onPress={() => router.push('/(guide)/requests')}
                style={{ fontFamily: theme.fonts.bodyBold, color: theme.colors.primary, textAlign: 'center', marginTop: 10 }}
              >
                View all {pending.length} requests →
              </Text>
            )}
          </View>
        )}

        {bookings.length === 0 && (
          <Card style={{ alignItems: 'center', padding: 32, marginTop: 8 }} framed elevation="none">
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <Text style={{ fontFamily: theme.fonts.serif, fontSize: 26, color: '#FCF7EA' }}>★</Text>
            </View>
            <Text style={{ fontFamily: theme.fonts.display, fontSize: 19, color: theme.colors.text, letterSpacing: -0.3, marginTop: 2, textAlign: 'center' }}>
              Ready for your first booking?
            </Text>
            <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.textSecondary, fontSize: 14, marginTop: 8, textAlign: 'center', lineHeight: 20 }}>
              Create your tours in the Tours tab and start accepting travelers.
            </Text>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}
