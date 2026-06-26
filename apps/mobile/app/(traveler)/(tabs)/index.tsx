import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GuideCard } from '@/components/guides/GuideCard';
import { GuideCardSkeleton } from '@/components/ui/Loading';
import { EmptyState } from '@/components/ui/EmptyState';
import { fetchActiveGuides } from '@/lib/api/guides';
import { fetchMyTravelerProfile, type TravelerProfile } from '@/lib/api/travelerProfile';
import { rankGuides, interestOverlap, layoverHoursBetween } from '@/lib/booking/timeFit';
import { signOut } from '@/lib/auth';
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

export default function BrowseScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const firstName = user?.user_metadata?.full_name?.split(' ')[0] ?? 'Traveler';

  const [guides, setGuides] = useState<GuideProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  // Traveler's onboarding answers — interests soft-rank the list, layover
  // window powers the time-fit chip on each itinerary card.
  const [travelerProfile, setTravelerProfile] = useState<TravelerProfile | null>(null);

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

  // Layover window in hours — used by GuideCard time-fit chips.
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

  const filteredGuides = guides.filter((g) => {
    const matchesSearch =
      !searchQuery ||
      g.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.bio?.toLowerCase().includes(searchQuery.toLowerCase());
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
        {/* Top row: greeting + sign out */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <View>
            <Text style={{ ...theme.typography.eyebrow, color: theme.colors.textMuted }}>
              Good day, {firstName}
            </Text>
            <Text style={{
              fontFamily: theme.fonts.display, fontSize: 26, color: theme.colors.text,
              letterSpacing: -0.4, marginTop: 3,
            }}>
              Find your Buddy
            </Text>
          </View>
          <TouchableOpacity
            // Tap is a sign-out — confirm first because the icon used to be a
            // bell and several users tapped it expecting notifications.  Glyph
            // is now ↪ to match the action.
            onPress={async () => {
              const confirm = await new Promise<boolean>((resolve) => {
                if (Platform.OS === 'web') {
                  resolve(window.confirm('Sign out of Detour?'));
                  return;
                }
                Alert.alert('Sign out?', '', [
                  { text: 'Stay', style: 'cancel', onPress: () => resolve(false) },
                  { text: 'Sign out', style: 'destructive', onPress: () => resolve(true) },
                ], { onDismiss: () => resolve(false) });
              });
              if (confirm) signOut();
            }}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{
              width: 40, height: 40, borderRadius: 12,
              backgroundColor: theme.colors.primaryLight,
              borderWidth: 1, borderColor: 'rgba(200,84,42,0.3)',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 17, color: theme.colors.primaryDark }}>↪</Text>
          </TouchableOpacity>
        </View>

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
        <FlatList
          data={filteredGuides}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <GuideCard
              guide={item}
              index={index}
              travelerInterests={travelerProfile?.interests}
              layoverHours={layoverHours}
              // No itinerary data on this card today, so fall back to a
              // reasonable shortest-tour assumption. Soft signal — caller
              // can override if they have richer per-guide tour data.
              shortestTourHours={3}
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
            <EmptyState
              title="No guides found"
              subtitle={
                searchQuery || activeFilter !== 'All'
                  ? 'Try a different search or filter.'
                  : 'Check back soon — more student guides are joining the platform!'
              }
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}
