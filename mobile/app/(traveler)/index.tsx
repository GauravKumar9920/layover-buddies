import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GuideCard } from '@/components/guides/GuideCard';
import { GuideCardSkeleton } from '@/components/ui/Loading';
import { EmptyState } from '@/components/ui/EmptyState';
import { fetchActiveGuides } from '@/lib/api/guides';
import { signOut } from '@/lib/auth';
import { useAuth } from '@/lib/hooks/useAuth';
import { theme } from '@/config/theme';
import { PRIMARY_CITY } from '@/config/constants';
import type { GuideProfile } from '@/types';

const SKILL_FILTERS = ['All', 'Food', 'History', 'Bollywood', 'Markets', 'Photography'];

export default function BrowseScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const firstName = user?.user_metadata?.full_name?.split(' ')[0] ?? 'Traveler';

  const [guides, setGuides] = useState<GuideProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const loadGuides = useCallback(async () => {
    try {
      const data = await fetchActiveGuides(PRIMARY_CITY);
      setGuides(data);
    } catch {
      // EmptyState handles the empty list
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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
      {/* ── Sticky white header — matches UI kit ── */}
      <View style={{
        backgroundColor: theme.colors.surface,
        paddingTop: insets.top + 8,
        paddingBottom: 12,
        paddingHorizontal: 20,
        shadowColor: theme.colors.text,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 4,
      }}>
        {/* Top row: greeting + sign out */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <View>
            <Text style={{ fontSize: 11, color: theme.colors.textMuted, fontWeight: '500', letterSpacing: 0.3 }}>
              Good day, {firstName} ✈️
            </Text>
            <Text style={{
              fontSize: 22, fontWeight: '800', color: theme.colors.text,
              letterSpacing: -0.4, marginTop: 1,
            }}>
              Find your Buddy
            </Text>
          </View>
          <TouchableOpacity
            onPress={signOut}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{
              width: 40, height: 40, borderRadius: 12,
              backgroundColor: theme.colors.primaryLight,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            {/* Bell / notification icon */}
            <Text style={{ fontSize: 18 }}>🔔</Text>
          </TouchableOpacity>
        </View>

        {/* Search bar */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 10,
          backgroundColor: theme.colors.background,
          borderWidth: 1.5, borderColor: theme.colors.divider,
          borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11,
        }}>
          <Text style={{ fontSize: 16, color: theme.colors.textMuted }}>🔍</Text>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search guides, experiences…"
            placeholderTextColor={theme.colors.textMuted}
            style={{ flex: 1, fontSize: 14, color: theme.colors.text, padding: 0 }}
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
                  paddingHorizontal: 16, paddingVertical: 7,
                  borderRadius: theme.borderRadius.full,
                  backgroundColor: active ? theme.colors.primary : theme.colors.surface,
                  borderWidth: active ? 0 : 1.5,
                  borderColor: theme.colors.divider,
                  shadowColor: active ? theme.colors.primary : 'transparent',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: active ? 0.30 : 0,
                  shadowRadius: 8,
                  elevation: active ? 3 : 0,
                }}
              >
                <Text style={{
                  fontSize: 12, fontWeight: '700',
                  color: active ? '#FFFFFF' : theme.colors.textSecondary,
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
          renderItem={({ item, index }) => <GuideCard guide={item} index={index} />}
          contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 24 }}
          ListHeaderComponent={
            <Text style={{
              fontSize: 11, fontWeight: '600', color: theme.colors.textMuted,
              textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12,
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
