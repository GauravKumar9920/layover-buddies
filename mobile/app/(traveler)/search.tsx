import { useState } from 'react';
import { View, FlatList, Text } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Input } from '@/components/ui/Input';
import { GuideCard } from '@/components/guides/GuideCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Loading } from '@/components/ui/Loading';
import { Header } from '@/components/ui/Header';
import { searchGuides } from '@/lib/api/guides';
import { theme } from '@/config/theme';
import { getItineraryPhoto } from '@/config/photoLibrary';
import type { GuideProfile } from '@/types';

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GuideProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const heroPhoto =
    getItineraryPhoto({ id: 'traveler-search-hero', city: 'Mumbai', category: 'culture', name: 'Search Hero' }) ??
    'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?auto=format&fit=crop&w=1200&q=80';

  async function handleSearch(text: string) {
    setQuery(text);
    if (text.trim().length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    setLoading(true);
    setHasSearched(true);
    try {
      const data = await searchGuides(text.trim());
      setResults(data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top }}>
      <Header title="Search Guides" />

      <View
        style={{
          marginHorizontal: 16,
          marginBottom: 12,
          borderRadius: 16,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: 'rgba(13, 115, 119, 0.18)',
        }}
      >
        <Image
          source={{ uri: heroPhoto }}
          style={{ width: '100%', height: 120 }}
          contentFit="cover"
          transition={250}
        />
        <View
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.42)',
            justifyContent: 'flex-end',
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>Find a local by vibe, not just name</Text>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 }}>
            Try searching: street food, art walks, architecture
          </Text>
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
        <Input
          placeholder="Search by name..."
          value={query}
          onChangeText={handleSearch}
          autoCapitalize="none"
        />
      </View>

      {loading ? (
        <Loading message="Searching guides..." />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => <GuideCard guide={item} index={index} />}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 16 }}
          ListEmptyComponent={
            hasSearched ? (
              <EmptyState
                title="No guides found"
                subtitle={`No guides match "${query}". Try a different name.`}
              />
            ) : (
              <EmptyState
                title="Search for a guide"
                subtitle="Type a name to find your perfect Mumbai buddy"
              />
            )
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}
