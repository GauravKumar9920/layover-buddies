import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import {
} from 'date-fns';
import { StarRating } from '@/components/ui/StarRating';
import { Card } from '@/components/ui/Card';
import { SkeletonLine } from '@/components/ui/Loading';
import { getItineraryPhoto, getGuideHeroPhoto, getGuideAvatar } from '@/config/photoLibrary';
import { BoardingPassReveal } from '@/components/bookings/BoardingPassReveal';
import { fetchGuideById, fetchGuideItineraries } from '@/lib/api/guides';
import { fetchMyTravelerProfile } from '@/lib/api/travelerProfile';
import { createBooking, calcCommission } from '@/lib/api/bookings';
import { sendMessage } from '@/lib/api/messages';
import { getEffectiveRates, EARLY_ACCESS_RATES, type EffectiveRates } from '@/lib/api/platformSettings';
import { hapticImpactMedium, hapticSuccess, hapticError } from '@/lib/haptics';
import { theme } from '@/config/theme';
import { ESTIMATED_EXPENSES_PERCENT, CURRENCY_SYMBOL } from '@/config/constants';
import type { GuideProfile, Itinerary } from '@/types';
import {
  computeLayoverPlan,
  timeFitLabel,
  TRANSIT_BUFFER_MINUTES,
} from '@/lib/booking/timeFit';
import { tourBuddyFeeInr, clampPartySize, formatFromPrice } from '@/lib/booking/tourPricing';
import { formatMumbaiTime, formatMumbaiShortDate } from '@/lib/dateTime';
import { TimeFitChip } from '@/components/ui/TimeFitChip';
import { TripSummaryCard } from '@/components/trip/TripSummaryCard';
import { LayoverEditorModal } from '@/components/profile/LayoverEditorModal';
import { useTravelerTrip } from '@/lib/hooks/useTravelerTrip';
import { createMyNextLayover } from '@/lib/api/travelerProfile';

const CARD_WIDTH = 288;
const CARD_IMAGE_HEIGHT = Math.round(CARD_WIDTH * (9 / 16));



// ─── Day overview ─────────────────────────────────────────────────────────────
/**
 * The traveler's day, laid out against their layover.
 *
 * Verdict and clock times both come from computeLayoverPlan — the same
 * function that powers the fit chip and that createBooking uses to stamp
 * tour_start_time onto the booking. This used to re-implement that maths
 * inline with its own copies of the 90/30-minute buffers and its own
 * green/amber/red hexes, so one tour could read differently in a list and
 * here. It also had a latent bug where "fits" and "won't fit" shared a
 * background colour.
 */
function DayOverview({
  arrivalIso, departureIso, tourDurationHours,
}: {
  arrivalIso: string | null;
  departureIso: string | null;
  tourDurationHours: number;
}) {
  const plan = useMemo(
    () => computeLayoverPlan({ arrivalIso, departureIso, tourHours: tourDurationHours }),
    [arrivalIso, departureIso, tourDurationHours],
  );
  if (!plan) return null;

  const label = timeFitLabel(plan.fit)!;
  const tone =
    plan.fit === 'green' ? theme.colors.success
      : plan.fit === 'yellow' ? theme.colors.gold
        : theme.colors.error;
  const toneText =
    plan.fit === 'green' ? '#2F6E45' : plan.fit === 'yellow' ? '#946312' : '#8E2C20';
  const hours = Math.floor(plan.totalMinutes / 60);
  const mins = plan.totalMinutes % 60;

  const rows = [
    { label: 'Land', value: formatMumbaiTime(arrivalIso!) },
    { label: 'Into the city', value: `~${TRANSIT_BUFFER_MINUTES} min` },
    { label: 'Tour starts', value: formatMumbaiTime(plan.tourStart.toISOString()) },
    { label: 'Tour ends', value: formatMumbaiTime(plan.tourEnd.toISOString()) },
    { label: 'Back to airport', value: `~${TRANSIT_BUFFER_MINUTES} min` },
    { label: 'Take off', value: formatMumbaiTime(departureIso!) },
  ];

  return (
    <Card style={{ marginTop: 4, marginBottom: 16 }}>
      <Text style={{ ...theme.typography.eyebrow, color: theme.colors.textMuted, marginBottom: 10 }}>
        Your day
      </Text>
      {rows.map((row) => (
        <View key={row.label} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
          <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textSecondary }}>
            {row.label}
          </Text>
          <Text style={{ fontFamily: theme.fonts.monoMed, fontSize: 13, color: theme.colors.text }}>
            {row.value}
          </Text>
        </View>
      ))}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 8,
        marginTop: 12, paddingTop: 12,
        borderTopWidth: 1, borderTopColor: theme.colors.divider,
      }}>
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: tone }} />
        <Text style={{ flex: 1, fontFamily: theme.fonts.bodySemi, fontSize: 12.5, color: toneText }}>
          {hours}h {mins > 0 ? `${mins}m ` : ''}layover · {label.text}
        </Text>
      </View>
    </Card>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────
function HeroSkeleton() {
  return (
    <LinearGradient
      colors={theme.gradients.hero}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ paddingHorizontal: 20, paddingBottom: 24, paddingTop: 16 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.15)' }} />
        <View style={{ gap: 8 }}>
          <SkeletonLine width={160} height={18} style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} />
          <SkeletonLine width={100} height={14} style={{ backgroundColor: 'rgba(255,255,255,0.15)' }} />
        </View>
      </View>
    </LinearGradient>
  );
}

// ─── Itinerary card ───────────────────────────────────────────────────────────
function ItinCard({ itin, selected, onPress, layoverHours }: {
  itin: Itinerary;
  selected: boolean;
  onPress: () => void;
  /** Null hides the fit chip — never guess a layover. */
  layoverHours: number | null;
}) {
  const photo = getItineraryPhoto(itin);
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[{ width: CARD_WIDTH, marginRight: 12 }, animStyle]}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPressIn={() => { scale.value = withSpring(0.97, { damping: 15, stiffness: 150 }); hapticImpactMedium(); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 150 }); }}
        onPress={onPress}
        style={{
          borderRadius: theme.borderRadius.lg,
          borderWidth: 2,
          borderColor: selected ? theme.colors.primary : theme.colors.divider,
          backgroundColor: theme.colors.surface,
          overflow: 'hidden',
          ...theme.shadows.md,
        }}
      >
        <View style={{ width: CARD_WIDTH, height: CARD_IMAGE_HEIGHT }}>
          {photo ? (
            <Image source={{ uri: photo }} contentFit="cover" style={{ width: '100%', height: '100%' }} transition={200} />
          ) : (
            <LinearGradient colors={theme.gradients.dark} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: theme.fonts.serif, fontSize: 30, color: '#FCF7EA' }}>Mumbai</Text>
            </LinearGradient>
          )}
          <LinearGradient
            colors={['transparent', 'rgba(14,25,41,0.55)']}
            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 60 }}
          />
          <View style={{
            position: 'absolute', top: 10, right: 10,
            backgroundColor: 'rgba(14,25,41,0.62)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
          }}>
            <Text style={{ fontFamily: theme.fonts.monoMed, color: '#FCF7EA', fontSize: 11, letterSpacing: 0.4 }}>{itin.estimated_duration_hours}H</Text>
          </View>
          <TimeFitChip
            layoverHours={layoverHours}
            tourHours={itin.estimated_duration_hours}
            variant="overlay"
            style={{ position: 'absolute', bottom: 10, left: 10 }}
          />
          {selected && (
            <View style={{
              position: 'absolute', top: 10, left: 10,
              width: 28, height: 28, borderRadius: 14,
              backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>✓</Text>
            </View>
          )}
        </View>
        <View style={{ padding: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Text style={{ fontFamily: theme.fonts.displaySemi, fontSize: 15, color: theme.colors.text, flex: 1, marginRight: 8 }} numberOfLines={2}>
              {itin.name ?? itin.title}
            </Text>
            <Text style={{ fontFamily: theme.fonts.monoMed, fontSize: 16, color: theme.colors.primary }}>
              {formatFromPrice(itin.base_cost_inr, itin.buddy_cost_inr)}
            </Text>
          </View>
          {itin.description ? (
            <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 4, lineHeight: 17 }} numberOfLines={2}>
              {itin.description}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Price row ────────────────────────────────────────────────────────────────
function PriceRow({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
      <Text style={{ fontFamily: theme.fonts.body, fontSize: 14, color: muted ? theme.colors.textMuted : theme.colors.textSecondary }}>{label}</Text>
      <Text style={{ fontFamily: bold ? theme.fonts.monoMed : theme.fonts.mono, fontSize: bold ? 18 : 14, color: bold ? theme.colors.primary : theme.colors.text }}>
        {value}
      </Text>
    </View>
  );
}

// ─── Labeled text input ───────────────────────────────────────────────────────

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function BookingScreen() {
  const { guideId, itineraryId: preselectedItinId, intent } = useLocalSearchParams<{
    guideId: string;
    itineraryId?: string;
    intent?: string;
  }>();
  // `intent=chat` → casual inquiry: no tour pre-selected, nothing required.
  const isCasual = intent === 'chat';
  // Arrived from a specific tour's "Inquire" button → focus on that tour rather
  // than showing the whole switchable carousel (which reads as "you haven't
  // chosen yet"). The traveler can still reveal the full list on demand.
  const cameFromTour = !!preselectedItinId;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const [guide, setGuide] = useState<GuideProfile | null>(null);
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inquiryNote, setInquiryNote] = useState('');

  const [selectedItinId, setSelectedItinId] = useState<string>(preselectedItinId ?? '');
  // When arriving from a specific tour, hide the other tours until the traveler
  // explicitly asks to browse them.
  const [showAllTours, setShowAllTours] = useState(false);
  const [layoverModalOpen, setLayoverModalOpen] = useState(false);
  const trip = useTravelerTrip();
  // Set on successful inquiry — shows the boarding-pass reveal, whose onDone
  // navigates into the new chat thread.
  const [revealBookingId, setRevealBookingId] = useState<string | null>(null);
  const [rates, setRates] = useState<EffectiveRates>(EARLY_ACCESS_RATES);


  useEffect(() => {
    getEffectiveRates().then(setRates).catch(() => {});
  }, []);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((e) => { scrollY.value = e.contentOffset.y; });
  const confirmScale = useSharedValue(1);
  const confirmStyle = useAnimatedStyle(() => ({ transform: [{ scale: confirmScale.value }] }));
  const heroOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 80], [1, 0.85], Extrapolate.CLAMP),
  }));

  useEffect(() => {
    if (!guideId) return;
    Promise.all([
      fetchGuideById(guideId),
      fetchGuideItineraries(guideId),
      fetchMyTravelerProfile().catch(() => null),
    ])
      .then(([g, it, profile]) => {
        setGuide(g);
        setItineraries(it);
        // Casual inquiries don't auto-pick a tour; package inquiries default to
        // the first (or the pre-selected) tour.
        if (!isCasual && !selectedItinId && it.length > 0) setSelectedItinId(it[0].id);

      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load guide details.');
      })
      .finally(() => setLoading(false));
  }, [guideId]);

  const selectedItin = itineraries.find((i) => i.id === selectedItinId);
  // Mirrors createBooking (lib/api/bookings.ts) line for line. If these drift,
  // the traveler is quoted one number here and charged another.
  const groupSize = clampPartySize(trip.groupSize);
  const perPersonBuddyCost = selectedItin?.buddy_cost_inr ?? 0;
  const buddyCost = tourBuddyFeeInr(
    selectedItin?.base_cost_inr ?? 0,
    perPersonBuddyCost,
    groupSize,
  );
  const estimatedExpenses =
    Math.round(perPersonBuddyCost * (ESTIMATED_EXPENSES_PERCENT / 100)) * groupSize;
  const commission = calcCommission(buddyCost, rates.commissionRate);
  const total = buddyCost + estimatedExpenses + commission;

  async function handleSend() {
    if (submitting) return;
    setError(null);

    // Onboarding already validated the trip window (>= 7 hours) and the party
    // (1-4). The only thing that can be wrong here is having no layover at all.
    if (!trip.hasActiveLayover) {
      hapticError();
      setError('Add your Mumbai layover before sending an inquiry.');
      return;
    }

    hapticImpactMedium();
    confirmScale.value = withSpring(0.96, { damping: 15, stiffness: 150 });
    setSubmitting(true);

    try {
      // A tour is optional in every mode: if the traveler selected one (even
      // from a casual inquiry) we attach it so the booking is priced; if none
      // is selected it's a casual inquiry with no package (itinerary_id null,
      // price settled later in chat).
      const itineraryId = selectedItinId || undefined;

      const booking = await createBooking({
        guide_id: guideId,
        itinerary_id: itineraryId,
      });

      // Seed the conversation with the traveler's note (best-effort).
      const firstNote = inquiryNote.trim()
        || (selectedItin
          ? `Hi ${guide?.name?.split(' ')[0] ?? 'there'}! I'm interested in "${selectedItin.name ?? selectedItin.title}". Is this something we could do?`
          : `Hi ${guide?.name?.split(' ')[0] ?? 'there'}! I'd love to ask you a few things about visiting Mumbai.`);
      await sendMessage({ booking_id: booking.id, content: firstNote }).catch(() => {});

      hapticSuccess();
      confirmScale.value = withSpring(1, { damping: 15, stiffness: 150 });
      // Inquiry-first: celebrate the moment with the boarding-pass reveal,
      // then drop the traveler straight into the chat thread so they can
      // build the plan with the guide. Booking + payment happen later.
      setRevealBookingId(booking.id);
    } catch (err: unknown) {
      hapticError();
      confirmScale.value = withSpring(1, { damping: 15, stiffness: 150 });
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const heroPhoto = guide ? getGuideHeroPhoto(guide) : null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Editing here writes back to the layover — the single source — rather
          than to a per-booking copy, so the fix is visible everywhere. */}
      <LayoverEditorModal
        visible={layoverModalOpen}
        replacingActiveLayover={trip.hasActiveLayover}
        mode={trip.hasActiveLayover ? 'edit' : 'create'}
        initial={trip.profile}
        onClose={() => setLayoverModalOpen(false)}
        onCreate={async (payload) => {
          await createMyNextLayover(payload);
          await trip.refresh();
        }}
      />
      <BoardingPassReveal
        visible={revealBookingId !== null}
        itineraryName={selectedItin?.name ?? selectedItin?.title ?? 'Mumbai plans'}
        guideName={guide?.name ?? 'your guide'}
        guideAvatar={guide ? getGuideAvatar(guide) : null}
        dateLabel={
          trip.profile?.arrival_at ? formatMumbaiShortDate(trip.profile.arrival_at) : 'TBD'
        }
        flightNumber={trip.profile?.flight_in ?? undefined}
        totalLabel={selectedItin && total > 0 ? `${CURRENCY_SYMBOL}${total.toLocaleString('en-IN')}` : 'In chat'}
        stampLabel="Request sent"
        eyebrowLabel="Inquiry"
        footerLabel="Opening your chat…"
        onDone={() => {
          if (revealBookingId) router.replace(`/(shared)/messages/${revealBookingId}` as never);
        }}
      />
      {/* Back button */}
      <View style={{
        position: 'absolute', top: insets.top + 8, left: 16, zIndex: 50,
        backgroundColor: 'rgba(14,25,41,0.65)', borderRadius: 20,
      }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 22 }}>‹</Text>
        </TouchableOpacity>
      </View>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Hero section ─────────────────────────────────────────────── */}
        <Animated.View style={heroOpacity}>
          {loading ? (
            <HeroSkeleton />
          ) : (
            <LinearGradient
              colors={theme.gradients.hero}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ paddingTop: insets.top + 52, paddingHorizontal: 20, paddingBottom: 28 }}
            >
              {heroPhoto && (
                <Image
                  source={{ uri: heroPhoto }}
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.15 }}
                  contentFit="cover"
                />
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <View style={{
                  width: 68, height: 68, borderRadius: 34,
                  borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
                  overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.1)',
                }}>
                  {guide?.avatar_url ? (
                    <Image source={{ uri: guide.avatar_url }} contentFit="cover" style={{ width: '100%', height: '100%' }} />
                  ) : (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontFamily: theme.fonts.display, fontSize: 24, color: '#FCF7EA' }}>
                        {(guide?.name ?? 'G').split(' ').map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: theme.fonts.display, color: '#FCF7EA', fontSize: 22, letterSpacing: -0.3 }}>
                    {guide?.name ?? '…'}
                  </Text>
                  {guide?.university ? (
                    <Text style={{ fontFamily: theme.fonts.mono, color: 'rgba(252,247,234,0.6)', fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 3 }} numberOfLines={1}>
                      {guide.university}
                    </Text>
                  ) : null}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                    <StarRating rating={guide?.avg_rating ?? 0} size={14} />
                    <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600' }}>
                      {guide?.avg_rating && guide.avg_rating > 0 ? guide.avg_rating.toFixed(1) : 'New'}
                      {guide?.total_reviews ? ` · ${guide.total_reviews} review${guide.total_reviews !== 1 ? 's' : ''}` : ''}
                    </Text>
                  </View>
                </View>
              </View>
            </LinearGradient>
          )}
        </Animated.View>

        <View style={{ paddingHorizontal: 20, paddingTop: 24 }}>
          {/* ── Tour selection ─────────────────────────────────────────── */}
          <Text style={{ fontFamily: theme.fonts.display, fontSize: 19, color: theme.colors.text, letterSpacing: -0.3, marginBottom: 4 }}>
            {cameFromTour && !showAllTours
              ? 'Your tour'
              : isCasual ? 'Ask about a tour' : 'Which tour?'}
          </Text>
          <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textSecondary, marginBottom: 16 }}>
            {cameFromTour && !showAllTours
              ? 'You can fine-tune the plan and price with your guide in chat.'
              : isCasual
                ? 'Optional — pick one to ask about, or just send a question below.'
                : 'Tap a card to select. You can change it together with your guide.'}
          </Text>
        </View>

        {loading ? (
          <View style={{ paddingLeft: 20 }}>
            <View style={{ width: CARD_WIDTH, height: CARD_IMAGE_HEIGHT + 90, backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.lg, ...theme.shadows.sm }} />
          </View>
        ) : cameFromTour && !showAllTours && selectedItin ? (
          // Focused view: just the tour they inquired about, plus a quiet way to
          // browse the guide's other tours if they change their mind.
          <View style={{ paddingLeft: 20 }}>
            <ItinCard itin={selectedItin} selected layoverHours={trip.layoverHours} onPress={() => setShowAllTours(true)} />
            {itineraries.length > 1 && (
              <TouchableOpacity onPress={() => setShowAllTours(true)} style={{ paddingVertical: 12 }}>
                <Text style={{ fontFamily: theme.fonts.body, fontSize: 14, color: theme.colors.accent }}>
                  Ask about a different tour ›
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <FlatList
            horizontal
            data={itineraries}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ItinCard
                itin={item}
                layoverHours={trip.layoverHours}
                selected={item.id === selectedItinId}
                onPress={() => setSelectedItinId((prev) => (prev === item.id ? '' : item.id))}
              />
            )}
            contentContainerStyle={{ paddingLeft: 20, paddingRight: 8, paddingBottom: 4 }}
            showsHorizontalScrollIndicator={false}
            ListEmptyComponent={
              <View style={{ paddingLeft: 0, width: screenWidth - 40 }}>
                <Card><Text style={{ color: theme.colors.textMuted }}>No tours available.</Text></Card>
              </View>
            }
          />
        )}

        <View style={{ paddingHorizontal: 20, paddingTop: 28 }}>

          {/* ── Your trip ─────────────────────────────────────────────────
              Shown, not asked for. These six values were collected at
              onboarding, then re-collected here into a different table that
              never synced back — so a correction made while booking was lost,
              and the next inquiry pre-filled the stale values again. The
              "Preferred Dates" that used to sit here invented a fifth date
              concept with no source table at all: the tour necessarily
              happens inside the layover window. */}
          <TripSummaryCard
            arrivalAt={trip.profile?.arrival_at ?? null}
            departureAt={trip.profile?.departure_at ?? null}
            flightIn={trip.profile?.flight_in}
            flightOut={trip.profile?.flight_out}
            groupSize={trip.groupSize}
            partyType={trip.partyType}
            onEdit={() => {
              hapticImpactMedium();
              setLayoverModalOpen(true);
            }}
          />

          {selectedItin ? (
            <DayOverview
              arrivalIso={trip.profile?.arrival_at ?? null}
              departureIso={trip.profile?.departure_at ?? null}
              tourDurationHours={selectedItin.estimated_duration_hours}
            />
          ) : null}


          {/* ── Price breakdown ────────────────────────────────────────── */}
          {selectedItin ? (
            <Card style={{ marginTop: 4, marginBottom: 4 }}>
              <Text style={{ ...theme.typography.eyebrow, color: theme.colors.textMuted, marginBottom: 4 }}>
                Rough estimate
              </Text>
              <Text style={{ fontSize: 17, fontWeight: '700', color: theme.colors.text, marginBottom: 14 }}>
                What this might cost
              </Text>
              <PriceRow label="Buddy fee" value={`${CURRENCY_SYMBOL}${buddyCost.toLocaleString('en-IN')}`} />
              <PriceRow
                label={`Estimated expenses (~${ESTIMATED_EXPENSES_PERCENT}%)`}
                value={`${CURRENCY_SYMBOL}${estimatedExpenses.toLocaleString('en-IN')}`}
                muted
              />
              {rates.commissionRate > 0 && (
                <PriceRow
                  label={`Platform commission (${(rates.commissionRate * 100).toFixed(0)}%)`}
                  value={`${CURRENCY_SYMBOL}${commission.toLocaleString('en-IN')}`}
                  muted
                />
              )}
              <View style={{ height: 1, backgroundColor: theme.colors.divider, marginVertical: 10 }} />
              <PriceRow label="Estimated total" value={`${CURRENCY_SYMBOL}${total.toLocaleString('en-IN')}`} bold />
              {rates.commissionRate === 0 && (
                <Text style={{ fontSize: 12, color: theme.colors.success, fontWeight: '600', marginTop: 6 }}>
                  Early access — no platform fees. You pay only your buddy and the day's expenses.
                </Text>
              )}
              <Text style={{ fontSize: 11, color: theme.colors.textMuted, marginTop: 2, lineHeight: 16 }}>
                Just an estimate. You and your guide finalize the plan and price in chat — you only pay once it's agreed.
              </Text>
            </Card>
          ) : null}

          {/* ── Inquiry note ───────────────────────────────────────────── */}
          <Text style={{ fontFamily: theme.fonts.display, fontSize: 19, color: theme.colors.text, letterSpacing: -0.3, marginTop: 24, marginBottom: 4 }}>
            Your message
          </Text>
          <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textSecondary, marginBottom: 12 }}>
            Say hi and tell {guide?.name?.split(' ')[0] ?? 'your guide'} what you're after — this starts the conversation.
          </Text>
          <TextInput
            value={inquiryNote}
            onChangeText={setInquiryNote}
            placeholder={
              selectedItin
                ? `e.g. Is "${selectedItin.name ?? selectedItin.title}" doable on my layover?`
                : 'e.g. I have an 8h layover and love street food — what would you suggest?'
            }
            placeholderTextColor={theme.colors.textMuted}
            multiline
            style={{
              backgroundColor: theme.colors.surface,
              borderRadius: theme.borderRadius.md,
              borderWidth: 1, borderColor: theme.colors.divider,
              paddingHorizontal: 14, paddingVertical: 12, minHeight: 90,
              fontSize: 15, color: theme.colors.text, textAlignVertical: 'top',
              ...(Platform.OS === 'web' ? { outline: 'none' } as any : {}),
            }}
          />

          {/* ── Inline error ───────────────────────────────────────────── */}
          {error ? (
            <View style={{
              marginTop: 12, backgroundColor: theme.colors.accentLight,
              borderRadius: theme.borderRadius.md, borderLeftWidth: 3, borderLeftColor: theme.colors.error,
              padding: 12,
            }}>
              <Text style={{ fontSize: 13, color: theme.colors.error, fontWeight: '500' }}>{error}</Text>
            </View>
          ) : null}
        </View>
      </Animated.ScrollView>

      {/* ── Fixed confirm button ────────────────────────────────────────── */}
      <View style={{ position: 'absolute', bottom: insets.bottom + 16, left: 20, right: 20 }}>
        <Animated.View style={confirmStyle}>
          <TouchableOpacity
            onPress={handleSend}
            onPressIn={() => { confirmScale.value = withSpring(0.96, { damping: 15, stiffness: 150 }); }}
            onPressOut={() => { confirmScale.value = withSpring(1, { damping: 15, stiffness: 150 }); }}
            disabled={submitting || loading || !trip.hasActiveLayover}
            activeOpacity={0.9}
            style={{
              height: 56, borderRadius: theme.borderRadius.md,
              backgroundColor: submitting || loading ? '#E3D9C2' : theme.colors.primary,
              borderWidth: 1.5, borderColor: submitting || loading ? '#D3C6A8' : theme.colors.primaryDark,
              alignItems: 'center', justifyContent: 'center',
              ...theme.shadows.md,
            }}
          >
            <Text style={{ fontFamily: theme.fonts.bodyBold, color: submitting || loading ? '#9A9384' : '#FCF7EA', fontSize: 16, letterSpacing: 0.2 }}>
              {submitting
                ? 'Sending inquiry…'
                : !trip.hasActiveLayover
                  ? 'Add your layover first'
                  : 'Send inquiry'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>

    </KeyboardAvoidingView>
  );
}
