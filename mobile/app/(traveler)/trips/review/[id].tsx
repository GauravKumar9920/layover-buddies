import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withSpring,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { Header } from '@/components/ui/Header';
import { Button } from '@/components/ui/Button';
import { StarRating } from '@/components/ui/StarRating';
import { Card } from '@/components/ui/Card';
import { fetchBookingById } from '@/lib/api/bookings';
import { submitReview, fetchReviewForBooking } from '@/lib/api/reviews';
import { hapticImpactMedium, hapticSuccess, hapticError, hapticWarning } from '@/lib/haptics';
import { theme } from '@/config/theme';
import type { Booking, Review } from '@/types';

const MAX_COMMENT = 500;

const RATING_LABELS: Record<number, string> = {
  0: 'Tap to rate',
  1: '😞 Poor',
  2: '😐 Fair',
  3: '🙂 Good',
  4: '😊 Very Good',
  5: '🤩 Exceptional!',
};

// ─── Success screen ───────────────────────────────────────────────────────────
function SuccessView({ guideName, tripId }: { guideName: string; tripId: string }) {
  const router = useRouter();
  const starScale = useSharedValue(0);
  const textOpacity = useSharedValue(0);

  useEffect(() => {
    starScale.value = withSequence(
      withSpring(1.3, { damping: 8, stiffness: 200 }),
      withSpring(1, { damping: 12, stiffness: 120 }),
    );
    textOpacity.value = withDelay(300, withTiming(1, { duration: 400 }));
  }, []);

  const starStyle = useAnimatedStyle(() => ({ transform: [{ scale: starScale.value }] }));
  const textStyle = useAnimatedStyle(() => ({ opacity: textOpacity.value }));

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background, padding: 40 }}>
      <Animated.Text style={[{ fontSize: 80 }, starStyle]}>🌟</Animated.Text>
      <Animated.View style={[{ alignItems: 'center' }, textStyle]}>
        <Text style={{ fontSize: 26, fontWeight: '800', color: theme.colors.text, marginTop: 20, textAlign: 'center' }}>
          Review Submitted!
        </Text>
        <Text style={{ fontSize: 15, color: theme.colors.textSecondary, marginTop: 10, textAlign: 'center', lineHeight: 22 }}>
          Your review for {guideName} is live. Future travelers will thank you.
        </Text>
        <Button
          title="Back to Trip"
          onPress={() => router.replace(`/(traveler)/trips/${tripId}` as never)}
          style={{ marginTop: 32, minWidth: 200 }}
          size="lg"
        />
        <TouchableOpacity
          onPress={() => router.replace('/(traveler)/trips/')}
          style={{ marginTop: 14 }}
        >
          <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>View all trips</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ─── Already-reviewed screen ─────────────────────────────────────────────────
function AlreadyReviewedView({ existing, guideName, tripId }: { existing: Review; guideName: string; tripId: string }) {
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Header title="Your Review" showBack />
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <Card style={{ alignItems: 'center', padding: 24 }}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>✅</Text>
          <Text style={{ fontSize: 18, fontWeight: '700', color: theme.colors.text, textAlign: 'center' }}>
            You've already reviewed {guideName}
          </Text>
          <Text style={{ color: theme.colors.textSecondary, fontSize: 14, marginTop: 8, textAlign: 'center' }}>
            Only one review per booking is allowed.
          </Text>
        </Card>

        {/* Show the existing review */}
        <Card style={{ marginTop: 20 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.text, marginBottom: 10 }}>
            Your review
          </Text>
          <StarRating rating={existing.rating} size={22} />
          {existing.comment ? (
            <Text style={{ fontSize: 14, color: theme.colors.textSecondary, marginTop: 10, lineHeight: 20 }}>
              "{existing.comment}"
            </Text>
          ) : null}
        </Card>

        <Button
          title="Back to Trip"
          onPress={() => router.replace(`/(traveler)/trips/${tripId}` as never)}
          style={{ marginTop: 24 }}
          size="lg"
        />
      </ScrollView>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function ReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [existingReview, setExistingReview] = useState<Review | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Star pop animation on each tap
  const starContainerScale = useSharedValue(1);
  const starContainerStyle = useAnimatedStyle(() => ({ transform: [{ scale: starContainerScale.value }] }));

  useEffect(() => {
    if (!id) return;
    Promise.all([fetchBookingById(id), fetchReviewForBooking(id)])
      .then(([b, existing]) => {
        setBooking(b);
        setExistingReview(existing);
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : 'Failed to load booking.');
      })
      .finally(() => setLoading(false));
  }, [id]);

  function handleRatePress(r: number) {
    hapticImpactMedium();
    setRating(r);
    starContainerScale.value = withSequence(
      withSpring(1.08, { damping: 10, stiffness: 200 }),
      withSpring(1, { damping: 12, stiffness: 150 }),
    );
  }

  async function handleSubmit() {
    setSubmitError(null);

    if (rating === 0) {
      hapticWarning();
      setSubmitError('Please select a star rating before submitting.');
      return;
    }
    if (!booking?.guide_id) return;

    hapticImpactMedium();
    setSubmitting(true);
    try {
      await submitReview({
        booking_id: booking.id,
        reviewee_id: booking.guide_id,
        rating,
        comment: comment.trim() || undefined,
      });
      hapticSuccess();
      setSubmitted(true);
    } catch (err: unknown) {
      hapticError();
      const msg = err instanceof Error ? err.message : 'Failed to submit review.';
      // Detect unique constraint violation (already reviewed)
      if (msg.includes('duplicate') || msg.includes('unique') || msg.includes('23505')) {
        setSubmitError("You've already submitted a review for this booking.");
      } else {
        setSubmitError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <Header title="Leave a Review" showBack />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  // ── Load error ────────────────────────────────────────────────────────────
  if (loadError || !booking) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <Header title="Leave a Review" showBack />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
          <Text style={{ fontSize: 40 }}>⚠️</Text>
          <Text style={{ color: theme.colors.textSecondary, fontSize: 15, marginTop: 16, textAlign: 'center' }}>
            {loadError ?? 'Booking not found.'}
          </Text>
          <Button title="Go Back" onPress={() => router.back()} style={{ marginTop: 24 }} variant="secondary" />
        </View>
      </View>
    );
  }

  // ── Guard: booking must be completed ─────────────────────────────────────
  if (booking.status !== 'completed') {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <Header title="Leave a Review" showBack />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
          <Text style={{ fontSize: 40 }}>🔒</Text>
          <Text style={{ fontSize: 18, fontWeight: '700', color: theme.colors.text, marginTop: 16, textAlign: 'center' }}>
            Tour not yet completed
          </Text>
          <Text style={{ color: theme.colors.textSecondary, fontSize: 14, marginTop: 8, textAlign: 'center', lineHeight: 20 }}>
            Reviews can only be submitted after the tour is marked as completed.
          </Text>
          <Button title="Go Back" onPress={() => router.back()} style={{ marginTop: 24 }} variant="secondary" />
        </View>
      </View>
    );
  }

  // ── Already reviewed ──────────────────────────────────────────────────────
  if (existingReview) {
    return (
      <AlreadyReviewedView
        existing={existingReview}
        guideName={booking.guide?.name ?? 'your guide'}
        tripId={id ?? ''}
      />
    );
  }

  // ── Success ───────────────────────────────────────────────────────────────
  if (submitted) {
    return <SuccessView guideName={booking.guide?.name ?? 'your guide'} tripId={id ?? ''} />;
  }

  const charsLeft = MAX_COMMENT - comment.length;

  // ── Review form ───────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={{ paddingTop: insets.top }}>
        <Header title="Leave a Review" showBack />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 24, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Guide name + itinerary */}
        <Text style={{ ...theme.typography.h2, color: theme.colors.text, marginBottom: 4 }}>
          How was your experience?
        </Text>
        <Text style={{ color: theme.colors.textSecondary, fontSize: 14, marginBottom: 32, lineHeight: 20 }}>
          {booking.guide?.name
            ? `Rate your tour with ${booking.guide.name}`
            : 'Rate your guide'}
          {booking.itinerary?.name ? ` · ${booking.itinerary.name}` : ''}
        </Text>

        {/* ── Star picker ───────────────────────────────────────────────── */}
        <View style={{ alignItems: 'center', marginBottom: 36 }}>
          <Animated.View style={starContainerStyle}>
            <StarRating
              rating={rating}
              size={52}
              interactive
              onRate={handleRatePress}
            />
          </Animated.View>
          <Text style={{
            marginTop: 12,
            fontSize: 16,
            fontWeight: rating > 0 ? '700' : '400',
            color: rating > 0 ? theme.colors.text : theme.colors.textMuted,
          }}>
            {RATING_LABELS[rating]}
          </Text>
        </View>

        {/* ── Comment ───────────────────────────────────────────────────── */}
        <View style={{ marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Tell us more (optional)
            </Text>
            <Text style={{
              fontSize: 12,
              color: charsLeft < 50 ? theme.colors.warning : theme.colors.textMuted,
            }}>
              {charsLeft}
            </Text>
          </View>
          <TextInput
            value={comment}
            onChangeText={(t) => { if (t.length <= MAX_COMMENT) setComment(t); }}
            placeholder="What made this experience special? Any tips for future travelers?"
            multiline
            textAlignVertical="top"
            maxLength={MAX_COMMENT}
            style={{
              backgroundColor: theme.colors.surface,
              borderWidth: 1.5,
              borderColor: theme.colors.divider,
              borderRadius: theme.borderRadius.md,
              padding: 14,
              fontSize: 15,
              color: theme.colors.text,
              lineHeight: 22,
              minHeight: 130,
            }}
            placeholderTextColor={theme.colors.textMuted}
          />
        </View>

        {/* ── Error ─────────────────────────────────────────────────────── */}
        {submitError ? (
          <View style={{
            marginBottom: 16,
            backgroundColor: theme.colors.accentLight,
            borderRadius: theme.borderRadius.md,
            borderLeftWidth: 3,
            borderLeftColor: theme.colors.error,
            padding: 12,
          }}>
            <Text style={{ fontSize: 13, color: theme.colors.error, fontWeight: '500' }}>{submitError}</Text>
          </View>
        ) : null}

        {/* ── Submit ────────────────────────────────────────────────────── */}
        <Button
          title="Submit Review"
          onPress={handleSubmit}
          loading={submitting}
          disabled={rating === 0 || submitting}
          size="lg"
        />

        <Text style={{ color: theme.colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 12, lineHeight: 16 }}>
          Reviews are public and help future travelers choose the right guide.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
