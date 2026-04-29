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
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);
  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  useLayoutEffect(() => {
    opacity.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.ease) });
    translateY.value = withSpring(0, { damping: 20, stiffness: 90, mass: 1 });
  }, []);

  return (
    <Animated.View style={[{ flex: 1 }, animStyle]}>
      <Card style={{ alignItems: 'center', padding: 16 }}>
        <Text style={{ fontSize: 28, fontWeight: '800', color: theme.colors.primary }}>
          {value}
        </Text>
        <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 4, textAlign: 'center' }}>
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
        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>Welcome back,</Text>
        <Text style={{ color: '#FFFFFF', fontSize: 28, fontWeight: '800', letterSpacing: -0.5 }}>
          {guideName} 👋
        </Text>
        {pending.length > 0 && (
          <View
            style={{
              marginTop: 12,
              backgroundColor: theme.colors.accent,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 8,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>
              📬 {pending.length} new booking request{pending.length !== 1 ? 's' : ''}
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
            borderRadius: 16,
            overflow: 'hidden',
            marginBottom: 16,
            borderWidth: 1,
            borderColor: 'rgba(249, 115, 22, 0.2)',
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
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.44)',
              justifyContent: 'flex-end',
              paddingHorizontal: 14,
              paddingVertical: 12,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>Today&apos;s city mood</Text>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 }}>
              Keep routes tight, stories rich, and returns on time.
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
            <Text style={{ fontSize: 18, fontWeight: '700', color: theme.colors.text, marginBottom: 12 }}>
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
            <Text style={{ fontSize: 18, fontWeight: '700', color: theme.colors.text, marginBottom: 12 }}>
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
                style={{ color: theme.colors.primary, textAlign: 'center', marginTop: 8, fontWeight: '600' }}
              >
                View all {pending.length} requests →
              </Text>
            )}
          </View>
        )}

        {bookings.length === 0 && (
          <Card style={{ alignItems: 'center', padding: 32, marginTop: 8 }}>
            <Text style={{ fontSize: 40 }}>🌟</Text>
            <Text style={{ fontSize: 17, fontWeight: '700', color: theme.colors.text, marginTop: 12, textAlign: 'center' }}>
              Ready for your first booking?
            </Text>
            <Text style={{ color: theme.colors.textSecondary, fontSize: 14, marginTop: 6, textAlign: 'center', lineHeight: 20 }}>
              Create your tours in the Tours tab and start accepting travelers!
            </Text>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}
