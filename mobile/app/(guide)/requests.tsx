import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, Alert, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Loading } from '@/components/ui/Loading';
import { fetchPendingRequests, acceptBooking, declineBooking } from '@/lib/api/bookings';
import { supabase } from '@/lib/supabase';
import { theme } from '@/config/theme';
import { format } from 'date-fns';
import type { Booking } from '@/types';

export default function RequestsScreen() {
  const insets = useSafeAreaInsets();
  const [requests, setRequests] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        setRequests([]);
        setLoadError('Please sign in again to view booking requests.');
        return;
      }

      const data = await fetchPendingRequests(user.id);
      setRequests(data);
      setLoadError(null);
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load requests');
    }
  }, []);

  useEffect(() => {
    loadRequests().finally(() => setLoading(false));
  }, [loadRequests]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadRequests().finally(() => setRefreshing(false));
  };

  async function handleAccept(bookingId: string) {
    setActionId(bookingId);
    try {
      await acceptBooking(bookingId);
      setRequests((prev) => prev.filter((r) => r.id !== bookingId));
      Alert.alert('✅ Accepted!', "The traveler will be notified. Payment will be captured on confirmation.");
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to accept');
    } finally {
      setActionId(null);
    }
  }

  async function handleDecline(bookingId: string) {
    Alert.alert(
      'Decline Request',
      'Are you sure you want to decline this booking?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            setActionId(bookingId);
            try {
              await declineBooking(bookingId);
              setRequests((prev) => prev.filter((r) => r.id !== bookingId));
            } catch (err: unknown) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to decline');
            } finally {
              setActionId(null);
            }
          },
        },
      ],
    );
  }

  if (loading) return <Loading fullScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top }}>
      <Header
        title={`Booking Requests${requests.length > 0 ? ` (${requests.length})` : ''}`}
      />

      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.colors.primary} />
        }
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 16 }}
        ListHeaderComponent={loadError ? (
          <Card style={{ marginBottom: 12, borderWidth: 1, borderColor: '#FCA5A5' }}>
            <Text style={{ fontSize: 13, color: theme.colors.error }}>
              {loadError}
            </Text>
          </Card>
        ) : null}
        ListEmptyComponent={
          <EmptyState
            title="No pending requests"
            subtitle="New booking requests will appear here. Make sure your profile and tours are active!"
          />
        }
        renderItem={({ item }) => (
          <Card style={{ marginBottom: 16 }}>
            {/* Traveler Info */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <View>
                <Text style={{ fontSize: 16, fontWeight: '700', color: theme.colors.text }}>
                  {item.traveler?.name ?? 'Traveler'}
                </Text>
                {item.traveler?.nationality && (
                  <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 }}>
                    🌍 {item.traveler.nationality}
                  </Text>
                )}
              </View>
              <Badge label="New Request" variant="warning" />
            </View>

            {/* Tour Details */}
            <View
              style={{
                backgroundColor: theme.colors.primaryLight,
                borderRadius: theme.borderRadius.md,
                padding: 12,
                marginBottom: 12,
                gap: 6,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.primary }}>
                {item.itinerary?.name ?? 'Tour'}
              </Text>
              <Text style={{ fontSize: 13, color: theme.colors.textSecondary }}>
                📅 {format(new Date(item.start_date), 'EEE, MMM d, yyyy')}
              </Text>
              {item.flight_number && (
                <Text style={{ fontSize: 13, color: theme.colors.textSecondary }}>
                  ✈️ Flight: {item.flight_number}
                </Text>
              )}
              <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.primary, marginTop: 4 }}>
                ₹{(item.total_price - item.commission).toLocaleString('en-IN')} your payout
              </Text>
              <Text style={{ fontSize: 11, color: theme.colors.textMuted }}>
                After 25% platform fee
              </Text>
            </View>

            {/* Actions */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button
                title="✓ Accept"
                onPress={() => handleAccept(item.id)}
                loading={actionId === item.id}
                style={{ flex: 1 }}
                size="sm"
              />
              <Button
                title="Decline"
                onPress={() => handleDecline(item.id)}
                variant="danger"
                style={{ flex: 1 }}
                size="sm"
                disabled={actionId === item.id}
              />
            </View>
          </Card>
        )}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
