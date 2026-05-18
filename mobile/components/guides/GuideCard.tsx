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
import { CATEGORY_COLORS } from '@/config/constants';
import { getGuideHeroPhoto } from '@/config/photoLibrary';
import { hapticImpactLight } from '@/lib/haptics';
import { interestOverlap, computeTimeFit, timeFitLabel } from '@/lib/booking/timeFit';
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

  // Interest-match + time-fit chips. Both are nullable so a fresh traveler
  // (no onboarding yet) sees the same plain card as before.
  const overlap = interestOverlap(guide.categories, travelerInterests ?? null);
  const timeFit = timeFitLabel(
    computeTimeFit(layoverHours ?? null, shortestTourHours ?? 3),
  );

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
              backgroundColor: '#FFFFFF',
              borderRadius: theme.borderRadius.lg,
              overflow: 'hidden',
              ...theme.shadows.md,
            }}
          >
            {/* Hero Image */}
            <View style={{ height: 160, backgroundColor: theme.colors.primaryLight, position: 'relative' }}>
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
                  <Text style={{ fontSize: 48 }}>🗺️</Text>
                </LinearGradient>
              )}
              {/* Gradient overlay */}
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.25)']}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={{ position: 'absolute', inset: 0 } as object}
              />
              <View
                style={{
                  position: 'absolute',
                  left: 10,
                  bottom: 10,
                  backgroundColor: 'rgba(15, 23, 42, 0.55)',
                  borderRadius: theme.borderRadius.sm,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>
                  Local photo route
                </Text>
              </View>
              {isNewGuide && (
                <View
                  style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    backgroundColor: theme.colors.gold,
                    borderRadius: theme.borderRadius.sm,
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>NEW GUIDE</Text>
                </View>
              )}
            </View>

            {/* Content */}
            <View style={{ padding: 16 }}>
              {/* Time-fit + interest-match chips */}
              {(timeFit || overlap > 0) && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  {timeFit && (
                    <View style={{
                      flexDirection: 'row', alignItems: 'center', gap: 4,
                      backgroundColor: timeFit.tone + '15',
                      borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4,
                    }}>
                      <Text style={{ fontSize: 11 }}>{timeFit.emoji}</Text>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: timeFit.tone }}>
                        {timeFit.text}
                      </Text>
                    </View>
                  )}
                  {overlap > 0 && (
                    <View style={{
                      flexDirection: 'row', alignItems: 'center', gap: 4,
                      backgroundColor: theme.colors.primaryLight,
                      borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4,
                    }}>
                      <Text style={{ fontSize: 11 }}>✨</Text>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.primary }}>
                        Matches {overlap} of your interests
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Name & Location */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ fontSize: 17, fontWeight: '700', color: theme.colors.text }}
                    numberOfLines={1}
                  >
                    {guide.name}
                  </Text>
                  {guide.hometown && (
                    <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 }}>
                      📍 {guide.hometown}
                    </Text>
                  )}
                </View>

                {/* Price */}
                {itineraryPrice && (
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: theme.colors.primary }}>
                      ₹{itineraryPrice.toLocaleString('en-IN')}
                    </Text>
                    <Text style={{ fontSize: 11, color: theme.colors.textMuted }}>per tour</Text>
                  </View>
                )}
              </View>

              {/* Rating */}
              {displayRating !== null && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                  <StarRating rating={displayRating} size={14} />
                  <Text style={{ fontSize: 13, color: theme.colors.textSecondary }}>
                    {displayRating.toFixed(1)}
                    <Text style={{ color: theme.colors.textMuted }}>
                      {' '}({guide.total_reviews} {guide.total_reviews === 1 ? 'review' : 'reviews'})
                    </Text>
                  </Text>
                </View>
              )}

              {/* Languages */}
              {guide.languages?.length > 0 && (
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  {guide.languages.slice(0, 3).map((lang) => (
                    <View
                      key={lang}
                      style={{
                        backgroundColor: theme.colors.primaryLight,
                        borderRadius: theme.borderRadius.sm,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                      }}
                    >
                      <Text style={{ fontSize: 11, color: theme.colors.primary, fontWeight: '500' }}>
                        {lang}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Categories */}
              {guide.categories?.length > 0 && (
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  {guide.categories.slice(0, 3).map((cat) => {
                    const colors = CATEGORY_COLORS[cat] ?? { bg: '#F3F4F6', text: '#6B7280' };
                    return (
                      <View
                        key={cat}
                        style={{
                          backgroundColor: colors.bg,
                          borderRadius: theme.borderRadius.sm,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                        }}
                      >
                        <Text style={{ fontSize: 11, color: colors.text, fontWeight: '500' }}>
                          #{cat}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Footer */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                <Text style={{ fontSize: 12, color: theme.colors.textMuted }}>
                  ⚡ Fast reply
                </Text>
                <View
                  style={{
                    backgroundColor: theme.colors.primary,
                    borderRadius: theme.borderRadius.full,
                    paddingHorizontal: 14,
                    paddingVertical: 6,
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600' }}>
                    View Profile
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
