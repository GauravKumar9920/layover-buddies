import { useEffect, useState, useCallback, useMemo } from 'react';
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
import { TimeFitChip } from '@/components/ui/TimeFitChip';
import { useTravelerTrip } from '@/lib/hooks/useTravelerTrip';
import { formatFromPrice } from '@/lib/booking/tourPricing';
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
  const { layoverHours } = useTravelerTrip();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Subscribe to the Set itself, NOT to `Array.from(s.ids)` — that returned a
  // brand-new array on every Zustand notification, which made every dependent
  // hook see a new reference and triggered "Maximum update depth exceeded"
  // (load → useEffect → setLoading → re-render → new array → repeat).
  const favoriteIdsSet = useFavoritesStore((s) => s.ids);
  const hydrated = useFavoritesStore((s) => s.hydrated);
  // Derive a stable array via useMemo keyed on the Set's size+contents.  We
  // intentionally key on a string hash so reordering still triggers reload
  // but identity-preserving updates don't.
  const favoriteIdsKey = useMemo(() => {
    return Array.from(favoriteIdsSet).sort().join(',');
  }, [favoriteIdsSet]);
  const favoriteIds = useMemo(() => Array.from(favoriteIdsSet), [favoriteIdsKey]);

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
  }, [favoriteIdsKey]);

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
          style={{ fontFamily: theme.fonts.display, color: '#FCF7EA', fontSize: 28, letterSpacing: -0.5 }}
        >
          Saved
        </Text>
        <Text style={{ fontFamily: theme.fonts.mono, color: 'rgba(252,247,234,0.7)', fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 6 }}>
          {items.length} tour{items.length === 1 ? '' : 's'} you’ve hearted
        </Text>
      </LinearGradient>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SavedRow
            itinerary={item}
            layoverHours={layoverHours}
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
            // Route to the Explore tab inside the tabs group rather than the
            // ambiguous (traveler) Stack root, so the bottom tab bar stays
            // visible and the active-tab indicator updates correctly.
            onAction={() => router.replace('/(traveler)/(tabs)' as never)}
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
  layoverHours,
}: {
  itinerary: Itinerary;
  onPress: () => void;
  /** Null hides the fit chip — never guess a layover. */
  layoverHours: number | null;
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
        borderRadius: theme.borderRadius.lg,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(14,25,41,0.12)',
        ...theme.shadows.sm,
      }}
    >
      <View style={{ width: 110, height: 110, backgroundColor: theme.colors.surfaceMuted }}>
        {photo ? (
          <Image
            source={{ uri: photo }}
            contentFit="cover"
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: theme.fonts.serif, fontSize: 22, color: theme.colors.textMuted }}>Mumbai</Text>
          </View>
        )}
      </View>

      <View style={{ flex: 1, padding: 12, justifyContent: 'space-between' }}>
        <View>
          <Text
            numberOfLines={1}
            style={{ fontFamily: theme.fonts.displaySemi, fontSize: 15, color: theme.colors.text }}
          >
            {itinerary.name ?? itinerary.title ?? 'Mumbai Tour'}
          </Text>
          <Text
            numberOfLines={2}
            style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textSecondary, marginTop: 4, lineHeight: 17 }}
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
          <Text style={{ fontFamily: theme.fonts.monoMed, fontSize: 15, color: theme.colors.primary }}>
            {formatFromPrice(itinerary.base_cost_inr, itinerary.buddy_cost_inr)}
          </Text>
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation?.();
              void toggle(itinerary.id, session?.user?.id ?? null);
            }}
            accessibilityLabel="Unsave this tour"
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ paddingHorizontal: 4 }}
          >
            {/* Filled-pink heart on a tour the user is *already* saving — the
                tap removes it.  Wrapping a saved-row affordance with the
                same filled glyph makes it clear this is the "active" state
                without ambiguity about whether tap-to-save or tap-to-unsave. */}
            <Text style={{ fontSize: 20, color: theme.colors.accent }}>♥</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}
