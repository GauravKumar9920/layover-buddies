import { useState } from 'react';
import { View, FlatList, Text } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Input } from '@/components/ui/Input';
import { useTravelerTrip } from '@/lib/hooks/useTravelerTrip';
import { GuideCard } from '@/components/guides/GuideCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Loading } from '@/components/ui/Loading';
import { Header } from '@/components/ui/Header';
import { searchGuides } from '@/lib/api/guides';
import { theme } from '@/config/theme';
import { getItineraryPhoto } from '@/config/photoLibrary';
import type { GuideProfile } from '@/types';

export default function SearchScreen() {
  const { layoverHours, interests } = useTravelerTrip();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GuideProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const heroPhoto =
    getItineraryPhoto({
      id: 'traveler-search-hero',
      city: 'Mumbai',
      category: 'culture',
      name: 'Search Hero',
    }) ??
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
      setResults(await searchGuides(text.trim()));
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
          borderRadius: theme.borderRadius.lg,
          overflow: 'hidden',
          borderWidth: 1.5,
          borderColor: theme.colors.inkLine,
        }}
      >
        <Image
          source={{ uri: heroPhoto }}
          style={{ width: '100%', height: 130 }}
          contentFit="cover"
          transition={250}
        />
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(14,25,41,0.46)',
            justifyContent: 'flex-end',
            paddingHorizontal: 14,
            paddingVertical: 12,
          }}
        >
          <Text
            style={{
              fontFamily: theme.fonts.display,
              color: '#FCF7EA',
              fontSize: 18,
              letterSpacing: -0.3,
            }}
          >
            Find a local by vibe, not just name
          </Text>
          <Text
            style={{
              fontFamily: theme.fonts.mono,
              color: 'rgba(252,247,234,0.85)',
              fontSize: 10.5,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
              marginTop: 5,
            }}
          >
            Try: street food · Marathi · architecture
          </Text>
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
        <Input
          placeholder="Name, university, language, interest…"
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
          renderItem={({ item, index }) => <GuideCard
              guide={item}
              index={index}
              travelerInterests={interests}
              layoverHours={layoverHours}
            />}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 16 }}
          ListEmptyComponent={
            hasSearched ? (
              <EmptyState
                title="No guides found"
                subtitle={`No guides match "${query}". Try a name, university, language, or interest.`}
              />
            ) : (
              <EmptyState
                title="Search for a guide"
                subtitle="Search names, universities, languages, and the experiences guides love."
              />
            )
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}
