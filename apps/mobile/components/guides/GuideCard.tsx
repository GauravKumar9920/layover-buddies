import { View, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { StarRating } from '@/components/ui/StarRating';
import { theme } from '@/config/theme';
import { getGuideHeroPhoto, getGuideAvatar } from '@/config/photoLibrary';
import { hapticImpactLight } from '@/lib/haptics';
import { interestOverlap, computeTimeFit } from '@/lib/booking/timeFit';
import { TimeFitChip } from '@/components/ui/TimeFitChip';
import { formatRupees } from '@/lib/booking/tourPricing';
import type { GuideProfile } from '@/types';

interface GuideCardProps {
  guide: GuideProfile;
  index?: number;
  itineraryPrice?: number;
  /** Traveler interests selected at onboarding — used to render an
   *  "Matches your N interests" badge when there's overlap. */
  travelerInterests?: string[] | null;
  /** Traveler layover (departure − arrival) in hours; powers the green /
   *  yellow / red time-fit chip. Pass null when not yet known. */
  layoverHours?: number | null;
  /** Shortest itinerary duration (hours) this guide offers — feeds the
   *  time-fit calculation. Defaults to a reasonable 3h when not provided. */
  shortestTourHours?: number | null;
}

// A small mono uppercase "stamp" — the recurring tag motif from the
// marketing site. Optional dark variant for image overlays.
function Stamp({ label, tone = 'paper' }: { label: string; tone?: 'paper' | 'ink' | 'marigold' }) {
  const styles =
    tone === 'ink'
      ? { bg: 'rgba(14,25,41,0.62)', fg: '#FCF7EA', border: 'rgba(255,255,255,0.18)' }
      : tone === 'marigold'
      ? { bg: theme.colors.gold, fg: theme.colors.text, border: 'rgba(14,25,41,0.22)' }
      : { bg: theme.colors.surfaceMuted, fg: theme.colors.textSecondary, border: 'rgba(14,25,41,0.12)' };
  return (
    <View style={{
      backgroundColor: styles.bg, borderWidth: 1, borderColor: styles.border,
      borderRadius: theme.borderRadius.sm, paddingHorizontal: 7, paddingVertical: 3,
    }}>
      <Text style={{
        fontFamily: theme.fonts.monoMed, fontSize: 9.5, letterSpacing: 0.6,
        textTransform: 'uppercase', color: styles.fg,
      }}>
        {label}
      </Text>
    </View>
  );
}

export function GuideCard({
  guide, index = 0, itineraryPrice,
  travelerInterests, layoverHours, shortestTourHours,
}: GuideCardProps) {
  const router = useRouter();
  const scale = useSharedValue(1);

  // Stagger entrance animation
  const translateY = useSharedValue(30);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const delay = index * 100;
    translateY.value = withDelay(delay, withSpring(0, { damping: 20, stiffness: 90 }));
    opacity.value = withDelay(delay, withTiming(1, { duration: 400, easing: Easing.bezier(0.25, 0.1, 0.25, 1) }));
  }, [index]);

  const entranceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  function handlePress() {
    router.push(`/(traveler)/guide/${guide.id}`);
  }

  const isNewGuide = guide.total_reviews === 0;
  const displayRating = isNewGuide ? null : guide.avg_rating;
  const heroPhoto = getGuideHeroPhoto(guide);
  const avatarPhoto = getGuideAvatar(guide);
  const initials = (guide.name || 'G')
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const overlap = interestOverlap(guide.categories, travelerInterests ?? null);
  // Prefer the duration the caller passed; otherwise the one the list query
  // derived. Never a default — see TimeFitChip.
  const tourHours = shortestTourHours ?? guide.shortest_tour_hours ?? null;
  const showFit = computeTimeFit(layoverHours ?? null, tourHours) !== null;

  return (
    <Animated.View style={[entranceStyle, { marginBottom: 16 }]}>
      <Animated.View style={pressStyle}>
        <Pressable
          onPress={handlePress}
          onPressIn={() => {
            scale.value = withSpring(0.97, { damping: 15, stiffness: 150 });
            hapticImpactLight();
          }}
          onPressOut={() => scale.value = withSpring(1, { damping: 15, stiffness: 150 })}
        >
          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderRadius: theme.borderRadius.lg,
              borderWidth: 1,
              borderColor: 'rgba(14,25,41,0.12)',
              overflow: 'hidden',
              ...theme.shadows.md,
            }}
          >
            {/* Hero Image */}
            {/* Aspect-ratio hero so the photo scales with the card width
                instead of sitting as a short fixed-height strip (looked tiny
                on wider viewports). 16:9 is a comfortable, prominent crop. */}
            <View style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: theme.colors.surfaceMuted, position: 'relative' }}>
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
                  <Text style={{ fontFamily: theme.fonts.serif, fontSize: 30, color: '#FCF7EA' }}>
                    Mumbai
                  </Text>
                </LinearGradient>
              )}
              {/* Bottom ink gradient for legibility */}
              <LinearGradient
                colors={['transparent', 'rgba(14,25,41,0.30)']}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as object}
              />
              {/* Stamp moved to the top so the portrait can sit at the
                  bottom-left of the photo without overlapping it. */}
              <View style={{ position: 'absolute', left: 12, top: 12 }}>
                <Stamp label="Local photo route" tone="ink" />
              </View>
              {isNewGuide && (
                <View style={{ position: 'absolute', top: 12, right: 12 }}>
                  <Stamp label="New guide" tone="marigold" />
                </View>
              )}

              {/* Guide portrait — floats on the hero image, just above the
                  content, so it never crowds the name/text below. */}
              <View style={{ position: 'absolute', left: 16, bottom: 14 }}>
                {avatarPhoto ? (
                  <Image
                    source={{ uri: avatarPhoto }}
                    contentFit="cover"
                    transition={300}
                    style={{
                      width: 58, height: 58, borderRadius: 29,
                      borderWidth: 3, borderColor: theme.colors.surface,
                      backgroundColor: theme.colors.surfaceMuted,
                      ...theme.shadows.md,
                    }}
                  />
                ) : (
                  <View style={{
                    width: 58, height: 58, borderRadius: 29,
                    backgroundColor: theme.colors.primaryLight,
                    borderWidth: 3, borderColor: theme.colors.surface,
                    alignItems: 'center', justifyContent: 'center',
                    ...theme.shadows.md,
                  }}>
                    <Text style={{ fontFamily: theme.fonts.display, fontSize: 22, color: theme.colors.primary }}>
                      {initials}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Content */}
            <View style={{ padding: 16 }}>
              {/* Time-fit + interest-match chips */}
              {(showFit || overlap > 0) && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  <TimeFitChip layoverHours={layoverHours} tourHours={tourHours} />
                  {overlap > 0 && (
                    <View style={{
                      backgroundColor: theme.colors.primaryLight,
                      borderWidth: 1, borderColor: 'rgba(200,84,42,0.30)',
                      borderRadius: theme.borderRadius.sm, paddingHorizontal: 8, paddingVertical: 3,
                    }}>
                      <Text style={{
                        fontFamily: theme.fonts.monoMed, fontSize: 10, letterSpacing: 0.4,
                        textTransform: 'uppercase', color: theme.colors.primaryDark,
                      }}>
                        Matches {overlap} interest{overlap === 1 ? '' : 's'}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Name & Location */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text
                    style={{ fontFamily: theme.fonts.display, fontSize: 19, color: theme.colors.text, letterSpacing: -0.3 }}
                    numberOfLines={1}
                  >
                    {guide.name}
                  </Text>
                  {guide.hometown && (
                    <Text style={{
                      fontFamily: theme.fonts.mono, fontSize: 11, letterSpacing: 0.4,
                      color: theme.colors.textMuted, marginTop: 3, textTransform: 'uppercase',
                    }}>
                      {guide.hometown}
                    </Text>
                  )}
                </View>

                {/* Price */}
                {(itineraryPrice ?? guide.from_price_inr) ? (
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontFamily: theme.fonts.monoMed, fontSize: 18, color: theme.colors.primary, letterSpacing: -0.5 }}>
                      {formatRupees((itineraryPrice ?? guide.from_price_inr)!)}
                    </Text>
                    <Text style={{
                      fontFamily: theme.fonts.mono, fontSize: 9.5, color: theme.colors.textMuted,
                      letterSpacing: 0.4, textTransform: 'uppercase',
                    }}>
                      from
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Rating */}
              {displayRating !== null && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
                  <StarRating rating={displayRating} size={14} />
                  <Text style={{ fontFamily: theme.fonts.monoMed, fontSize: 12, color: theme.colors.text }}>
                    {displayRating.toFixed(1)}
                    <Text style={{ fontFamily: theme.fonts.mono, color: theme.colors.textMuted }}>
                      {'  '}{guide.total_reviews} {guide.total_reviews === 1 ? 'review' : 'reviews'}
                    </Text>
                  </Text>
                </View>
              )}

              {/* Languages + categories as uniform warm tags */}
              {(guide.languages?.length > 0 || guide.categories?.length > 0) && (
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                  {guide.languages?.slice(0, 2).map((lang) => (
                    <View key={lang} style={{
                      backgroundColor: theme.colors.accentLight,
                      borderWidth: 1, borderColor: 'rgba(45,123,169,0.25)',
                      borderRadius: theme.borderRadius.sm, paddingHorizontal: 8, paddingVertical: 3,
                    }}>
                      <Text style={{ fontFamily: theme.fonts.bodyMed, fontSize: 11, color: theme.colors.accentDark }}>
                        {lang}
                      </Text>
                    </View>
                  ))}
                  {guide.categories?.slice(0, 2).map((cat) => (
                    <View key={cat} style={{
                      backgroundColor: theme.colors.surfaceMuted,
                      borderWidth: 1, borderColor: 'rgba(14,25,41,0.10)',
                      borderRadius: theme.borderRadius.sm, paddingHorizontal: 8, paddingVertical: 3,
                    }}>
                      <Text style={{ fontFamily: theme.fonts.bodyMed, fontSize: 11, color: theme.colors.textSecondary }}>
                        {cat}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Footer */}
              <View style={{
                flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(14,25,41,0.08)',
              }}>
                <Stamp label="Fast reply" />
                <View style={{
                  backgroundColor: theme.colors.primary,
                  borderWidth: 1.5, borderColor: theme.colors.primaryDark,
                  borderRadius: theme.borderRadius.full,
                  paddingHorizontal: 16, paddingVertical: 7,
                }}>
                  <Text style={{ fontFamily: theme.fonts.bodyBold, color: '#FCF7EA', fontSize: 13 }}>
                    View profile
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}
