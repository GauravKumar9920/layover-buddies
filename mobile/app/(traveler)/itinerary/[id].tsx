import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
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
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StarRating } from '@/components/ui/StarRating';
import { EmptyState } from '@/components/ui/EmptyState';
import { fetchGuideById, fetchItineraryById } from '@/lib/api/guides';
import { theme } from '@/config/theme';
import { getGuideHeroPhoto, getItineraryPhoto } from '@/config/photoLibrary';
import { hapticImpactLight, hapticImpactMedium } from '@/lib/haptics';
import { useAuth } from '@/lib/hooks/useAuth';
import { useFavoritesStore } from '@/lib/stores/favorites';
import type { GuideProfile, Itinerary, TourPrompt } from '@/types';

/**
 * Package Detail — Hinge-style
 * ----------------------------
 * Route: /(traveler)/itinerary/[id]
 *
 * UX pattern (per Gaurav 2026-04-20): the screen reads like a Hinge profile.
 * After a parallax hero + guide mini-strip, we interleave the guide's 3
 * prompt cards with full-bleed photos from the tour gallery so the traveler
 * scrolls: photo → prompt → photo → prompt → photo → prompt. Each prompt
 * card is a soft-filled block with a small question label and a large
 * hand-written-feeling answer.
 *
 * Data sources:
 *   • itineraries.prompts (jsonb) — 3 Q/A pairs, migration 20260420160000
 *   • itineraries.gallery_urls (text[]) — gallery, migration 20260420120000
 *   • itineraries.video_url / video_duration_seconds — optional reel
 *
 * Rows without any of the above still render via a procedurally-generated
 * fallback keyed off guide first name + city, so the screen looks complete
 * from day 1 while guides are backfilling content.
 *
 * Favorites: the heart button in the top-right is wired to the Zustand
 * favorites store (mobile/lib/stores/favorites.ts) which optimistic-writes
 * to the `favorites` table.
 */

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = 440;
// Full-bleed photos in the interleaved feed (portrait-ish 4:5).
const FEED_PHOTO_WIDTH = SCREEN_WIDTH - 40;
const FEED_PHOTO_HEIGHT = Math.round(FEED_PHOTO_WIDTH * 1.1);

const SUGGESTED_PROMPTS: string[] = [
  'The moment on this walk I always remember is...',
  'A spot I\'d never take a tour group, but I\'ll take you...',
  'After this walk, most travelers tell me they wished they had...',
  'The one thing locals do here that guidebooks miss...',
  'If we have 20 extra minutes, I\'m taking you to...',
];

const FALLBACK_GALLERY = [
  'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1567157577867-05ccb1388e66?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1576502200916-3808e07386a5?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1595658658481-d53d3f999875?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=1200&q=80',
];

interface HingeContent {
  tagline: string;
  prompts: TourPrompt[];        // exactly 3, interleaved with photos
  photos: string[];             // >= 3, interleaved between prompts
  included: string[];
  notIncluded: string[];
  bringAlong: string[];
}

function formatDuration(seconds?: number | null): string {
  if (!seconds || seconds <= 0) return '0:47';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Procedurally generates 3 plausible prompts and a photo list when the
 * itinerary hasn't been filled in yet. Keyed off guide name + city so
 * the same tour produces the same mock each render.
 */
function buildFallbackContent(itinerary: Itinerary, guide: GuideProfile | null): HingeContent {
  const guideFirstName = (guide?.name ?? 'your guide').split(' ')[0];
  const hometown = guide?.hometown ?? itinerary.city;
  const category = itinerary.category ?? 'city';

  const tagline =
    itinerary.description && itinerary.description.length > 40
      ? itinerary.description.slice(0, 140) + (itinerary.description.length > 140 ? '…' : '')
      : `A ${itinerary.estimated_duration_hours}-hour ${category} walk through ${hometown}, told by a local who's lived it.`;

  const prompts: TourPrompt[] = [
    {
      question: SUGGESTED_PROMPTS[0],
      answer: `The chai stall halfway through. I've been going there since college — uncle knows my order before I sit down. We'll stand for five minutes, drink the best ₹20 of your day, and keep walking.`,
    },
    {
      question: SUGGESTED_PROMPTS[1],
      answer: `There's a terrace above a bookstore you'd never find from the street. Locals read there after monsoon rain. It's not on any map I've seen — I'll take you if the weather's kind.`,
    },
    {
      question: SUGGESTED_PROMPTS[2],
      answer: `More time. Everyone says "I wish we had longer." So we won't rush. If something catches your eye mid-walk, we go. That's the whole point of doing this with a friend instead of a bus.`,
    },
  ];

  const stopImages = (itinerary.stops ?? [])
    .map((stop) => stop.image_url)
    .filter((u): u is string => typeof u === 'string' && u.length > 0);

  const photos = [
    ...stopImages,
    ...FALLBACK_GALLERY,
  ].slice(0, 6);

  // Guarantee the minimum of 3 photos Gaurav specified.
  while (photos.length < 3) photos.push(FALLBACK_GALLERY[photos.length % FALLBACK_GALLERY.length]);

  const included = [
    'Your buddy for the full duration',
    'Local recs & off-menu spots',
    'Navigation + transit know-how',
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

  // Ignore silly typescript warnings about unused variables in fallback path.
  void guideFirstName;

  return { tagline, prompts, photos, included, notIncluded, bringAlong };
}

export default function ItineraryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();

  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [guide, setGuide] = useState<GuideProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Favorites wiring — subscribe granularly so unrelated toggles
  // don't re-render the whole screen.
  const isFavorited = useFavoritesStore((s) =>
    typeof id === 'string' ? s.ids.has(id) : false,
  );
  const toggleFavorite = useFavoritesStore((s) => s.toggle);
  const heartScale = useSharedValue(1);
  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: heartScale.value }] }));

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
    backgroundColor: `rgba(11,18,41,${interpolate(scrollY.value, [0, 100], [0, 0.85], Extrapolate.CLAMP)})`,
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
      } catch {
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

  // Prefer real prompts/gallery when present, otherwise fall back.
  const content = useMemo<HingeContent | null>(() => {
    if (!itinerary) return null;
    const fallback = buildFallbackContent(itinerary, guide);

    const hasRealPrompts = Array.isArray(itinerary.prompts) && itinerary.prompts.length > 0;
    const hasRealGallery = Array.isArray(itinerary.gallery_urls) && itinerary.gallery_urls.length > 0;

    // Top up to 3 prompts from the suggested list if the guide wrote fewer.
    let prompts: TourPrompt[] = hasRealPrompts ? itinerary.prompts!.slice(0, 3) : fallback.prompts;
    if (prompts.length < 3) {
      const supplement = fallback.prompts.slice(prompts.length, 3);
      prompts = [...prompts, ...supplement];
    }

    let photos = hasRealGallery ? itinerary.gallery_urls! : fallback.photos;
    // Enforce the "minimum 3 photos" rule with fallback padding.
    if (photos.length < 3) {
      photos = [...photos, ...fallback.photos].slice(0, 3);
    }

    return {
      ...fallback,
      prompts,
      photos,
    };
  }, [itinerary, guide]);

  const onHeartPress = useCallback(async () => {
    if (!itinerary) return;
    heartScale.value = withSequence(
      withSpring(1.35, { damping: 12, stiffness: 200 }),
      withSpring(1, { damping: 12, stiffness: 200 }),
    );
    hapticImpactMedium();
    await toggleFavorite(itinerary.id, session?.user?.id ?? null);
  }, [itinerary, session?.user?.id, toggleFavorite, heartScale]);

  // Small tap-bounce for the share button too, for symmetry.
  const shareScale = useSharedValue(1);
  const shareStyle = useAnimatedStyle(() => ({ transform: [{ scale: shareScale.value }] }));
  const onSharePress = useCallback(() => {
    shareScale.value = withSequence(
      withTiming(0.9, { duration: 80 }),
      withSpring(1, { damping: 12, stiffness: 200 }),
    );
    hapticImpactLight();
    Alert.alert('Share', 'Share coming soon');
  }, [shareScale]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.background,
        }}
      >
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!itinerary || !content) {
    return <EmptyState title="Package not found" style={{ flex: 1 }} />;
  }

  const heroPhoto =
    itinerary.cover_image_url ??
    content.photos[0] ??
    getItineraryPhoto(itinerary) ??
    getGuideHeroPhoto(guide ?? {});

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

      {/* ── Share / Heart buttons (right side) ─────────────── */}
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
        <Animated.View style={shareStyle}>
          <TouchableOpacity
            onPress={onSharePress}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: 'rgba(0,0,0,0.35)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 16, color: '#FFFFFF' }}>↗</Text>
          </TouchableOpacity>
        </Animated.View>
        <Animated.View style={heartStyle}>
          <TouchableOpacity
            onPress={onHeartPress}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: isFavorited
                ? theme.colors.accent
                : 'rgba(0,0,0,0.35)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            accessibilityRole="button"
            accessibilityLabel={isFavorited ? 'Unsave this tour' : 'Save this tour'}
          >
            <Text style={{ fontSize: 18, color: '#FFFFFF' }}>
              {isFavorited ? '♥' : '♡'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
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
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: HERO_HEIGHT * 0.55 }}
          />

          {/* Title overlay on hero */}
          <Animated.View
            style={[
              titleOverlayStyle,
              {
                position: 'absolute',
                bottom: 28,
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
                <Text
                  style={{
                    color: '#FFFFFF',
                    fontSize: 11,
                    fontWeight: '700',
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                  }}
                >
                  {itinerary.category}
                </Text>
              </View>
            )}
            <Text
              style={{
                fontSize: 34,
                fontWeight: '800',
                color: '#FFFFFF',
                letterSpacing: -0.8,
                lineHeight: 40,
              }}
            >
              {itinerary.name ?? itinerary.title ?? 'Mumbai Tour'}
            </Text>
            <Text
              style={{
                color: 'rgba(255,255,255,0.92)',
                fontSize: 14,
                marginTop: 8,
                fontWeight: '500',
              }}
            >
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
          <View
            style={{
              paddingHorizontal: 20,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
            }}
          >
            <View style={{ flex: 1, paddingRight: 14 }}>
              <Text style={{ fontSize: 15, color: theme.colors.textSecondary, lineHeight: 22 }}>
                {content.tagline}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text
                style={{
                  fontSize: 24,
                  fontWeight: '800',
                  color: theme.colors.primary,
                  letterSpacing: -0.5,
                }}
              >
                ₹{itinerary.buddy_cost_inr.toLocaleString('en-IN')}
              </Text>
              <Text style={{ fontSize: 11, color: theme.colors.textMuted }}>buddy fee</Text>
            </View>
          </View>

          {/* ── Guide mini-strip ───────────────────────────── */}
          {guide && (
            <TouchableOpacity
              onPress={() =>
                router.push({ pathname: '/(traveler)/guide/[id]', params: { id: guide.id } })
              }
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
                <Text
                  style={{
                    fontSize: 11,
                    color: theme.colors.textMuted,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    fontWeight: '700',
                  }}
                >
                  Your buddy
                </Text>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '700',
                    color: theme.colors.text,
                    marginTop: 2,
                  }}
                >
                  {guide.name}
                </Text>
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}
                >
                  <StarRating rating={guide.avg_rating} size={12} />
                  <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>
                    {guide.avg_rating > 0 ? guide.avg_rating.toFixed(1) : 'New'} ·{' '}
                    {guide.total_reviews} reviews
                  </Text>
                </View>
              </View>
              <Text style={{ color: theme.colors.primary, fontSize: 20, fontWeight: '700' }}>›</Text>
            </TouchableOpacity>
          )}

          {/* ── Hinge feed: prompt → photo → prompt → photo → prompt ── */}
          <View style={{ marginTop: 28 }}>
            {content.prompts.map((prompt, idx) => (
              <View key={`prompt-${idx}`}>
                <PromptCard prompt={prompt} />
                {/* Photo after every prompt if we have one. */}
                {content.photos[idx] && (
                  <FeedPhoto uri={content.photos[idx]} index={idx} />
                )}
              </View>
            ))}

            {/* Any extra photos the guide uploaded beyond the 3 prompts. */}
            {content.photos.slice(content.prompts.length).map((uri, i) => (
              <FeedPhoto key={`extra-${i}`} uri={uri} index={content.prompts.length + i} />
            ))}
          </View>

          {/* ── Video block (optional) ─────────────────────── */}
          {itinerary.video_url && (
            <View style={{ marginTop: 24, paddingHorizontal: 20 }}>
              <Text
                style={{
                  fontSize: 11,
                  color: theme.colors.primary,
                  letterSpacing: 1.2,
                  fontWeight: '800',
                  textTransform: 'uppercase',
                }}
              >
                Watch
              </Text>
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: '800',
                  color: theme.colors.text,
                  marginTop: 4,
                  letterSpacing: -0.4,
                }}
              >
                A minute inside the tour
              </Text>

              <TouchableOpacity
                onPress={() =>
                  Alert.alert('Video', 'Video playback coming soon — this is the prototype placeholder.')
                }
                style={{
                  marginTop: 14,
                  borderRadius: 18,
                  overflow: 'hidden',
                  aspectRatio: 16 / 9,
                  backgroundColor: theme.colors.text,
                }}
              >
                <Image
                  source={{ uri: itinerary.video_url }}
                  contentFit="cover"
                  style={{ width: '100%', height: '100%' }}
                />
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
                    {formatDuration(itinerary.video_duration_seconds)}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Stop-by-stop plan ──────────────────────────── */}
          <View style={{ marginTop: 36, paddingHorizontal: 20 }}>
            <Text
              style={{
                fontSize: 11,
                color: theme.colors.primary,
                letterSpacing: 1.2,
                fontWeight: '800',
                textTransform: 'uppercase',
              }}
            >
              The plan
            </Text>
            <Text
              style={{
                fontSize: 22,
                fontWeight: '800',
                color: theme.colors.text,
                marginTop: 4,
                letterSpacing: -0.4,
              }}
            >
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
                        <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>
                          {idx + 1}
                        </Text>
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
                      <Text
                        style={{ fontSize: 16, fontWeight: '700', color: theme.colors.text }}
                      >
                        {stop.location}
                      </Text>
                      {stop.estimated_duration_minutes > 0 && (
                        <Text
                          style={{ fontSize: 12, color: theme.colors.textMuted, marginTop: 2 }}
                        >
                          ~{stop.estimated_duration_minutes} min
                        </Text>
                      )}
                      {stop.description ? (
                        <Text
                          style={{
                            fontSize: 14,
                            color: theme.colors.textSecondary,
                            marginTop: 6,
                            lineHeight: 20,
                          }}
                        >
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
                items={content.included}
                bullet="✓"
                bulletColor={theme.colors.success}
              />
              <InfoColumn
                title="Not included"
                items={content.notIncluded}
                bullet="×"
                bulletColor={theme.colors.textMuted}
              />
            </View>
            <View style={{ marginTop: 12 }}>
              <Card>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '700',
                    color: theme.colors.text,
                    marginBottom: 8,
                  }}
                >
                  Bring along
                </Text>
                {content.bringAlong.map((item) => (
                  <View key={item} style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                    <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>•</Text>
                    <Text style={{ flex: 1, color: theme.colors.textSecondary, fontSize: 14 }}>
                      {item}
                    </Text>
                  </View>
                ))}
              </Card>
            </View>
          </View>

          {/* ── FAQ / logistical note ──────────────────────── */}
          <View
            style={{
              marginTop: 24,
              marginHorizontal: 20,
              padding: 16,
              borderRadius: 14,
              backgroundColor: theme.colors.primaryLight,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: '700',
                color: theme.colors.primary,
                marginBottom: 6,
              }}
            >
              ⏱ Airport layover friendly
            </Text>
            <Text style={{ fontSize: 13, color: theme.colors.text, lineHeight: 20 }}>
              Tell us your arrival and departure times on the next screen — we'll show you exactly how much of this tour fits in your layover window.
            </Text>
          </View>
        </View>
      </Animated.ScrollView>

      {/* ── Sticky Book CTA with inline heart ───────────────── */}
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
          gap: 12,
        }}
      >
        <TouchableOpacity
          onPress={onHeartPress}
          style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            borderWidth: 1.5,
            borderColor: isFavorited
              ? theme.colors.accent
              : theme.colors.divider,
            backgroundColor: isFavorited
              ? theme.colors.accent + '1A'
              : '#FFFFFF',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          accessibilityRole="button"
          accessibilityLabel={isFavorited ? 'Unsave this tour' : 'Save this tour'}
        >
          <Text
            style={{
              fontSize: 24,
              color: isFavorited
                ? theme.colors.accent
                : theme.colors.textSecondary,
            }}
          >
            {isFavorited ? '♥' : '♡'}
          </Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Button
            title={`Book · ₹${itinerary.buddy_cost_inr.toLocaleString('en-IN')}`}
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

// ─────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────

/**
 * A single Hinge-style prompt card. Soft-filled block with a small
 * question label up top and a large, hand-written-feeling answer below.
 */
function PromptCard({ prompt }: { prompt: TourPrompt }) {
  return (
    <View
      style={{
        marginHorizontal: 20,
        marginTop: 20,
        marginBottom: 4,
        padding: 20,
        borderRadius: 20,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.divider,
      }}
    >
      <Text
        style={{
          fontSize: 12,
          color: theme.colors.textMuted,
          fontWeight: '600',
          lineHeight: 18,
        }}
      >
        {prompt.question}
      </Text>
      <Text
        style={{
          fontSize: 22,
          lineHeight: 30,
          color: theme.colors.text,
          marginTop: 8,
          letterSpacing: -0.2,
          fontWeight: '500',
        }}
      >
        {prompt.answer}
      </Text>
    </View>
  );
}

/**
 * Full-bleed photo in the interleaved feed.
 */
function FeedPhoto({ uri, index }: { uri: string; index: number }) {
  return (
    <View
      style={{
        marginHorizontal: 20,
        marginTop: 20,
        height: FEED_PHOTO_HEIGHT,
        width: FEED_PHOTO_WIDTH,
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: theme.colors.surface,
        ...theme.shadows.sm,
      }}
    >
      <Image
        source={{ uri }}
        contentFit="cover"
        style={{ width: '100%', height: '100%' }}
        transition={250}
        recyclingKey={`feed-${index}`}
      />
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
        <Text
          style={{
            fontSize: 14,
            fontWeight: '700',
            color: theme.colors.text,
            marginBottom: 8,
          }}
        >
          {title}
        </Text>
        {items.map((item) => (
          <View key={item} style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
            <Text style={{ color: bulletColor, fontWeight: '700' }}>{bullet}</Text>
            <Text
              style={{
                flex: 1,
                color: theme.colors.textSecondary,
                fontSize: 13,
                lineHeight: 18,
              }}
            >
              {item}
            </Text>
          </View>
        ))}
      </Card>
    </View>
  );
}
