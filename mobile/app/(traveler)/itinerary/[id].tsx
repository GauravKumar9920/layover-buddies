import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StarRating } from '@/components/ui/StarRating';
import { EmptyState } from '@/components/ui/EmptyState';
import { fetchGuideById, fetchItineraryById } from '@/lib/api/guides';
import { theme } from '@/config/theme';
import { getGuideHeroPhoto, getItineraryPhoto } from '@/config/photoLibrary';
import type { GuideProfile, Itinerary, StoryBlock } from '@/types';

/**
 * Package Detail Page — real-data backed with mock fallback.
 * ------------------------------------------------------------
 * Traveler-facing "full story" for a single tour/itinerary.
 * Route: /(traveler)/itinerary/[id]
 *
 * Reads optional story fields from the `itineraries` table
 * (migration 20260420120000_itinerary_story_fields.sql):
 *   • story_blocks  — jsonb, ordered rich-text narrative
 *   • gallery_urls  — text[], horizontal snap-scroll gallery
 *   • video_url     — text, reel thumbnail / source
 *   • video_duration_seconds — int, label like "0:47"
 *
 * Rows without those fields still render — they fall through to
 * buildMockStory() for the narrative, gallery, and video block.
 * ------------------------------------------------------------
 */

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = 360;
const GALLERY_TILE_WIDTH = Math.round(SCREEN_WIDTH * 0.72);
const GALLERY_TILE_HEIGHT = Math.round(GALLERY_TILE_WIDTH * 0.66);

interface MockStory {
  tagline: string;
  storyBlocks: StoryBlock[];
  gallery: string[];
  videoThumbnail: string | null;
  videoDurationLabel: string;
  included: string[];
  notIncluded: string[];
  bringAlong: string[];
}

const FALLBACK_GALLERY = [
  'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1567157577867-05ccb1388e66?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1576502200916-3808e07386a5?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1595658658481-d53d3f999875?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=1200&q=80',
];
const FALLBACK_VIDEO_THUMB = FALLBACK_GALLERY[0];

function formatDuration(seconds?: number | null): string {
  if (!seconds || seconds <= 0) return '0:47';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function buildMockStory(itinerary: Itinerary, guide: GuideProfile | null): MockStory {
  const guideFirstName = (guide?.name ?? 'your guide').split(' ')[0];
  const hometown = guide?.hometown ?? itinerary.city;
  const category = itinerary.category ?? 'city';

  const tagline =
    itinerary.description && itinerary.description.length > 40
      ? itinerary.description.slice(0, 140) + (itinerary.description.length > 140 ? '…' : '')
      : `A ${itinerary.estimated_duration_hours}-hour ${category} walk through ${hometown}, told by a local who's lived it.`;

  const storyBlocks: StoryBlock[] = [
    {
      kind: 'paragraph',
      text: `Hi, I'm ${guideFirstName} — and this isn't a tour. It's the version of ${hometown} I'd show my best friend if they had a layover. We'll skip the bus-route checklist and go where the city actually breathes.`,
    },
    {
      kind: 'highlight',
      emoji: '🛵',
      title: 'Real streets, real pace',
      body: `We walk, we catch a cab, we grab a train if it makes sense. Whatever gets us there like locals do — not whatever's in a brochure.`,
    },
    {
      kind: 'paragraph',
      text: `Expect tea-stall pit stops, stories behind the buildings everyone photographs, and a couple of places you won't find on Google Maps. If something catches your eye mid-walk, we go. That's the whole point.`,
    },
    {
      kind: 'quote',
      text: `"${guideFirstName} didn't rush us once. It felt like hanging out with a friend who happened to know everything."`,
      author: 'A recent traveler',
    },
    {
      kind: 'highlight',
      emoji: '📸',
      title: 'Photos you\'ll actually want',
      body: `I know the golden-hour angles. If you want the shot, I'll take it. If you want to put the phone down, even better.`,
    },
  ];

  const stopImages = (itinerary.stops ?? [])
    .map((stop) => stop.image_url)
    .filter((u): u is string => typeof u === 'string' && u.length > 0);

  const gallery = [
    ...stopImages,
    ...FALLBACK_GALLERY,
  ].slice(0, 8);

  const videoThumbnail = getItineraryPhoto(itinerary) ?? FALLBACK_GALLERY[0];

  const included = [
    'Your guide for the full duration',
    'Navigation & transit directions',
    'Local recommendations & off-menu spots',
    'All chai / tea stall stops',
  ];
  const notIncluded = [
    'Food & drinks (pay as you go)',
    'Cab or auto fares',
    'Entry tickets (if any)',
  ];
  const bringAlong = [
    'Comfortable walking shoes',
    'A refillable water bottle',
    'Cash for small vendors (₹500–1,000)',
    'An open mind — we improvise',
  ];

  return {
    tagline,
    storyBlocks,
    gallery,
    videoThumbnail,
    videoDurationLabel: '0:47',
    included,
    notIncluded,
    bringAlong,
  };
}

export default function ItineraryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [guide, setGuide] = useState<GuideProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  // Parallax hero
  const heroStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(scrollY.value, [0, HERO_HEIGHT], [0, HERO_HEIGHT * 0.5], Extrapolate.CLAMP),
      },
      {
        scale: interpolate(scrollY.value, [-HERO_HEIGHT, 0], [1.4, 1], Extrapolate.CLAMP),
      },
    ],
  }));

  // Title overlay fade on scroll
  const titleOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, HERO_HEIGHT * 0.7], [1, 0], Extrapolate.CLAMP),
  }));

  // Back button bg fade
  const backBgStyle = useAnimatedStyle(() => ({
    backgroundColor: `rgba(26,26,46,${interpolate(scrollY.value, [0, 100], [0, 0.85], Extrapolate.CLAMP)})`,
  }));

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      try {
        const found = await fetchItineraryById(id);
        if (cancelled) return;
        setItinerary(found);

        if (found) {
          const g = await fetchGuideById(found.guide_id);
          if (!cancelled) setGuide(g);
        }
      } catch (err) {
        if (!cancelled) {
          Alert.alert('Error', 'Failed to load this package.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Prefer real DB-persisted story fields when present, else fall back
  // to the procedurally-generated buildMockStory(). The mock still
  // supplies tagline/included/notIncluded/bringAlong — those columns
  // don't exist on the itineraries table yet.
  const story = useMemo<MockStory | null>(() => {
    if (!itinerary) return null;
    const mock = buildMockStory(itinerary, guide);

    if (itinerary.story_blocks && itinerary.story_blocks.length > 0) {
      return {
        tagline: mock.tagline,
        storyBlocks: itinerary.story_blocks,
        gallery: itinerary.gallery_urls && itinerary.gallery_urls.length > 0
          ? itinerary.gallery_urls
          : mock.gallery,
        videoThumbnail: itinerary.video_url ?? FALLBACK_VIDEO_THUMB,
        videoDurationLabel: formatDuration(itinerary.video_duration_seconds),
        included: mock.included,
        notIncluded: mock.notIncluded,
        bringAlong: mock.bringAlong,
      };
    }

    return mock;
  }, [itinerary, guide]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!itinerary || !story) {
    return <EmptyState title="Package not found" style={{ flex: 1 }} />;
  }

  const heroPhoto = getItineraryPhoto(itinerary) ?? getGuideHeroPhoto(guide ?? {});
  const totalStopMinutes = (itinerary.stops ?? []).reduce(
    (acc, s) => acc + (s.estimated_duration_minutes ?? 0),
    0,
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {/* ── Sticky Back Button ─────────────────────────────── */}
      <Animated.View
        style={[
          backBgStyle,
          {
            position: 'absolute',
            top: insets.top + 8,
            left: 16,
            zIndex: 50,
            borderRadius: 20,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ padding: 10 }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 22, lineHeight: 22 }}>‹</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* ── Share / Save buttons (right side) ──────────────── */}
      <View
        style={{
          position: 'absolute',
          top: insets.top + 8,
          right: 16,
          zIndex: 50,
          flexDirection: 'row',
          gap: 8,
        }}
      >
        <TouchableOpacity
          onPress={() => Alert.alert('Share', 'Share coming soon')}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: 'rgba(0,0,0,0.35)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 16 }}>↗</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => Alert.alert('Saved', 'Saved to your favorites (mock)')}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: 'rgba(0,0,0,0.35)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 16 }}>♡</Text>
        </TouchableOpacity>
      </View>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 160 }}
      >
        {/* ── Parallax Hero ────────────────────────────────── */}
        <View style={{ height: HERO_HEIGHT, overflow: 'hidden', backgroundColor: theme.colors.text }}>
          <Animated.View style={[{ width: '100%', height: HERO_HEIGHT + 120 }, heroStyle]}>
            {heroPhoto ? (
              <Image
                source={{ uri: heroPhoto }}
                contentFit="cover"
                style={{ width: '100%', height: '100%' }}
                transition={300}
              />
            ) : (
              <LinearGradient
                colors={theme.gradients.hero}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontSize: 80 }}>🗺️</Text>
              </LinearGradient>
            )}
          </Animated.View>

          {/* Dark gradient from bottom */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.75)']}
            start={{ x: 0.5, y: 0.2 }}
            end={{ x: 0.5, y: 1 }}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: HERO_HEIGHT * 0.6 }}
          />

          {/* Title overlay on hero */}
          <Animated.View
            style={[
              titleOverlayStyle,
              {
                position: 'absolute',
                bottom: 24,
                left: 20,
                right: 20,
              },
            ]}
          >
            {itinerary.category && (
              <View
                style={{
                  alignSelf: 'flex-start',
                  backgroundColor: 'rgba(255,255,255,0.25)',
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 999,
                  marginBottom: 10,
                }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                  {itinerary.category}
                </Text>
              </View>
            )}
            <Text
              style={{
                fontSize: 32,
                fontWeight: '800',
                color: '#FFFFFF',
                letterSpacing: -0.8,
                lineHeight: 38,
              }}
            >
              {itinerary.name ?? itinerary.title ?? 'Mumbai Tour'}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.92)', fontSize: 14, marginTop: 8, fontWeight: '500' }}>
              📍 {itinerary.city}   ·   ⏱ {itinerary.estimated_duration_hours}h   ·   👣 {(itinerary.stops ?? []).length} stops
            </Text>
          </Animated.View>
        </View>

        {/* ── Body on cream ────────────────────────────────── */}
        <View
          style={{
            backgroundColor: theme.colors.background,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            marginTop: -28,
            paddingTop: 24,
          }}
        >
          {/* Tagline + Price row */}
          <View style={{ paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, paddingRight: 14 }}>
              <Text style={{ fontSize: 15, color: theme.colors.textSecondary, lineHeight: 22 }}>
                {story.tagline}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 24, fontWeight: '800', color: theme.colors.primary, letterSpacing: -0.5 }}>
                ₹{itinerary.buddy_cost_inr.toLocaleString('en-IN')}
              </Text>
              <Text style={{ fontSize: 11, color: theme.colors.textMuted }}>buddy fee</Text>
            </View>
          </View>

          {/* ── Guide mini-strip ───────────────────────────── */}
          {guide && (
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/(traveler)/guide/[id]', params: { id: guide.id } })}
              style={{
                marginHorizontal: 20,
                marginTop: 20,
                flexDirection: 'row',
                alignItems: 'center',
                padding: 14,
                borderRadius: 16,
                backgroundColor: theme.colors.surface,
                ...theme.shadows.sm,
              }}
            >
              {guide.avatar_url ? (
                <Image
                  source={{ uri: guide.avatar_url }}
                  style={{ width: 52, height: 52, borderRadius: 26 }}
                  contentFit="cover"
                />
              ) : (
                <View
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                    backgroundColor: theme.colors.primaryLight,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 22 }}>🎓</Text>
                </View>
              )}
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ fontSize: 11, color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '700' }}>
                  Your buddy
                </Text>
                <Text style={{ fontSize: 16, fontWeight: '700', color: theme.colors.text, marginTop: 2 }}>
                  {guide.name}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <StarRating rating={guide.avg_rating} size={12} />
                  <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>
                    {guide.avg_rating > 0 ? guide.avg_rating.toFixed(1) : 'New'} · {guide.total_reviews} reviews
                  </Text>
                </View>
              </View>
              <Text style={{ color: theme.colors.primary, fontSize: 20, fontWeight: '700' }}>›</Text>
            </TouchableOpacity>
          )}

          {/* ── Story blocks ───────────────────────────────── */}
          <View style={{ marginTop: 32, paddingHorizontal: 20 }}>
            <Text style={{ fontSize: 11, color: theme.colors.primary, letterSpacing: 1.2, fontWeight: '800', textTransform: 'uppercase' }}>
              The story
            </Text>
            <Text style={{ fontSize: 22, fontWeight: '800', color: theme.colors.text, marginTop: 4, letterSpacing: -0.4 }}>
              What this walk actually feels like
            </Text>

            <View style={{ marginTop: 16, gap: 18 }}>
              {story.storyBlocks.map((block, idx) => {
                if (block.kind === 'paragraph') {
                  return (
                    <Text
                      key={idx}
                      style={{ fontSize: 15, color: theme.colors.text, lineHeight: 24 }}
                    >
                      {block.text}
                    </Text>
                  );
                }
                if (block.kind === 'quote') {
                  return (
                    <View
                      key={idx}
                      style={{
                        borderLeftWidth: 3,
                        borderLeftColor: theme.colors.primary,
                        paddingLeft: 14,
                        paddingVertical: 4,
                      }}
                    >
                      <Text style={{ fontSize: 16, fontStyle: 'italic', color: theme.colors.text, lineHeight: 24 }}>
                        {block.text}
                      </Text>
                      {block.author && (
                        <Text style={{ fontSize: 12, color: theme.colors.textMuted, marginTop: 6 }}>
                          — {block.author}
                        </Text>
                      )}
                    </View>
                  );
                }
                // highlight
                return (
                  <View
                    key={idx}
                    style={{
                      flexDirection: 'row',
                      backgroundColor: theme.colors.surface,
                      padding: 14,
                      borderRadius: 14,
                      gap: 12,
                      ...theme.shadows.sm,
                    }}
                  >
                    <Text style={{ fontSize: 26 }}>{block.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.text }}>
                        {block.title}
                      </Text>
                      <Text style={{ fontSize: 14, color: theme.colors.textSecondary, marginTop: 4, lineHeight: 20 }}>
                        {block.body}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          {/* ── Video block ────────────────────────────────── */}
          <View style={{ marginTop: 36, paddingHorizontal: 20 }}>
            <Text style={{ fontSize: 11, color: theme.colors.primary, letterSpacing: 1.2, fontWeight: '800', textTransform: 'uppercase' }}>
              Watch
            </Text>
            <Text style={{ fontSize: 22, fontWeight: '800', color: theme.colors.text, marginTop: 4, letterSpacing: -0.4 }}>
              A minute inside the tour
            </Text>

            <TouchableOpacity
              onPress={() => Alert.alert('Video', 'Video playback coming soon — this is the prototype placeholder.')}
              style={{
                marginTop: 14,
                borderRadius: 18,
                overflow: 'hidden',
                aspectRatio: 16 / 9,
                backgroundColor: theme.colors.text,
              }}
            >
              {story.videoThumbnail && (
                <Image
                  source={{ uri: story.videoThumbnail }}
                  contentFit="cover"
                  style={{ width: '100%', height: '100%' }}
                />
              )}
              <LinearGradient
                colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.55)']}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
              />
              <View
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: 0,
                  bottom: 0,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <View
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    backgroundColor: 'rgba(255,255,255,0.92)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    ...theme.shadows.lg,
                  }}
                >
                  <Text style={{ fontSize: 22, color: theme.colors.primary, marginLeft: 4 }}>▶</Text>
                </View>
              </View>
              <View
                style={{
                  position: 'absolute',
                  bottom: 10,
                  right: 12,
                  backgroundColor: 'rgba(0,0,0,0.65)',
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 6,
                }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>
                  {story.videoDurationLabel}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* ── Photo gallery (horizontal) ─────────────────── */}
          <View style={{ marginTop: 36 }}>
            <View style={{ paddingHorizontal: 20 }}>
              <Text style={{ fontSize: 11, color: theme.colors.primary, letterSpacing: 1.2, fontWeight: '800', textTransform: 'uppercase' }}>
                Gallery
              </Text>
              <Text style={{ fontSize: 22, fontWeight: '800', color: theme.colors.text, marginTop: 4, letterSpacing: -0.4 }}>
                From past walks
              </Text>
            </View>

            <FlatList
              data={story.gallery}
              keyExtractor={(uri, idx) => `${uri}-${idx}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={GALLERY_TILE_WIDTH + 12}
              decelerationRate="fast"
              contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 14, gap: 12 }}
              onMomentumScrollEnd={(e) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / (GALLERY_TILE_WIDTH + 12));
                setGalleryIndex(idx);
              }}
              renderItem={({ item }) => (
                <View
                  style={{
                    width: GALLERY_TILE_WIDTH,
                    height: GALLERY_TILE_HEIGHT,
                    borderRadius: 16,
                    overflow: 'hidden',
                    backgroundColor: theme.colors.surface,
                  }}
                >
                  <Image
                    source={{ uri: item }}
                    contentFit="cover"
                    style={{ width: '100%', height: '100%' }}
                    transition={250}
                  />
                </View>
              )}
            />

            {/* Dots */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 4 }}>
              {story.gallery.map((_, idx) => (
                <View
                  key={idx}
                  style={{
                    width: idx === galleryIndex ? 16 : 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: idx === galleryIndex ? theme.colors.primary : theme.colors.divider,
                  }}
                />
              ))}
            </View>
          </View>

          {/* ── Stop-by-stop plan ──────────────────────────── */}
          <View style={{ marginTop: 36, paddingHorizontal: 20 }}>
            <Text style={{ fontSize: 11, color: theme.colors.primary, letterSpacing: 1.2, fontWeight: '800', textTransform: 'uppercase' }}>
              The plan
            </Text>
            <Text style={{ fontSize: 22, fontWeight: '800', color: theme.colors.text, marginTop: 4, letterSpacing: -0.4 }}>
              Stop by stop
            </Text>
            <Text style={{ fontSize: 13, color: theme.colors.textMuted, marginTop: 6 }}>
              Roughly {Math.round(totalStopMinutes / 60)}h of walking + chai stops · flexible pace
            </Text>

            <View style={{ marginTop: 18 }}>
              {(itinerary.stops ?? []).length === 0 ? (
                <Text style={{ color: theme.colors.textMuted, fontSize: 14, marginTop: 8 }}>
                  The guide will personalize the route for you.
                </Text>
              ) : (
                (itinerary.stops ?? []).map((stop, idx, arr) => (
                  <View key={stop.id} style={{ flexDirection: 'row', gap: 14 }}>
                    {/* Timeline rail */}
                    <View style={{ alignItems: 'center' }}>
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          backgroundColor: theme.colors.primary,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>{idx + 1}</Text>
                      </View>
                      {idx < arr.length - 1 && (
                        <View
                          style={{
                            flex: 1,
                            width: 2,
                            backgroundColor: theme.colors.primaryLight,
                            marginTop: 4,
                          }}
                        />
                      )}
                    </View>

                    {/* Content */}
                    <View style={{ flex: 1, paddingBottom: 20 }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: theme.colors.text }}>
                        {stop.location}
                      </Text>
                      {stop.estimated_duration_minutes > 0 && (
                        <Text style={{ fontSize: 12, color: theme.colors.textMuted, marginTop: 2 }}>
                          ~{stop.estimated_duration_minutes} min
                        </Text>
                      )}
                      {stop.description ? (
                        <Text style={{ fontSize: 14, color: theme.colors.textSecondary, marginTop: 6, lineHeight: 20 }}>
                          {stop.description}
                        </Text>
                      ) : null}
                      {stop.image_url ? (
                        <View
                          style={{
                            marginTop: 10,
                            height: 140,
                            borderRadius: 12,
                            overflow: 'hidden',
                            backgroundColor: theme.colors.surface,
                          }}
                        >
                          <Image
                            source={{ uri: stop.image_url }}
                            contentFit="cover"
                            style={{ width: '100%', height: '100%' }}
                          />
                        </View>
                      ) : null}
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>

          {/* ── What's included / not / bring ──────────────── */}
          <View style={{ marginTop: 20, paddingHorizontal: 20 }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <InfoColumn
                title="Included"
                items={story.included}
                bullet="✓"
                bulletColor={theme.colors.success}
              />
              <InfoColumn
                title="Not included"
                items={story.notIncluded}
                bullet="×"
                bulletColor={theme.colors.textMuted}
              />
            </View>
            <View style={{ marginTop: 12 }}>
              <Card>
                <Text style={{ fontSize: 14, fontWeight: '700', color: theme.colors.text, marginBottom: 8 }}>
                  Bring along
                </Text>
                {story.bringAlong.map((item) => (
                  <View key={item} style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                    <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>•</Text>
                    <Text style={{ flex: 1, color: theme.colors.textSecondary, fontSize: 14 }}>{item}</Text>
                  </View>
                ))}
              </Card>
            </View>
          </View>

          {/* ── FAQ / logistical note ──────────────────────── */}
          <View style={{ marginTop: 24, marginHorizontal: 20, padding: 16, borderRadius: 14, backgroundColor: theme.colors.primaryLight }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.primary, marginBottom: 6 }}>
              ⏱ Airport layover friendly
            </Text>
            <Text style={{ fontSize: 13, color: theme.colors.text, lineHeight: 20 }}>
              Tell us your arrival and departure times on the next screen — we'll show you exactly how much of this tour fits in your layover window.
            </Text>
          </View>
        </View>
      </Animated.ScrollView>

      {/* ── Sticky Book CTA ─────────────────────────────── */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'rgba(255,250,245,0.96)',
          borderTopWidth: 1,
          borderTopColor: theme.colors.divider,
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: insets.bottom + 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <View>
          <Text style={{ fontSize: 11, color: theme.colors.textMuted }}>From</Text>
          <Text style={{ fontSize: 20, fontWeight: '800', color: theme.colors.text, letterSpacing: -0.5 }}>
            ₹{itinerary.buddy_cost_inr.toLocaleString('en-IN')}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Button
            title="Book this package"
            size="lg"
            onPress={() =>
              router.push({
                pathname: '/(traveler)/book/[guideId]',
                params: { guideId: itinerary.guide_id, itineraryId: itinerary.id },
              })
            }
          />
        </View>
      </View>
    </View>
  );
}

function InfoColumn({
  title,
  items,
  bullet,
  bulletColor,
}: {
  title: string;
  items: string[];
  bullet: string;
  bulletColor: string;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Card>
        <Text style={{ fontSize: 14, fontWeight: '700', color: theme.colors.text, marginBottom: 8 }}>
          {title}
        </Text>
        {items.map((item) => (
          <View key={item} style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
            <Text style={{ color: bulletColor, fontWeight: '700' }}>{bullet}</Text>
            <Text style={{ flex: 1, color: theme.colors.textSecondary, fontSize: 13, lineHeight: 18 }}>
              {item}
            </Text>
          </View>
        ))}
      </Card>
    </View>
  );
}
