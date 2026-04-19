import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BookingCard } from '@/components/bookings/BookingCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Loading } from '@/components/ui/Loading';
import { fetchTravelerBookings } from '@/lib/api/bookings';
import { fetchUnreadCounts } from '@/lib/api/messages';
import { supabase } from '@/lib/supabase';
import { theme } from '@/config/theme';
import type { Booking } from '@/types';

export default function TripsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadBookings = useCallback(async () => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;
    const data = await fetchTravelerBookings(user.id);
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
    loadBookings().finally(() => setLoading(false));
  }, [loadBookings]);

  function handleRefresh() {
    setRefreshing(true);
    loadBookings().finally(() => setRefreshing(false));
  }

  const upcoming = bookings.filter((b) =>
    ['pending', 'guide_accepted', 'confirmed', 'in_progress'].includes(b.status),
  );
  const past = bookings.filter((b) => ['completed', 'declined', 'cancelled'].includes(b.status));

  if (loading) return <Loading fullScreen message="Loading your trips..." />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <LinearGradient
        colors={theme.gradients.hero}
        style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 20 }}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }}>
          My Trips 🎒
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, marginTop: 4 }}>
          {bookings.length} total · {upcoming.length} upcoming
        </Text>
      </LinearGradient>

      <FlatList
        data={[...upcoming, ...past]}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <BookingCard
            booking={item}
            onPress={() => router.push(`/(traveler)/trips/${item.id}`)}
            unreadCount={unreadCounts[item.id] ?? 0}
          />
        )}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.colors.primary} />
        }
        ListHeaderComponent={
          upcoming.length > 0 && past.length > 0 ? (
            <View style={{ paddingBottom: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                Upcoming
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            title="No trips yet"
            subtitle="Book a guide to start exploring!"
            actionLabel="Browse Guides"
            onAction={() => router.replace('/(traveler)')}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
