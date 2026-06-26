import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BookingCard } from '@/components/bookings/BookingCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Loading } from '@/components/ui/Loading';
import { fetchInbox, fetchUnreadCounts } from '@/lib/api/messages';
import { supabase } from '@/lib/supabase';
import { theme } from '@/config/theme';
import type { Booking } from '@/types';

/**
 * Shared Inbox screen — surfaces every booking the user can hold a
 * conversation in (across both traveler-side and guide-side bookings).
 *
 * Reachable from both tab bars via the thin re-export wrappers at:
 *   - mobile/app/(traveler)/messages/index.tsx
 *   - mobile/app/(guide)/messages/index.tsx
 *
 * Tapping a row navigates to the existing conversation screen at
 * mobile/app/(shared)/messages/[bookingId].tsx — the messaging surface
 * that already powers booking-detail "Message Guide / Traveler" buttons.
 */
export default function InboxScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadInbox = useCallback(async () => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;
    setCurrentUserId(user.id);

    const data = await fetchInbox(user.id);
    setBookings(data);

    if (data.length > 0) {
      const counts = await fetchUnreadCounts(data.map((b) => b.id));
      setUnreadCounts(counts);
    } else {
      setUnreadCounts({});
    }
  }, []);

  useEffect(() => {
    loadInbox().finally(() => setLoading(false));
  }, [loadInbox]);

  function handleRefresh() {
    setRefreshing(true);
    loadInbox().finally(() => setRefreshing(false));
  }

  if (loading) return <Loading fullScreen message="Loading your inbox..." />;

  const totalUnread = Object.values(unreadCounts).reduce((sum, n) => sum + n, 0);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <LinearGradient
        colors={theme.gradients.hero}
        style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 20 }}
      >
        <Text style={{ fontFamily: theme.fonts.display, color: '#FCF7EA', fontSize: 28, letterSpacing: -0.5 }}>
          Inbox
        </Text>
        <Text style={{ fontFamily: theme.fonts.mono, color: 'rgba(252,247,234,0.7)', fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 6 }}>
          {bookings.length === 0
            ? 'Conversations will appear here'
            : `${bookings.length} conversation${bookings.length === 1 ? '' : 's'}${
                totalUnread > 0 ? ` · ${totalUnread} unread` : ''
              }`}
        </Text>
      </LinearGradient>

      <FlatList
        data={bookings}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          // The conversation partner is the *other* party — show whichever
          // role this user is NOT in this booking.
          const isTraveler = currentUserId === item.traveler_id;
          return (
            <BookingCard
              booking={item}
              showGuide={isTraveler}
              showTraveler={!isTraveler}
              onPress={() => router.push(`/(shared)/messages/${item.id}`)}
              unreadCount={unreadCounts[item.id] ?? 0}
            />
          );
        }}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.colors.primary} />
        }
        ListEmptyComponent={
          <EmptyState
            title="No conversations yet"
            subtitle="Once you have a confirmed booking, your messages with the other person will appear here."
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
