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
import {
  isActiveBookingState,
  isUpcomingBookingState,
  PAST_BOOKING_STATES,
} from '@/lib/booking/stateMachine';

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
    // Phase 1+ lifecycle has many non-terminal in-flight states (chat_open,
    // agreement_*, awaiting_*, balance_paid, trip_ready, etc.). Any of them
    // can have unread messages, not just the three legacy states.
    const activeIds = data.filter((b) => isActiveBookingState(b.status)).map((b) => b.id);
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

  // Partition by terminal-state membership instead of an enumerated whitelist.
  // The previous whitelist `['pending','guide_accepted','confirmed','in_progress']`
  // silently dropped every Phase 1+ state (chat_open, agreement_drafting,
  // awaiting_deposits, balance_paid, trip_ready, etc.), so a brand-new traveler
  // with a brand-new booking saw "No trips yet". (Review 2026-05-14 #20.)
  const upcoming = bookings.filter((b) => isUpcomingBookingState(b.status));
  const past = bookings.filter((b) => PAST_BOOKING_STATES.has(b.status));

  if (loading) return <Loading fullScreen message="Loading your trips..." />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <LinearGradient
        colors={theme.gradients.hero}
        style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 20 }}
      >
        <Text style={{ fontFamily: theme.fonts.display, color: '#FCF7EA', fontSize: 28, letterSpacing: -0.5 }}>
          My trips
        </Text>
        <Text style={{ fontFamily: theme.fonts.mono, color: 'rgba(252,247,234,0.7)', fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 6 }}>
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
              <Text style={{ ...theme.typography.eyebrow, color: theme.colors.textMuted }}>
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
            onAction={() => router.replace('/(traveler)/(tabs)' as never)}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
