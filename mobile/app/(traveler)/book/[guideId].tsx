import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ScrollView,
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
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isSameDay,
  isBefore,
  parseISO,
  isValid,
  differenceInMinutes,
} from 'date-fns';
import { StarRating } from '@/components/ui/StarRating';
import { Card } from '@/components/ui/Card';
import { SkeletonLine } from '@/components/ui/Loading';
import { getItineraryPhoto, getGuideHeroPhoto } from '@/config/photoLibrary';
import { fetchGuideById, fetchGuideItineraries } from '@/lib/api/guides';
import { createBooking, calcCommission } from '@/lib/api/bookings';
import { hapticImpactMedium, hapticSuccess, hapticError } from '@/lib/haptics';
import { theme } from '@/config/theme';
import { COMMISSION_RATE, ESTIMATED_EXPENSES_PERCENT, CURRENCY_SYMBOL } from '@/config/constants';
import type { GuideProfile, Itinerary } from '@/types';

const CARD_WIDTH = 288;
const CARD_IMAGE_HEIGHT = Math.round(CARD_WIDTH * (9 / 16));
const DAYS_OF_WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// ─── Calendar picker ─────────────────────────────────────────────────────────
function CalendarPicker({
  label,
  value,
  onChange,
  minDate,
  helper,
  required,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  minDate?: string;
  helper?: string;
  required?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const selected = value ? parseISO(value) : null;
  const minD = minDate ? parseISO(minDate) : null;

  const [viewMonth, setViewMonth] = useState(() => {
    if (selected && isValid(selected)) return selected;
    if (minD && isValid(minD)) return minD;
    return new Date();
  });

  const firstDay = startOfMonth(viewMonth);
  const days = eachDayOfInterval({ start: firstDay, end: endOfMonth(viewMonth) });
  const startPadding = getDay(firstDay);

  // Build week rows for the grid
  const weeks = useMemo(() => {
    const rows: (Date | null)[][] = [];
    let row: (Date | null)[] = Array(startPadding).fill(null);
    for (const day of days) {
      row.push(day);
      if (row.length === 7) { rows.push(row); row = []; }
    }
    if (row.length > 0) {
      while (row.length < 7) row.push(null);
      rows.push(row);
    }
    return rows;
  }, [viewMonth]);

  function isDisabled(day: Date) {
    if (minD && isValid(minD) && isBefore(day, minD)) return true;
    return false;
  }

  const displayValue = selected && isValid(selected) ? format(selected, 'd MMM yyyy') : '';

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>
        {label}{required ? ' *' : ''}
      </Text>
      <TouchableOpacity
        onPress={() => setVisible(true)}
        style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.md,
          borderWidth: 1,
          borderColor: theme.colors.divider,
          paddingHorizontal: 14, paddingVertical: 13,
        }}
      >
        <Text style={{ fontSize: 15, color: displayValue ? theme.colors.text : theme.colors.textMuted }}>
          {displayValue || 'Select date'}
        </Text>
        <Text style={{ fontSize: 16 }}>📅</Text>
      </TouchableOpacity>
      {helper ? <Text style={{ fontSize: 11, color: theme.colors.textMuted, marginTop: 4 }}>{helper}</Text> : null}

      <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}
          activeOpacity={1}
          onPress={() => setVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={{
            backgroundColor: theme.colors.background,
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            padding: 20, paddingBottom: 36,
          }}>
            {/* Month navigation */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <TouchableOpacity onPress={() => setViewMonth((m) => subMonths(m, 1))} style={{ padding: 8 }}>
                <Text style={{ fontSize: 24, color: theme.colors.text }}>‹</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 17, fontWeight: '700', color: theme.colors.text }}>
                {format(viewMonth, 'MMMM yyyy')}
              </Text>
              <TouchableOpacity onPress={() => setViewMonth((m) => addMonths(m, 1))} style={{ padding: 8 }}>
                <Text style={{ fontSize: 24, color: theme.colors.text }}>›</Text>
              </TouchableOpacity>
            </View>

            {/* Day headers */}
            <View style={{ flexDirection: 'row', marginBottom: 8 }}>
              {DAYS_OF_WEEK.map((d, i) => (
                <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary }}>{d}</Text>
                </View>
              ))}
            </View>

            {/* Calendar grid */}
            {weeks.map((week, wi) => (
              <View key={wi} style={{ flexDirection: 'row', marginBottom: 4 }}>
                {week.map((day, di) => {
                  if (!day) return <View key={di} style={{ flex: 1 }} />;
                  const sel = selected && isValid(selected) && isSameDay(day, selected);
                  const disabled = isDisabled(day);
                  return (
                    <TouchableOpacity
                      key={di}
                      onPress={() => {
                        if (!disabled) {
                          onChange(format(day, 'yyyy-MM-dd'));
                          setVisible(false);
                        }
                      }}
                      style={{ flex: 1, alignItems: 'center', paddingVertical: 4, opacity: disabled ? 0.28 : 1 }}
                    >
                      <View style={{
                        width: 36, height: 36, borderRadius: 18,
                        backgroundColor: sel ? theme.colors.primary : 'transparent',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Text style={{
                          fontSize: 14, fontWeight: sel ? '700' : '400',
                          color: sel ? '#FFFFFF' : theme.colors.text,
                        }}>{format(day, 'd')}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}

            <TouchableOpacity onPress={() => setVisible(false)} style={{ marginTop: 12, alignItems: 'center', paddingVertical: 10 }}>
              <Text style={{ color: theme.colors.textSecondary, fontSize: 15 }}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ─── Time input (HH:MM) ───────────────────────────────────────────────────────
function TimeInput({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={(v) => {
          // Auto-insert colon after 2 digits
          let clean = v.replace(/[^0-9:]/g, '');
          if (clean.length === 2 && !clean.includes(':') && value.length < 2) clean += ':';
          if (clean.length <= 5) onChange(clean);
        }}
        placeholder={placeholder ?? 'HH:MM'}
        placeholderTextColor={theme.colors.textMuted}
        keyboardType="numbers-and-punctuation"
        maxLength={5}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.md,
          borderWidth: 1,
          borderColor: focused ? theme.colors.primary : theme.colors.divider,
          paddingHorizontal: 14, paddingVertical: 13,
          fontSize: 15, color: theme.colors.text,
          textAlign: 'center',
          ...(Platform.OS === 'web' ? { outline: 'none' } as any : {}),
        }}
      />
    </View>
  );
}

// ─── Day overview ─────────────────────────────────────────────────────────────
function DayOverview({
  arrivalDate, arrivalTime, departureDate, departureTime, tourDurationHours,
}: {
  arrivalDate: string; arrivalTime: string;
  departureDate: string; departureTime: string;
  tourDurationHours: number;
}) {
  const TRANSIT_BUFFER = 90;  // minutes each way (airport transit)
  const TOUR_BUFFER = 30;     // minutes buffer between transit and tour

  const arrival = useMemo(() => {
    if (!arrivalDate || !arrivalTime || !/^\d{2}:\d{2}$/.test(arrivalTime)) return null;
    const d = parseISO(`${arrivalDate}T${arrivalTime}:00`);
    return isValid(d) ? d : null;
  }, [arrivalDate, arrivalTime]);

  const departure = useMemo(() => {
    if (!departureDate || !departureTime || !/^\d{2}:\d{2}$/.test(departureTime)) return null;
    const d = parseISO(`${departureDate}T${departureTime}:00`);
    return isValid(d) ? d : null;
  }, [departureDate, departureTime]);

  if (!arrival || !departure) return null;

  const totalMinutes = differenceInMinutes(departure, arrival);
  if (totalMinutes <= 0) return null;

  const availableForTour = totalMinutes - TRANSIT_BUFFER * 2 - TOUR_BUFFER * 2;
  const tourMinutes = tourDurationHours * 60;
  const hasEnoughTime = availableForTour >= tourMinutes;
  const isTight = !hasEnoughTime && availableForTour >= tourMinutes * 0.8;

  const tourStartTime = new Date(arrival.getTime() + (TRANSIT_BUFFER + TOUR_BUFFER) * 60000);
  const tourEndTime = new Date(tourStartTime.getTime() + tourMinutes * 60000);

  const totalHours = Math.floor(totalMinutes / 60);
  const totalMins = totalMinutes % 60;

  return (
    <Card style={{ marginBottom: 16, backgroundColor: hasEnoughTime ? theme.colors.primaryLight : isTight ? '#FFF8E1' : '#FDECEA' }}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.text, marginBottom: 10 }}>
        📋 Day Overview
      </Text>

      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>✈️ Arrive Mumbai</Text>
          <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.text }}>{format(arrival, 'HH:mm')}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>🚕 Transit to city</Text>
          <Text style={{ fontSize: 12, color: theme.colors.textMuted }}>~{TRANSIT_BUFFER} min</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 12, color: theme.colors.primary, fontWeight: '600' }}>🗺️ Tour start</Text>
          <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.primary }}>{format(tourStartTime, 'HH:mm')}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 12, color: theme.colors.primary, fontWeight: '600' }}>🏁 Tour end</Text>
          <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.primary }}>{format(tourEndTime, 'HH:mm')}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>🚕 Back to airport</Text>
          <Text style={{ fontSize: 12, color: theme.colors.textMuted }}>~{TRANSIT_BUFFER} min</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>✈️ Depart Mumbai</Text>
          <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.text }}>{format(departure, 'HH:mm')}</Text>
        </View>
      </View>

      <View style={{ height: 1, backgroundColor: theme.colors.divider, marginVertical: 10 }} />

      <Text style={{ fontSize: 12, fontWeight: '700', color: hasEnoughTime ? theme.colors.success : isTight ? '#F59E0B' : theme.colors.error }}>
        {hasEnoughTime ? '✅' : isTight ? '⚠️' : '❌'}{' '}
        {totalHours}h {totalMins > 0 ? `${totalMins}m ` : ''}layover ·{' '}
        {hasEnoughTime
          ? `Plenty of time for this ${tourDurationHours}h tour`
          : isTight
          ? `Tight schedule — this ${tourDurationHours}h tour may run close`
          : `Not enough time for a ${tourDurationHours}h tour`}
      </Text>
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
function ItinCard({ itin, selected, onPress }: { itin: Itinerary; selected: boolean; onPress: () => void }) {
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
              <Text style={{ fontSize: 40 }}>🗺️</Text>
            </LinearGradient>
          )}
          <LinearGradient
            colors={['transparent', 'rgba(15,23,42,0.55)']}
            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 60 }}
          />
          <View style={{
            position: 'absolute', top: 10, right: 10,
            backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
          }}>
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>⏱ {itin.estimated_duration_hours}h</Text>
          </View>
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
            <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.text, flex: 1, marginRight: 8 }} numberOfLines={2}>
              {itin.name ?? itin.title}
            </Text>
            <Text style={{ fontSize: 18, fontWeight: '800', color: theme.colors.primary }}>
              {CURRENCY_SYMBOL}{itin.buddy_cost_inr.toLocaleString('en-IN')}
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
      <Text style={{ fontSize: 14, color: muted ? theme.colors.textMuted : theme.colors.textSecondary }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: bold ? '800' : '500', color: bold ? theme.colors.primary : theme.colors.text }}>
        {value}
      </Text>
    </View>
  );
}

// ─── Labeled text input ───────────────────────────────────────────────────────
function LabeledInput({
  label, value, onChangeText, placeholder, keyboardType, autoCapitalize, helper,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder: string; keyboardType?: 'default' | 'numeric' | 'email-address';
  autoCapitalize?: 'none' | 'characters' | 'sentences' | 'words';
  helper?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.md,
          borderWidth: 1,
          borderColor: focused ? theme.colors.primary : theme.colors.divider,
          paddingHorizontal: 14, paddingVertical: 12,
          fontSize: 15, color: theme.colors.text,
          ...(Platform.OS === 'web' ? { outline: 'none' } as any : {}),
        }}
      />
      {helper ? <Text style={{ fontSize: 11, color: theme.colors.textMuted, marginTop: 4 }}>{helper}</Text> : null}
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function BookingScreen() {
  const { guideId, itineraryId: preselectedItinId } = useLocalSearchParams<{
    guideId: string;
    itineraryId?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const [guide, setGuide] = useState<GuideProfile | null>(null);
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedItinId, setSelectedItinId] = useState<string>(preselectedItinId ?? '');
  const [tourStartDate, setTourStartDate] = useState('');
  const [tourEndDate, setTourEndDate] = useState('');
  const [arrivalDate, setArrivalDate] = useState('');
  const [arrivalTime, setArrivalTime] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [departureTime, setDepartureTime] = useState('');
  const [flightNumber, setFlightNumber] = useState('');
  const [numTravelers, setNumTravelers] = useState('1');

  const today = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((e) => { scrollY.value = e.contentOffset.y; });
  const confirmScale = useSharedValue(1);
  const confirmStyle = useAnimatedStyle(() => ({ transform: [{ scale: confirmScale.value }] }));
  const heroOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 80], [1, 0.85], Extrapolate.CLAMP),
  }));

  useEffect(() => {
    if (!guideId) return;
    Promise.all([fetchGuideById(guideId), fetchGuideItineraries(guideId)])
      .then(([g, it]) => {
        setGuide(g);
        setItineraries(it);
        if (!selectedItinId && it.length > 0) setSelectedItinId(it[0].id);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load guide details.');
      })
      .finally(() => setLoading(false));
  }, [guideId]);

  const selectedItin = itineraries.find((i) => i.id === selectedItinId);
  const buddyCost = selectedItin?.buddy_cost_inr ?? 0;
  const estimatedExpenses = Math.round(buddyCost * (ESTIMATED_EXPENSES_PERCENT / 100));
  const commission = calcCommission(buddyCost);
  const total = buddyCost + estimatedExpenses + commission;

  async function handleConfirm() {
    if (submitting) return;
    setError(null);

    if (!selectedItinId || !selectedItin) {
      hapticError(); setError('Please select a tour to continue.'); return;
    }
    if (!tourStartDate) {
      hapticError(); setError('Tour start date is required.'); return;
    }
    const startParsed = parseISO(tourStartDate);
    if (!isValid(startParsed) || isBefore(startParsed, parseISO(today))) {
      hapticError(); setError('Tour start date cannot be in the past.'); return;
    }
    if (tourEndDate) {
      const endParsed = parseISO(tourEndDate);
      if (!isValid(endParsed) || isBefore(endParsed, startParsed)) {
        hapticError(); setError('Tour end date must be on or after the start date.'); return;
      }
    }
    const travelers = parseInt(numTravelers, 10);
    if (Number.isNaN(travelers) || travelers < 1 || travelers > 10) {
      hapticError(); setError('Number of travelers must be between 1 and 10.'); return;
    }

    hapticImpactMedium();
    confirmScale.value = withSpring(0.96, { damping: 15, stiffness: 150 });
    setSubmitting(true);

    try {
      const booking = await createBooking({
        guide_id: guideId,
        itinerary_id: selectedItinId,
        flight_number: flightNumber.trim() || undefined,
        flight_date: arrivalDate || undefined,
        start_date: tourStartDate,
        end_date: tourEndDate || tourStartDate,
      });

      hapticSuccess();
      confirmScale.value = withSpring(1, { damping: 15, stiffness: 150 });
      // Phase 2+ lifecycle: a fresh booking starts in `chat_open` and progresses
      // through agreement → signing → deposits → balance via dedicated screens.
      // Landing on the trip detail (instead of the legacy single-shot payment
      // screen) lets the agreement flow drive payments. The legacy
      // `book/payment/[bookingId]` route is preserved for now but no new
      // bookings should hit it. (Review 2026-05-14 #9.)
      router.replace(`/(traveler)/trips/${booking.id}` as never);
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
      {/* Back button */}
      <View style={{
        position: 'absolute', top: insets.top + 8, left: 16, zIndex: 50,
        backgroundColor: 'rgba(26,26,46,0.65)', borderRadius: 20,
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
                      <Text style={{ fontSize: 28 }}>👤</Text>
                    </View>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800', letterSpacing: -0.3 }}>
                    {guide?.name ?? '…'}
                  </Text>
                  {guide?.university ? (
                    <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 2 }} numberOfLines={1}>
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
          <Text style={{ fontSize: 18, fontWeight: '700', color: theme.colors.text, marginBottom: 4 }}>
            Choose Your Tour
          </Text>
          <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginBottom: 16 }}>
            Tap a card to select
          </Text>
        </View>

        {loading ? (
          <View style={{ paddingLeft: 20 }}>
            <View style={{ width: CARD_WIDTH, height: CARD_IMAGE_HEIGHT + 90, backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.lg, ...theme.shadows.sm }} />
          </View>
        ) : (
          <FlatList
            horizontal
            data={itineraries}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ItinCard
                itin={item}
                selected={item.id === selectedItinId}
                onPress={() => setSelectedItinId(item.id)}
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

          {/* ── Tour dates ────────────────────────────────────────────── */}
          <Text style={{ fontSize: 18, fontWeight: '700', color: theme.colors.text, marginBottom: 16 }}>
            Tour Dates
          </Text>

          <CalendarPicker
            label="Tour Start Date"
            value={tourStartDate}
            onChange={setTourStartDate}
            minDate={today}
            helper="First day of your Mumbai tour"
            required
          />
          <CalendarPicker
            label="Tour End Date (optional)"
            value={tourEndDate}
            onChange={setTourEndDate}
            minDate={tourStartDate || today}
            helper="Leave blank for a single-day tour"
          />

          {/* Travelers counter */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>
              Number of Travelers
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 0 }}>
              <TouchableOpacity
                onPress={() => { hapticImpactMedium(); setNumTravelers((v) => String(Math.max(1, parseInt(v, 10) - 1))); }}
                style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.divider, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontSize: 20, fontWeight: '600', color: theme.colors.text }}>−</Text>
              </TouchableOpacity>
              <View style={{ width: 56, alignItems: 'center' }}>
                <Text style={{ fontSize: 22, fontWeight: '800', color: theme.colors.text }}>{numTravelers}</Text>
              </View>
              <TouchableOpacity
                onPress={() => { hapticImpactMedium(); setNumTravelers((v) => String(Math.min(10, parseInt(v, 10) + 1))); }}
                style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.divider, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontSize: 20, fontWeight: '600', color: theme.colors.text }}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Flight info ────────────────────────────────────────────── */}
          <Text style={{ fontSize: 18, fontWeight: '700', color: theme.colors.text, marginBottom: 4 }}>
            Your Flight Details
          </Text>
          <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginBottom: 16 }}>
            Helps your guide plan around your schedule
          </Text>

          <LabeledInput
            label="Flight Number (optional)"
            value={flightNumber}
            onChangeText={setFlightNumber}
            placeholder="e.g. EK504"
            autoCapitalize="characters"
          />

          <CalendarPicker
            label="Arrival Date (optional)"
            value={arrivalDate}
            onChange={setArrivalDate}
            helper="Day your flight lands in Mumbai"
          />

          {arrivalDate ? (
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 8, marginTop: -4 }}>
              <TimeInput label="Arrival Time" value={arrivalTime} onChange={setArrivalTime} placeholder="e.g. 08:30" />
              <View style={{ flex: 1 }} />
            </View>
          ) : null}

          <CalendarPicker
            label="Departure Date (optional)"
            value={departureDate}
            onChange={setDepartureDate}
            helper="Day you fly out of Mumbai"
          />

          {departureDate ? (
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 8, marginTop: -4 }}>
              <TimeInput label="Departure Time" value={departureTime} onChange={setDepartureTime} placeholder="e.g. 22:00" />
              <View style={{ flex: 1 }} />
            </View>
          ) : null}

          {/* ── Day overview ───────────────────────────────────────────── */}
          {selectedItin ? (
            <DayOverview
              arrivalDate={arrivalDate}
              arrivalTime={arrivalTime}
              departureDate={departureDate}
              departureTime={departureTime}
              tourDurationHours={selectedItin.estimated_duration_hours}
            />
          ) : null}

          {/* ── Price breakdown ────────────────────────────────────────── */}
          {selectedItin ? (
            <Card style={{ marginTop: 4, marginBottom: 4 }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: theme.colors.text, marginBottom: 14 }}>
                Price Breakdown
              </Text>
              <PriceRow label="Buddy fee" value={`${CURRENCY_SYMBOL}${buddyCost.toLocaleString('en-IN')}`} />
              <PriceRow
                label={`Estimated expenses (~${ESTIMATED_EXPENSES_PERCENT}%)`}
                value={`${CURRENCY_SYMBOL}${estimatedExpenses.toLocaleString('en-IN')}`}
                muted
              />
              <PriceRow
                label={`Platform commission (${(COMMISSION_RATE * 100).toFixed(0)}%)`}
                value={`${CURRENCY_SYMBOL}${commission.toLocaleString('en-IN')}`}
                muted
              />
              <View style={{ height: 1, backgroundColor: theme.colors.divider, marginVertical: 10 }} />
              <PriceRow label="Total" value={`${CURRENCY_SYMBOL}${total.toLocaleString('en-IN')}`} bold />
              <Text style={{ fontSize: 11, color: theme.colors.textMuted, marginTop: 2 }}>
                Held in escrow until tour completes · expenses may vary
              </Text>
            </Card>
          ) : null}

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
            onPress={handleConfirm}
            onPressIn={() => { confirmScale.value = withSpring(0.96, { damping: 15, stiffness: 150 }); }}
            onPressOut={() => { confirmScale.value = withSpring(1, { damping: 15, stiffness: 150 }); }}
            disabled={submitting || loading}
            activeOpacity={0.9}
            style={{
              height: 56, borderRadius: 16,
              backgroundColor: submitting || loading ? '#E5E7EB' : theme.colors.accent,
              alignItems: 'center', justifyContent: 'center',
              ...theme.shadows.lg,
            }}
          >
            {submitting ? (
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>Sending request…</Text>
            ) : (
              <Text style={{ color: submitting || loading ? '#9CA3AF' : '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 }}>
                Confirm Booking →
              </Text>
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}
