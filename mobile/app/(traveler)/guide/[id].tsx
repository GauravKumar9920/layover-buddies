import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
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
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { fetchGuideById, fetchGuideItineraries, fetchGuideReviews } from '@/lib/api/guides';
import { theme } from '@/config/theme';
import { CATEGORY_COLORS } from '@/config/constants';
import { getGuideHeroPhoto, getItineraryPhoto } from '@/config/photoLibrary';
import { format } from 'date-fns';
import type { GuideProfile, Itinerary, Review } from '@/types';

const HERO_HEIGHT = 260;

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
        translateY: interpolate(scrollY.value, [0, HERO_HEIGHT], [0, HERO_HEIGHT * 0.5], Extrapolate.CLAMP),
      },
    ],
    opacity: interpolate(scrollY.value, [0, HERO_HEIGHT], [1, 0.4], Extrapolate.CLAMP),
  }));

  // Back button fade
  const backBgStyle = useAnimatedStyle(() => ({
    backgroundColor: `rgba(26,26,46,${interpolate(scrollY.value, [0, 100], [0, 0.85], Extrapolate.CLAMP)})`,
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

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!guide) {
    return <EmptyState title="Guide not found" style={{ flex: 1 }} />;
  }

  const lowestPrice = itineraries.length > 0
    ? Math.min(...itineraries.map((i) => i.buddy_cost_inr))
    : null;
  const heroPhoto = getGuideHeroPhoto(guide);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {/* Back Button */}
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
          style={{ padding: 8 }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 22 }}>‹</Text>
        </TouchableOpacity>
      </Animated.View>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {/* Parallax Hero Image */}
        <View style={{ height: HERO_HEIGHT, overflow: 'hidden' }}>
          <Animated.View style={[{ width: '100%', height: HERO_HEIGHT + 80 }, heroStyle]}>
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
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.4)']}
              start={{ x: 0.5, y: 0.4 }}
              end={{ x: 0.5, y: 1 }}
              style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 100 }}
            />
          </Animated.View>
        </View>

        {/* Profile Content */}
        <View
          style={{
            backgroundColor: theme.colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            marginTop: -24,
            paddingHorizontal: 20,
            paddingTop: 24,
          }}
        >
          {/* Name, Rating, Price */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 28, fontWeight: '800', color: theme.colors.text, letterSpacing: -0.5 }}>
                {guide.name}
              </Text>
              {guide.hometown && (
                <Text style={{ fontSize: 14, color: theme.colors.textSecondary, marginTop: 4 }}>
                  📍 {guide.hometown}
                </Text>
              )}
            </View>
            {lowestPrice && (
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 24, fontWeight: '800', color: theme.colors.primary }}>
                  ₹{lowestPrice.toLocaleString('en-IN')}
                </Text>
                <Text style={{ fontSize: 11, color: theme.colors.textMuted }}>from per tour</Text>
              </View>
            )}
          </View>

          {/* Rating Row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
            <StarRating rating={guide.avg_rating} size={18} animate />
            <Text style={{ fontSize: 16, fontWeight: '700', color: theme.colors.text }}>
              {guide.avg_rating > 0 ? guide.avg_rating.toFixed(1) : 'New'}
            </Text>
            <Text style={{ fontSize: 14, color: theme.colors.textSecondary }}>
              ({guide.total_reviews} {guide.total_reviews === 1 ? 'review' : 'reviews'})
            </Text>
          </View>

          {/* Categories */}
          {guide.categories?.length > 0 && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              {guide.categories.map((cat) => {
                const colors = CATEGORY_COLORS[cat] ?? { bg: '#F3F4F6', text: '#6B7280' };
                return (
                  <View
                    key={cat}
                    style={{ backgroundColor: colors.bg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}
                  >
                    <Text style={{ fontSize: 12, color: colors.text, fontWeight: '600' }}>#{cat}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Languages */}
          {guide.languages?.length > 0 && (
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              {guide.languages.map((lang) => (
                <View
                  key={lang}
                  style={{
                    backgroundColor: theme.colors.primaryLight,
                    borderRadius: theme.borderRadius.sm,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                  }}
                >
                  <Text style={{ fontSize: 12, color: theme.colors.primary, fontWeight: '500' }}>
                    🗣 {lang}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Bio */}
          {guide.bio && (
            <View style={{ marginTop: 20 }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: theme.colors.text, marginBottom: 8 }}>
                About {guide.name}
              </Text>
              <Text style={{ fontSize: 15, color: theme.colors.textSecondary, lineHeight: 22 }}>
                {guide.bio}
              </Text>
            </View>
          )}

          {/* Itineraries */}
          <View style={{ marginTop: 28 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: theme.colors.text, marginBottom: 16 }}>
              Tours Offered
            </Text>
            {itineraries.length === 0 ? (
              <Text style={{ color: theme.colors.textMuted, fontSize: 14 }}>
                No active tours yet.
              </Text>
            ) : (
              itineraries.map((itin) => (
                <TouchableOpacity
                  key={itin.id}
                  activeOpacity={0.85}
                  onPress={() => router.push({ pathname: '/(traveler)/itinerary/[id]', params: { id: itin.id } })}
                >
                <Card style={{ marginBottom: 12 }}>
                  {getItineraryPhoto(itin) && (
                    <View style={{ height: 130, borderRadius: 12, overflow: 'hidden', marginBottom: 10 }}>
                      <Image
                        source={{ uri: getItineraryPhoto(itin) as string }}
                        contentFit="cover"
                        style={{ width: '100%', height: '100%' }}
                        transition={250}
                      />
                      <LinearGradient
                        colors={['transparent', 'rgba(15, 23, 42, 0.4)']}
                        start={{ x: 0.5, y: 0.1 }}
                        end={{ x: 0.5, y: 1 }}
                        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 60 }}
                      />
                    </View>
                  )}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: theme.colors.text, flex: 1 }}>
                      {itin.name ?? itin.title ?? 'City Tour'}
                    </Text>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: theme.colors.primary }}>
                      ₹{itin.buddy_cost_inr.toLocaleString('en-IN')}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginTop: 4 }}>
                    📍 {itin.city}  ·  ⏱ {itin.estimated_duration_hours}h tour
                  </Text>
                  {itin.description && (
                    <Text style={{ fontSize: 14, color: theme.colors.textSecondary, marginTop: 8, lineHeight: 20 }} numberOfLines={3}>
                      {itin.description}
                    </Text>
                  )}
                  {itin.stops && itin.stops.length > 0 && (
                    <View style={{ marginTop: 10 }}>
                      {itin.stops.slice(0, 3).map((stop, idx) => (
                        <View key={stop.id} style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                          <View
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: 10,
                              backgroundColor: theme.colors.primaryLight,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Text style={{ fontSize: 10, color: theme.colors.primary, fontWeight: '700' }}>
                              {idx + 1}
                            </Text>
                          </View>
                          <Text style={{ fontSize: 13, color: theme.colors.text, flex: 1 }}>
                            {stop.location}
                          </Text>
                        </View>
                      ))}
                      {itin.stops.length > 3 && (
                        <Text style={{ fontSize: 12, color: theme.colors.textMuted, marginTop: 4, marginLeft: 28 }}>
                          +{itin.stops.length - 3} more stops
                        </Text>
                      )}
                    </View>
                  )}
                  <Button
                    title="See the full story"
                    onPress={() => router.push({ pathname: '/(traveler)/itinerary/[id]', params: { id: itin.id } })}
                    style={{ marginTop: 14 }}
                  />
                </Card>
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* Reviews */}
          <View style={{ marginTop: 28, marginBottom: 40 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: theme.colors.text, marginBottom: 16 }}>
              Reviews ({reviews.length})
            </Text>
            {reviews.length === 0 ? (
              <Text style={{ color: theme.colors.textMuted, fontSize: 14 }}>
                No reviews yet — be the first!
              </Text>
            ) : (
              reviews.map((review) => (
                <Card key={review.id} style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.text }}>
                        {(review.reviewer as { name?: string })?.name ?? 'Traveler'}
                      </Text>
                      <Text style={{ fontSize: 12, color: theme.colors.textMuted, marginTop: 2 }}>
                        {format(new Date(review.created_at), 'MMM d, yyyy')}
                      </Text>
                    </View>
                    <StarRating rating={review.rating} size={14} />
                  </View>
                  {review.comment && (
                    <Text style={{ fontSize: 14, color: theme.colors.textSecondary, marginTop: 8, lineHeight: 20 }}>
                      {review.comment}
                    </Text>
                  )}
                </Card>
              ))
            )}
          </View>
        </View>
      </Animated.ScrollView>

      {/* Sticky Book Button */}
      {itineraries.length > 0 && (
        <View
          style={{
            position: 'absolute',
            bottom: insets.bottom + 16,
            left: 20,
            right: 20,
          }}
        >
          <Button
            title={`Book ${guide.name} →`}
            onPress={() => router.push({ pathname: '/(traveler)/book/[guideId]', params: { guideId: guide.id } })}
            size="lg"
            style={{ ...theme.shadows.xl }}
          />
        </View>
      )}
    </View>
  );
}
