import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GuideCard } from '@/components/guides/GuideCard';
import { GuideCardSkeleton } from '@/components/ui/Loading';
import { EmptyState } from '@/components/ui/EmptyState';
import { fetchActiveGuides } from '@/lib/api/guides';
import { signOut } from '@/lib/auth';
import { theme } from '@/config/theme';
import { PRIMARY_CITY } from '@/config/constants';
import type { GuideProfile } from '@/types';

export default function BrowseScreen() {
  const insets = useSafeAreaInsets();
  const [guides, setGuides] = useState<GuideProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadGuides = useCallback(async () => {
    try {
      const data = await fetchActiveGuides(PRIMARY_CITY);
      setGuides(data);
    } catch {
      // Silently fail — EmptyState handles it
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

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {/* Hero Header */}
      <LinearGradient
        colors={theme.gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 24 }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>
            Good day, Traveler 👋
          </Text>
          <TouchableOpacity onPress={signOut} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>Sign Out</Text>
          </TouchableOpacity>
        </View>
        <Text
          style={{
            color: '#FFFFFF',
            fontSize: 28,
            fontWeight: '800',
            letterSpacing: -0.5,
            marginBottom: 4,
          }}
        >
          Find Your Mumbai Buddy
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14 }}>
          Student guides for authentic Mumbai local experiences
        </Text>

        <View
          style={{
            marginTop: 16,
            alignSelf: 'flex-start',
            backgroundColor: '#FFFFFF',
            borderRadius: theme.borderRadius.full,
            paddingHorizontal: 14,
            paddingVertical: 7,
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.primary }}>
            Serving: {PRIMARY_CITY} only
          </Text>
        </View>
      </LinearGradient>

      {/* Guide List */}
      {loading ? (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {[1, 2, 3].map((i) => <GuideCardSkeleton key={i} />)}
        </ScrollView>
      ) : (
        <FlatList
          data={guides}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => <GuideCard guide={item} index={index} />}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 16 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              title="No guides yet"
              subtitle="Be the first to explore! Check back soon as more student guides join the platform."
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}
