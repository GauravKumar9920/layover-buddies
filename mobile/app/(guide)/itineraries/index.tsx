import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, Alert, RefreshControl, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Loading } from '@/components/ui/Loading';
import { getItineraryPhoto } from '@/config/photoLibrary';
import { fetchGuideItineraries } from '@/lib/api/guides';
import { updateItinerary, deleteItinerary } from '@/lib/api/itineraries';
import { supabase } from '@/lib/supabase';
import { theme } from '@/config/theme';
import type { Itinerary } from '@/types';

export default function ItinerariesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadItineraries = useCallback(async () => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    const data = await fetchGuideItineraries(user.id, true);
    setItineraries(data);
  }, []);

  useEffect(() => {
    loadItineraries().finally(() => setLoading(false));
  }, [loadItineraries]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadItineraries().finally(() => setRefreshing(false));
  };

  async function toggleActive(itin: Itinerary) {
    const newVal = !itin.is_active;
    try {
      await updateItinerary(itin.id, { is_active: newVal });
      setItineraries((prev) => prev.map((i) => i.id === itin.id ? { ...i, is_active: newVal } : i));
    } catch (err: unknown) {
      Alert.alert('Update failed', err instanceof Error ? err.message : 'Could not update tour state');
    }
  }

  async function handleDelete(itinId: string) {
    Alert.alert('Delete Tour', 'Are you sure? This will hide the tour from travelers.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteItinerary(itinId);
            setItineraries((prev) => prev.filter((i) => i.id !== itinId));
          } catch (err: unknown) {
            Alert.alert('Delete failed', err instanceof Error ? err.message : 'Could not delete tour');
          }
        },
      },
    ]);
  }

  if (loading) return <Loading fullScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top }}>
      <Header
        title="My Tours"
        rightAction={
          <TouchableOpacity
            onPress={() => router.push('/(guide)/itineraries/create')}
            style={{
              backgroundColor: theme.colors.primary,
              borderRadius: theme.borderRadius.md,
              paddingHorizontal: 12,
              paddingVertical: 6,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600' }}>+ New Tour</Text>
          </TouchableOpacity>
        }
      />

      <FlatList
        data={itineraries}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.colors.primary} />}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 16 }}
        ListEmptyComponent={
          <EmptyState
            title="No tours yet"
            subtitle="Create your first tour itinerary so travelers can book you!"
            actionLabel="Create Tour"
            onAction={() => router.push('/(guide)/itineraries/create')}
          />
        }
        renderItem={({ item }) => (
          <Card style={{ marginBottom: 16 }}>
            {getItineraryPhoto(item) && (
              <View style={{ height: 120, borderRadius: 12, overflow: 'hidden', marginBottom: 10 }}>
                <Image
                  source={{ uri: getItineraryPhoto(item) as string }}
                  contentFit="cover"
                  transition={250}
                  style={{ width: '100%', height: '100%' }}
                />
              </View>
            )}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: theme.colors.text }}>
                  {item.name ?? item.title ?? 'City Tour'}
                </Text>
                <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 }}>
                  📍 {item.city}  ·  ⏱ {item.estimated_duration_hours}h  ·  👥 Max {item.max_travelers}
                </Text>
              </View>
              <Text style={{ fontSize: 18, fontWeight: '800', color: theme.colors.primary }}>
                ₹{item.buddy_cost_inr.toLocaleString('en-IN')}
              </Text>
            </View>

            {item.description && (
              <Text style={{ fontSize: 13, color: theme.colors.textMuted, marginTop: 8, lineHeight: 18 }} numberOfLines={2}>
                {item.description}
              </Text>
            )}

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
              <Badge label={item.is_active ? 'Active' : 'Paused'} variant={item.is_active ? 'success' : 'neutral'} />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button title={item.is_active ? 'Pause' : 'Activate'} onPress={() => toggleActive(item)} variant="secondary" size="sm" />
                <Button title="Edit" onPress={() => router.push(`/(guide)/itineraries/${item.id}`)} variant="secondary" size="sm" />
                <Button title="Delete" onPress={() => handleDelete(item.id)} variant="danger" size="sm" />
              </View>
            </View>
          </Card>
        )}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
