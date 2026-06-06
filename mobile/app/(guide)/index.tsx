import { useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { Card } from '@/components/ui/Card';
import { BookingCard } from '@/components/bookings/BookingCard';
import { Loading } from '@/components/ui/Loading';
import { fetchGuideBookings } from '@/lib/api/bookings';
import { fetchUnreadCounts } from '@/lib/api/messages';
import { supabase } from '@/lib/supabase';
import { theme } from '@/config/theme';
import { getItineraryPhoto } from '@/config/photoLibrary';
import { BOOKING_STATUS } from '@/config/constants';
import type { Booking } from '@/types';

function StatCard({ value, label, delay }: { value: string; label: string; delay: number }) {
  // Slide-up entrance via translateY only — never gate visibility on opacity,
  // so a stalled animation can't leave the stats invisible.
  const translateY = useSharedValue(14);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  useLayoutEffect(() => {
    translateY.value = withSpring(0, { damping: 20, stiffness: 90, mass: 1 });
  }, []);

  return (
    <Animated.View style={[{ flex: 1 }, animStyle]}>
      <Card style={{ alignItems: 'center', padding: 16 }} framed elevation="none">
        <Text style={{ fontFamily: theme.fonts.monoMed, fontSize: 26, color: theme.colors.primary, letterSpacing: -0.5 }}>
          {value}
        </Text>
        <Text style={{ fontFamily: theme.fonts.mono, fontSize: 9.5, color: theme.colors.textSecondary, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 6, textAlign: 'center' }}>
          {label}
        </Text>
      </Card>
    </Animated.View>
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

  // Use Marine Drive as the fixed dashboard hero — seed-based picking from
  // MUMBAI_CITY_PHOTOS can land on non-cityscape photos depending on seed hash.
  const dashboardHeroPhoto = 'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?auto=format&fit=crop&w=1200&q=80';

  const loadData = useCallback(async () => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    const { data: userData } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle();

    if (userData?.full_name) setGuideName(userData.full_name.split(' ')[0]);

    const data = await fetchGuideBookings(user.id);
    setBookings(data);
    const activeIds = data
      .filter((b) => ['guide_accepted', 'confirmed', 'in_progress'].includes(b.status))
      .map((b) => b.id);
    if (activeIds.length > 0) {
      const counts = await fetchUnreadCounts(activeIds);
      setUnreadCounts(counts);
    }
  }, []);

  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData().finally(() => setRefreshing(false));
  };

  if (loading) return <Loading fullScreen />;

  const pending = bookings.filter((b) => b.status === BOOKING_STATUS.PENDING);
  const upcoming = bookings.filter((b) =>
    b.status === BOOKING_STATUS.GUIDE_ACCEPTED || b.status === BOOKING_STATUS.CONFIRMED,
  );
  const completed = bookings.filter((b) => b.status === BOOKING_STATUS.COMPLETED);
  const totalEarnings = completed.reduce((sum, b) => sum + (b.total_price - b.commission), 0);

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
              Keep routes tight, stories rich, returns on time.
            </Text>
          </View>
        </View>

        {/* Stats */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
          <StatCard value={String(completed.length)} label="Tours Done" delay={0} />
          <StatCard value={`₹${(totalEarnings / 1000).toFixed(1)}k`} label="Earned" delay={100} />
          <StatCard value={String(pending.length)} label="Pending" delay={200} />
        </View>

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
