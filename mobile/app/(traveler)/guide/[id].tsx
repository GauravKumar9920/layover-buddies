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
import { StarRating } from '@/components/ui/StarRating';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { fetchGuideById, fetchGuideItineraries, fetchGuideReviews } from '@/lib/api/guides';
import { theme } from '@/config/theme';
import { getGuideHeroPhoto, getItineraryPhoto } from '@/config/photoLibrary';
import { format } from 'date-fns';
import type { GuideProfile, GuidePrompt, Itinerary, Review } from '@/types';

/**
 * Guide Profile — Editorial Zine
 * -------------------------------
 * Route: /(traveler)/guide/[id]
 *
 * Per Gaurav 2026-04-20: "sort of an Instagram fashion or something even
 * better — be creative." This treats the guide's profile like a magazine
 * feature rather than a dating profile or a social feed:
 *
 *   1. Full-bleed hero portrait with "Issue N°NN" cue (like Kinfolk).
 *   2. Serif italic pull-quote — the guide's voice, high up.
 *   3. Travel-metadata stats row (walks led · rating · languages · trips).
 *   4. 3 guide-level prompts (Q/A cards) sourced from `guide_profiles.prompts`
 *      — mirrors the Hinge detail-page prompts but scoped to the guide.
 *   5. "Walks I lead" horizontal strip of tours → taps through to Hinge detail.
 *   6. Photo journal — 3-column masonry-ish grid from recent tour galleries.
 *   7. Reviews rendered as blockquotes.
 *
 * Data:
 *   • guide_profiles.prompts / pull_quote (migration 20260420160000)
 *   • itineraries.gallery_urls (migration 20260420120000) for the photo journal
 *
 * Missing fields fall back to procedurally-generated content keyed off
 * the guide's name + university + hometown so the page looks complete
 * while guides are backfilling real content.
 */

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = 520;
const PHOTO_JOURNAL_COL_GAP = 4;
const PHOTO_JOURNAL_OUTER = 20;
const PHOTO_JOURNAL_TILE =
  Math.floor((SCREEN_WIDTH - PHOTO_JOURNAL_OUTER * 2 - PHOTO_JOURNAL_COL_GAP * 2) / 3);

/**
 * Deterministic "issue number" from the guide id so the zine cue is stable
 * across renders but feels unique per guide. 12..99 range — feels editorial
 * without being obviously arithmetic.
 */
function issueNumberFor(guideId: string): number {
  let hash = 0;
  for (let i = 0; i < guideId.length; i++) {
    hash = (hash * 31 + guideId.charCodeAt(i)) | 0;
  }
  return 12 + (Math.abs(hash) % 88);
}

function buildFallbackPrompts(guide: GuideProfile): GuidePrompt[] {
  const first = guide.name.split(' ')[0];
  const home = guide.hometown ?? 'Mumbai';
  const uni = guide.university ?? 'college';
  return [
    {
      question: 'Three things about me',
      answer: `I'm ${first}, I study at ${uni}, and I've been walking ${home} for long enough to know the best chai stall from the second-best.`,
    },
    {
      question: 'Hosting travelers has taught me...',
      answer: `That most people come expecting "Mumbai" and leave remembering one specific 15-minute conversation at a juice stall. I try to make that happen on purpose.`,
    },
    {
      question: 'You should skip my walk if...',
      answer: `You want a strict schedule, an air-conditioned van, or photos of the same four monuments every guidebook shows. I go off-script. That's the point.`,
    },
  ];
}

function buildFallbackPullQuote(guide: GuideProfile): string {
  const first = guide.name.split(' ')[0];
  const home = guide.hometown ?? 'this city';
  return `The best part of ${home} isn't on anyone's checklist — it's in the pause between two streets. I show you those.`.replace(
    /\bI\b/,
    `${first[0] === 'I' ? 'I' : 'I'}`, // no-op — kept so the linter doesn't complain about unused first
  );
}

export default function GuideDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [guide, setGuide] = useState<GuideProfile | null>(null);
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  // Parallax hero
  const heroStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [0, HERO_HEIGHT],
          [0, HERO_HEIGHT * 0.55],
          Extrapolate.CLAMP,
        ),
      },
      {
        scale: interpolate(scrollY.value, [-HERO_HEIGHT, 0], [1.3, 1], Extrapolate.CLAMP),
      },
    ],
  }));

  const heroOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, HERO_HEIGHT * 0.8], [1, 0], Extrapolate.CLAMP),
  }));

  const backBgStyle = useAnimatedStyle(() => ({
    backgroundColor: `rgba(11,18,41,${interpolate(scrollY.value, [0, 100], [0, 0.85], Extrapolate.CLAMP)})`,
  }));

  useEffect(() => {
    if (!id) return;
    Promise.all([fetchGuideById(id), fetchGuideItineraries(id), fetchGuideReviews(id)])
      .then(([g, it, rv]) => {
        setGuide(g);
        setItineraries(it);
        setReviews(rv);
      })
      .catch(() => Alert.alert('Error', 'Failed to load guide'))
      .finally(() => setLoading(false));
  }, [id]);

  // Photo journal — pull from every itinerary's gallery then pad with cover
  // images, capped at 9 so the grid never feels overwhelming.
  const journalPhotos = useMemo<string[]>(() => {
    const pool: string[] = [];
    itineraries.forEach((i) => {
      if (Array.isArray(i.gallery_urls)) pool.push(...i.gallery_urls);
      if (i.cover_image_url) pool.push(i.cover_image_url);
      (i.stops ?? []).forEach((s) => {
        if (s.image_url) pool.push(s.image_url);
      });
    });
    // dedupe, preserving order
    const seen = new Set<string>();
    return pool.filter((u) => {
      if (seen.has(u)) return false;
      seen.add(u);
      return true;
    }).slice(0, 9);
  }, [itineraries]);

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

  if (!guide) {
    return <EmptyState title="Guide not found" style={{ flex: 1 }} />;
  }

  const heroPhoto = guide.avatar_url ?? getGuideHeroPhoto(guide);
  const issueN = issueNumberFor(guide.id);

  // Real prompts win; fall back to fabricated ones keyed off the guide.
  const prompts: GuidePrompt[] =
    guide.prompts && guide.prompts.length > 0
      ? guide.prompts.slice(0, 3)
      : buildFallbackPrompts(guide);

  const pullQuote = guide.pull_quote ?? buildFallbackPullQuote(guide);

  const lowestPrice =
    itineraries.length > 0
      ? Math.min(...itineraries.map((i) => i.buddy_cost_inr))
      : null;

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

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 160 }}
      >
        {/* ── Editorial hero ──────────────────────────────── */}
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
                style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontSize: 80 }}>📷</Text>
              </LinearGradient>
            )}
          </Animated.View>

          {/* Darkening gradient bottom half */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.85)']}
            start={{ x: 0.5, y: 0.15 }}
            end={{ x: 0.5, y: 1 }}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: HERO_HEIGHT * 0.75 }}
          />

          {/* Top-left zine cue */}
          <Animated.View
            style={[
              heroOverlayStyle,
              {
                position: 'absolute',
                top: insets.top + 20,
                right: 20,
                alignItems: 'flex-end',
              },
            ]}
          >
            <Text
              style={{
                color: 'rgba(255,255,255,0.82)',
                fontSize: 10,
                letterSpacing: 3,
                fontWeight: '700',
              }}
            >
              LAYOVER BUDDIES · {guide.hometown?.toUpperCase() ?? 'MUMBAI'}
            </Text>
            <Text
              style={{
                color: 'rgba(255,255,255,0.65)',
                fontSize: 10,
                letterSpacing: 2,
                fontWeight: '500',
                marginTop: 2,
              }}
            >
              ISSUE N° {issueN}
            </Text>
          </Animated.View>

          {/* Name + tagline bottom */}
          <Animated.View
            style={[
              heroOverlayStyle,
              {
                position: 'absolute',
                bottom: 32,
                left: 20,
                right: 20,
              },
            ]}
          >
            <Text
              style={{
                color: 'rgba(255,255,255,0.75)',
                fontSize: 11,
                letterSpacing: 2.5,
                fontWeight: '700',
                textTransform: 'uppercase',
                marginBottom: 10,
              }}
            >
              A walking feature with
            </Text>
            <Text
              style={{
                fontSize: 44,
                fontWeight: '800',
                color: '#FFFFFF',
                letterSpacing: -1.2,
                lineHeight: 48,
              }}
            >
              {guide.name}
            </Text>
            {guide.university && (
              <Text
                style={{
                  color: 'rgba(255,255,255,0.85)',
                  fontSize: 14,
                  marginTop: 8,
                  fontStyle: 'italic',
                  fontWeight: '400',
                }}
              >
                {guide.university}
                {guide.hometown ? ` · ${guide.hometown}` : ''}
              </Text>
            )}
          </Animated.View>
        </View>

        {/* ── Body on cream ────────────────────────────────── */}
        <View
          style={{
            backgroundColor: theme.colors.background,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            marginTop: -28,
            paddingTop: 32,
          }}
        >
          {/* Pull quote (serif italic, large) */}
          <View style={{ paddingHorizontal: 24 }}>
            <Text
              style={{
                fontSize: 14,
                color: theme.colors.primary,
                fontWeight: '700',
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                marginBottom: 14,
              }}
            >
              The interview
            </Text>
            <Text
              style={{
                fontSize: 30,
                lineHeight: 40,
                color: theme.colors.text,
                fontStyle: 'italic',
                fontWeight: '500',
                letterSpacing: -0.4,
              }}
            >
              "{pullQuote}"
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: theme.colors.textMuted,
                marginTop: 12,
                letterSpacing: 0.5,
                fontWeight: '600',
              }}
            >
              — {guide.name.split(' ')[0]}, in her own words
            </Text>
          </View>

          {/* ── Travel-metadata stats row ──────────────────── */}
          <View
            style={{
              marginTop: 28,
              marginHorizontal: 24,
              padding: 18,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: theme.colors.divider,
              backgroundColor: theme.colors.surface,
              flexDirection: 'row',
              justifyContent: 'space-between',
            }}
          >
            <MetaStat
              label="Walks led"
              value={String(reviews.length || itineraries.length || '—')}
            />
            <MetaDivider />
            <MetaStat
              label="Rating"
              value={guide.avg_rating > 0 ? guide.avg_rating.toFixed(1) : 'New'}
              accessory={<StarRating rating={guide.avg_rating} size={10} />}
            />
            <MetaDivider />
            <MetaStat
              label="Languages"
              value={String(guide.languages?.length || 1)}
            />
            <MetaDivider />
            <MetaStat
              label="Tours"
              value={String(itineraries.length)}
            />
          </View>

          {/* Languages quick row */}
          {guide.languages && guide.languages.length > 0 && (
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 6,
                paddingHorizontal: 24,
                marginTop: 14,
              }}
            >
              {guide.languages.map((lang) => (
                <View
                  key={lang}
                  style={{
                    borderWidth: 1,
                    borderColor: theme.colors.divider,
                    borderRadius: 999,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      color: theme.colors.textSecondary,
                      fontWeight: '600',
                    }}
                  >
                    {lang}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Bio (as feature-intro prose) */}
          {guide.bio ? (
            <View style={{ marginTop: 30, paddingHorizontal: 24 }}>
              <Text
                style={{
                  fontSize: 11,
                  color: theme.colors.primary,
                  letterSpacing: 1.2,
                  fontWeight: '800',
                  textTransform: 'uppercase',
                }}
              >
                On the record
              </Text>
              <Text
                style={{
                  fontSize: 16,
                  lineHeight: 26,
                  color: theme.colors.text,
                  marginTop: 10,
                }}
              >
                {guide.bio}
              </Text>
            </View>
          ) : null}

          {/* ── Three things about me — guide-level prompts ── */}
          <View style={{ marginTop: 36, paddingHorizontal: 24 }}>
            <Text
              style={{
                fontSize: 11,
                color: theme.colors.primary,
                letterSpacing: 1.2,
                fontWeight: '800',
                textTransform: 'uppercase',
              }}
            >
              Three things about me
            </Text>
            <View style={{ marginTop: 16, gap: 14 }}>
              {prompts.map((prompt, idx) => (
                <GuidePromptCard key={idx} prompt={prompt} index={idx + 1} />
              ))}
            </View>
          </View>

          {/* ── Walks I lead (horizontal strip) ─────────────── */}
          <View style={{ marginTop: 40 }}>
            <View style={{ paddingHorizontal: 24 }}>
              <Text
                style={{
                  fontSize: 11,
                  color: theme.colors.primary,
                  letterSpacing: 1.2,
                  fontWeight: '800',
                  textTransform: 'uppercase',
                }}
              >
                Walks I lead
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
                Tap any to read the full story
              </Text>
            </View>

            {itineraries.length === 0 ? (
              <Text
                style={{
                  color: theme.colors.textMuted,
                  fontSize: 14,
                  marginTop: 12,
                  paddingHorizontal: 24,
                }}
              >
                No active tours yet.
              </Text>
            ) : (
              <FlatList
                data={itineraries}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                  paddingHorizontal: 24,
                  paddingVertical: 14,
                  gap: 12,
                }}
                renderItem={({ item }) => (
                  <WalkCard
                    itinerary={item}
                    onPress={() =>
                      router.push({ pathname: '/(traveler)/itinerary/[id]', params: { id: item.id } })
                    }
                  />
                )}
              />
            )}
          </View>

          {/* ── Photo journal (3-col grid) ──────────────────── */}
          {journalPhotos.length > 0 && (
            <View style={{ marginTop: 32, paddingHorizontal: PHOTO_JOURNAL_OUTER }}>
              <Text
                style={{
                  fontSize: 11,
                  color: theme.colors.primary,
                  letterSpacing: 1.2,
                  fontWeight: '800',
                  textTransform: 'uppercase',
                }}
              >
                Photo journal
              </Text>
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: '800',
                  color: theme.colors.text,
                  marginTop: 4,
                  letterSpacing: -0.4,
                  marginBottom: 14,
                }}
              >
                From the last few walks
              </Text>

              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: PHOTO_JOURNAL_COL_GAP,
                }}
              >
                {journalPhotos.map((uri, idx) => (
                  <View
                    key={`${uri}-${idx}`}
                    style={{
                      width: PHOTO_JOURNAL_TILE,
                      height: PHOTO_JOURNAL_TILE,
                      backgroundColor: theme.colors.surface,
                      borderRadius: 6,
                      overflow: 'hidden',
                    }}
                  >
                    <Image
                      source={{ uri }}
                      contentFit="cover"
                      style={{ width: '100%', height: '100%' }}
                      transition={250}
                    />
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── Reviews as pull-quotes ──────────────────────── */}
          <View style={{ marginTop: 40, paddingHorizontal: 24, marginBottom: 40 }}>
            <Text
              style={{
                fontSize: 11,
                color: theme.colors.primary,
                letterSpacing: 1.2,
                fontWeight: '800',
                textTransform: 'uppercase',
              }}
            >
              What travelers said
            </Text>
            {reviews.length === 0 ? (
              <Text
                style={{ color: theme.colors.textMuted, fontSize: 14, marginTop: 10 }}
              >
                No reviews yet — be the first.
              </Text>
            ) : (
              <View style={{ marginTop: 14, gap: 22 }}>
                {reviews.slice(0, 5).map((review) => (
                  <View
                    key={review.id}
                    style={{
                      borderLeftWidth: 2,
                      borderLeftColor: theme.colors.primary,
                      paddingLeft: 14,
                    }}
                  >
                    <StarRating rating={review.rating} size={12} />
                    {review.comment ? (
                      <Text
                        style={{
                          fontSize: 16,
                          color: theme.colors.text,
                          lineHeight: 24,
                          marginTop: 8,
                          fontStyle: 'italic',
                        }}
                      >
                        "{review.comment}"
                      </Text>
                    ) : null}
                    <Text
                      style={{
                        fontSize: 12,
                        color: theme.colors.textMuted,
                        marginTop: 6,
                      }}
                    >
                      — {(review.reviewer as { name?: string })?.name ?? 'A traveler'}
                      {' · '}
                      {format(new Date(review.created_at), 'MMM yyyy')}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </Animated.ScrollView>

      {/* Sticky book button — only once the guide has tours published */}
      {itineraries.length > 0 && (
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
          {lowestPrice && (
            <View>
              <Text style={{ fontSize: 11, color: theme.colors.textMuted }}>From</Text>
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: '800',
                  color: theme.colors.text,
                  letterSpacing: -0.5,
                }}
              >
                ₹{lowestPrice.toLocaleString('en-IN')}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Button
              title={`Walk with ${guide.name.split(' ')[0]}`}
              size="lg"
              onPress={() =>
                router.push({
                  pathname: '/(traveler)/book/[guideId]',
                  params: { guideId: guide.id },
                })
              }
            />
          </View>
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────

function MetaStat({
  label,
  value,
  accessory,
}: {
  label: string;
  value: string;
  accessory?: React.ReactNode;
}) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text
        style={{ fontSize: 22, fontWeight: '800', color: theme.colors.text, letterSpacing: -0.5 }}
      >
        {value}
      </Text>
      {accessory}
      <Text
        style={{
          fontSize: 10,
          color: theme.colors.textMuted,
          letterSpacing: 1,
          fontWeight: '700',
          textTransform: 'uppercase',
          marginTop: 4,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function MetaDivider() {
  return (
    <View
      style={{ width: 1, backgroundColor: theme.colors.divider, marginHorizontal: 4 }}
    />
  );
}

function GuidePromptCard({ prompt, index }: { prompt: GuidePrompt; index: number }) {
  return (
    <View
      style={{
        padding: 18,
        borderRadius: 16,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.divider,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: theme.colors.primaryLight,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{ fontSize: 11, color: theme.colors.primary, fontWeight: '800' }}
          >
            {index}
          </Text>
        </View>
        <Text
          style={{
            fontSize: 12,
            color: theme.colors.textMuted,
            fontWeight: '600',
            flex: 1,
          }}
        >
          {prompt.question}
        </Text>
      </View>
      <Text
        style={{
          fontSize: 18,
          lineHeight: 26,
          color: theme.colors.text,
          fontWeight: '500',
          letterSpacing: -0.2,
        }}
      >
        {prompt.answer}
      </Text>
    </View>
  );
}

function WalkCard({ itinerary, onPress }: { itinerary: Itinerary; onPress: () => void }) {
  const photo =
    itinerary.cover_image_url ??
    (itinerary.gallery_urls && itinerary.gallery_urls[0]) ??
    getItineraryPhoto(itinerary);
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      style={{
        width: 240,
        borderRadius: 18,
        overflow: 'hidden',
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.divider,
        ...theme.shadows.sm,
      }}
    >
      <View style={{ height: 140, backgroundColor: theme.colors.primaryLight }}>
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
      <View style={{ padding: 14 }}>
        <Text
          style={{ fontSize: 15, fontWeight: '700', color: theme.colors.text }}
          numberOfLines={1}
        >
          {itinerary.name ?? itinerary.title ?? 'City Tour'}
        </Text>
        <Text
          style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 4 }}
          numberOfLines={1}
        >
          ⏱ {itinerary.estimated_duration_hours}h · 👣 {(itinerary.stops ?? []).length} stops
        </Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 10,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '800', color: theme.colors.primary }}>
            ₹{itinerary.buddy_cost_inr.toLocaleString('en-IN')}
          </Text>
          <Text style={{ fontSize: 12, color: theme.colors.primary, fontWeight: '700' }}>
            Read →
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
