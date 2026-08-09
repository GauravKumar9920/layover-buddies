import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { GuideCard } from '@/components/guides/GuideCard';
import { GuideCardSkeleton } from '@/components/ui/Loading';
import { EmptyState } from '@/components/ui/EmptyState';
import { fetchActiveGuides } from '@/lib/api/guides';
import { fetchMyTravelerProfile, type TravelerProfile } from '@/lib/api/travelerProfile';
import { rankGuides, layoverHoursBetween } from '@/lib/booking/timeFit';
import { formatMumbaiShortDate } from '@/lib/dateTime';
import { useAuth } from '@/lib/hooks/useAuth';
import { theme } from '@/config/theme';
import { PRIMARY_CITY } from '@/config/constants';
import type { GuideProfile } from '@/types';

// Filter terms picked to actually match the `skills[].name` values that
// `fetchActiveGuides` falls back to when the `categories` column is null
// (which is the case for every seeded guide). Previously included
// "Bollywood" and "Markets" — neither matches any guide's skill, so those
// chips silently returned "No guides found" for everyone.
const SKILL_FILTERS = ['All', 'Food', 'History', 'Culture', 'Photography', 'Hidden Gems', 'Adventure'];

// Distance (px) of scroll over which the greeting block folds away, leaving
// the search bar + filter chips pinned.
const GREETING_COLLAPSE_RANGE = 80;
const GREETING_HEIGHT = 56;

export default function BrowseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const firstName = user?.user_metadata?.full_name?.split(' ')[0] ?? 'Traveler';

  const [guides, setGuides] = useState<GuideProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  // Traveler's onboarding answers — interests soft-rank the list, layover
  // window powers the layover chip and per-card time-fit stamps.
  const [travelerProfile, setTravelerProfile] = useState<TravelerProfile | null>(null);

  // Greeting collapses as the list scrolls; search + chips stay pinned.
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  const greetingStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      scrollY.value,
      [0, GREETING_COLLAPSE_RANGE],
      [0, 1],
      'clamp',
    );
    // Animate only opacity + translateY (not height/marginBottom): the header
    // sits above the FlatList, so animating its layout height off the list's
    // own scroll offset shrinks maxScroll and creates a scroll feedback loop
    // (visible jitter on short lists). Keep the container a fixed height and
    // just fade/lift the greeting — the house pattern used by the other
    // collapsing headers (guide/[id], book/[guideId], itinerary/[id]).
    return {
      opacity: 1 - progress,
      transform: [{ translateY: -GREETING_HEIGHT * progress }],
    };
  });

  const loadGuides = useCallback(async () => {
    try {
      const [data, profile] = await Promise.all([
        fetchActiveGuides(PRIMARY_CITY),
        fetchMyTravelerProfile().catch(() => null),
      ]);
      setTravelerProfile(profile);
      // Apply soft ranking before storing so the rest of the screen sees the
      // already-sorted list — categories filter still works on top.
      setGuides(rankGuides(data, profile?.interests));
    } catch {
      // EmptyState handles the empty list
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Layover window in hours — powers the header chip + GuideCard time-fit stamps.
  const layoverHours = layoverHoursBetween(
    travelerProfile?.arrival_at,
    travelerProfile?.departure_at,
  );

  useEffect(() => {
    setLoading(true);
    loadGuides();
  }, [loadGuides]);

  function handleRefresh() {
    setRefreshing(true);
    loadGuides();
  }

  const isFiltered = Boolean(searchQuery) || activeFilter !== 'All';

  const filteredGuides = guides.filter((g) => {
    const term = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !term ||
      [
        g.name,
        g.bio ?? '',
        g.university ?? '',
        g.hometown ?? '',
        ...(g.languages ?? []),
        ...(g.categories ?? []),
      ].some((value) => value.toLowerCase().includes(term));
    const matchesFilter =
      activeFilter === 'All' ||
      g.categories?.some((c) => c.toLowerCase().includes(activeFilter.toLowerCase()));
    return matchesSearch && matchesFilter;
  });

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {/* ── Sticky paper header with an ink hairline ── */}
      <View style={{
        backgroundColor: theme.colors.surface,
        paddingTop: insets.top + 8,
        paddingBottom: 14,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(14,25,41,0.12)',
      }}>
        {/* Greeting — fades/lifts away on scroll. Sign-out lives on the Profile tab. */}
        <Animated.View style={[{ height: GREETING_HEIGHT, marginBottom: 12, overflow: 'hidden' }, greetingStyle]}>
          <Text style={{ ...theme.typography.eyebrow, color: theme.colors.textMuted }}>
            Good day, {firstName}
          </Text>
          <Text style={{
            fontFamily: theme.fonts.display, fontSize: 26, color: theme.colors.text,
            letterSpacing: -0.4, marginTop: 3,
          }}>
            Find your Buddy
          </Text>
        </Animated.View>

        {/* Layover chip — the traveler's window at a glance; tap to edit in Profile. */}
        {layoverHours !== null && travelerProfile?.arrival_at && (
          <TouchableOpacity
            onPress={() => router.push('/(traveler)/(tabs)/profile' as never)}
            accessibilityRole="button"
            accessibilityLabel="Edit your layover window in Profile"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              alignSelf: 'flex-start',
              gap: 6,
              backgroundColor: theme.colors.surfaceMuted,
              borderWidth: 1,
              borderColor: theme.colors.divider,
              borderRadius: theme.borderRadius.full,
              paddingHorizontal: 12,
              paddingVertical: 6,
              marginBottom: 12,
            }}
          >
            <Text style={{ fontSize: 11 }}>⏱</Text>
            <Text style={{ fontFamily: theme.fonts.monoMed, fontSize: 11, color: theme.colors.text, letterSpacing: 0.4, textTransform: 'uppercase' }}>
              {Math.round(layoverHours)}h in Mumbai · {formatMumbaiShortDate(travelerProfile.arrival_at)}
            </Text>
            <Text style={{ fontFamily: theme.fonts.mono, fontSize: 11, color: theme.colors.textMuted }}>›</Text>
          </TouchableOpacity>
        )}

        {/* Search bar */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 10,
          backgroundColor: theme.colors.background,
          borderWidth: 1.5, borderColor: 'rgba(14,25,41,0.16)',
          borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
        }}>
          <Text style={{ fontSize: 16, color: theme.colors.textMuted }}>⌕</Text>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search guides, experiences…"
            placeholderTextColor={theme.colors.textMuted}
            style={{ flex: 1, fontFamily: theme.fonts.body, fontSize: 14, color: theme.colors.text, padding: 0 }}
          />
        </View>

        {/* Skill filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 12 }}
          contentContainerStyle={{ gap: 8 }}
        >
          {SKILL_FILTERS.map((filter) => {
            const active = activeFilter === filter;
            return (
              <TouchableOpacity
                key={filter}
                onPress={() => setActiveFilter(filter)}
                style={{
                  paddingHorizontal: 15, paddingVertical: 7,
                  borderRadius: theme.borderRadius.full,
                  backgroundColor: active ? theme.colors.primary : theme.colors.surface,
                  borderWidth: 1.5,
                  borderColor: active ? theme.colors.primaryDark : 'rgba(14,25,41,0.14)',
                }}
              >
                <Text style={{
                  fontFamily: theme.fonts.bodySemi, fontSize: 12,
                  color: active ? '#FCF7EA' : theme.colors.textSecondary,
                }}>
                  {filter}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Guide list ── */}
      {loading ? (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {[1, 2, 3].map((i) => <GuideCardSkeleton key={i} />)}
        </ScrollView>
      ) : (
        <Animated.FlatList
          data={filteredGuides}
          keyExtractor={(item) => item.id}
          onScroll={onScroll}
          scrollEventThrottle={16}
          renderItem={({ item, index }) => (
            <GuideCard
              guide={item}
              index={index}
              travelerInterests={travelerProfile?.interests}
              layoverHours={layoverHours}
            />
          )}
          contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 24 }}
          ListHeaderComponent={
            <Text style={{
              ...theme.typography.eyebrow, color: theme.colors.textMuted, marginBottom: 12,
            }}>
              {filteredGuides.length} guide{filteredGuides.length !== 1 ? 's' : ''} available
            </Text>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.primary}
            />
          }
          ListEmptyComponent={
            isFiltered ? (
              <EmptyState
                title="No matches for that filter"
                subtitle="Try a different search or category — every guide hides somewhere."
                actionLabel="Clear filters"
                onAction={() => {
                  setSearchQuery('');
                  setActiveFilter('All');
                }}
              />
            ) : (
              <EmptyState
                title="No guides found"
                subtitle="Check back soon — more student guides are joining the platform!"
              />
            )
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}
