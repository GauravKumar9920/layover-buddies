import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { EmptyState } from '@/components/ui/EmptyState';
import { Loading } from '@/components/ui/Loading';
import { theme } from '@/config/theme';
import { getItineraryPhoto } from '@/config/photoLibrary';
import { fetchItineraryById } from '@/lib/api/guides';
import { useFavoritesStore } from '@/lib/stores/favorites';
import { useAuth } from '@/lib/hooks/useAuth';
import type { Itinerary } from '@/types';

/**
 * Saved — all the tours a traveler has hearted on the Hinge-style detail page.
 *
 * We don't have a batched `fetchItinerariesByIds` helper yet, so we fire one
 * request per id and Promise.all them. With typical favorite counts (<20)
 * this is fine; if it ever grows, we'll add a bulk endpoint and slot it in.
 */
export default function SavedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const favoriteIds = useFavoritesStore((s) => Array.from(s.ids));
  const hydrated = useFavoritesStore((s) => s.hydrated);

  const [items, setItems] = useState<Itinerary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (favoriteIds.length === 0) {
      setItems([]);
      return;
    }
    const fetched = await Promise.all(
      favoriteIds.map((id) => fetchItineraryById(id).catch(() => null)),
    );
    setItems(
      fetched.filter((i): i is Itinerary => i !== null),
    );
  }, [favoriteIds]);

  useEffect(() => {
    // Wait for the favorites store to hydrate from Supabase before showing
    // the empty state — otherwise signed-in users flash "Nothing saved yet"
    // on first mount.
    if (!hydrated) return;
    load().finally(() => setLoading(false));
  }, [hydrated, load]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  }, [load]);

  if (loading) return <Loading fullScreen message="Loading your saves..." />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <LinearGradient
        colors={theme.gradients.hero}
        style={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 20,
          paddingBottom: 20,
        }}
      >
        <Text
          style={{ color: '#FFFFFF', fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }}
        >
          Saved ♥
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, marginTop: 4 }}>
          {items.length} tour{items.length === 1 ? '' : 's'} you've hearted
        </Text>
      </LinearGradient>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SavedRow
            itinerary={item}
            onPress={() =>
              router.push({ pathname: '/(traveler)/itinerary/[id]', params: { id: item.id } })
            }
          />
        )}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 16, gap: 12 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            title="Nothing saved yet"
            subtitle="Tap the heart on any tour to keep it here for later."
            actionLabel="Browse tours"
            onAction={() => router.replace('/(traveler)')}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

function SavedRow({
  itinerary,
  onPress,
}: {
  itinerary: Itinerary;
  onPress: () => void;
}) {
  const toggle = useFavoritesStore((s) => s.toggle);
  const { session } = useAuth();
  const photo =
    itinerary.cover_image_url ??
    (itinerary.gallery_urls && itinerary.gallery_urls[0]) ??
    getItineraryPhoto(itinerary);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={{
        flexDirection: 'row',
        backgroundColor: theme.colors.surface,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: theme.colors.divider,
        ...theme.shadows.sm,
      }}
    >
      <View style={{ width: 110, height: 110, backgroundColor: theme.colors.primaryLight }}>
        {photo ? (
          <Image
            source={{ uri: photo }}
            contentFit="cover"
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 28 }}>🗺️</Text>
          </View>
        )}
      </View>

      <View style={{ flex: 1, padding: 12, justifyContent: 'space-between' }}>
        <View>
          <Text
            numberOfLines={1}
            style={{ fontSize: 15, fontWeight: '700', color: theme.colors.text }}
          >
            {itinerary.name ?? itinerary.title ?? 'Mumbai Tour'}
          </Text>
          <Text
            numberOfLines={2}
            style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 4, lineHeight: 17 }}
          >
            {itinerary.description || `${itinerary.estimated_duration_hours}h in ${itinerary.city}`}
          </Text>
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 8,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: '800', color: theme.colors.primary }}>
            ₹{itinerary.buddy_cost_inr.toLocaleString('en-IN')}
          </Text>
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation?.();
              void toggle(itinerary.id, session?.user?.id ?? null);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ paddingHorizontal: 4 }}
          >
            <Text style={{ fontSize: 18, color: theme.colors.accent }}>♥</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}
