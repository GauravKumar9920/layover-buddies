// ============================================================================
// TRAVELER ONBOARDING — 4-step flow run right after signup
// ============================================================================
// Step 1 — Nationality (flag picker)
// Step 2 — Trip window (arrival date+time, departure date+time, optional flight nos)
// Step 3 — Interests (multi-select chips)
// Step 4 — "Max 3 buddies at a time" notice + Continue → routes to Explore
//
// Persists all answers via completeOnboarding() at the end of step 4.
// ============================================================================

import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Platform, Alert,
  KeyboardAvoidingView, ActivityIndicator, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { format, parseISO, isValid, isBefore, differenceInMinutes } from 'date-fns';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { hapticImpactMedium, hapticSuccess, hapticError } from '@/lib/haptics';
import { completeOnboarding } from '@/lib/api/travelerProfile';
import { notifyOnboardingComplete } from '@/lib/onboardingSignal';
import { theme } from '@/config/theme';

// ─── Reference data ─────────────────────────────────────────────────────────

const NATIONALITIES: { code: string; name: string; flag: string }[] = [
  { code: 'US', name: 'United States',  flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'DE', name: 'Germany',        flag: '🇩🇪' },
  { code: 'FR', name: 'France',         flag: '🇫🇷' },
  { code: 'JP', name: 'Japan',          flag: '🇯🇵' },
  { code: 'AU', name: 'Australia',      flag: '🇦🇺' },
  { code: 'CA', name: 'Canada',         flag: '🇨🇦' },
  { code: 'SG', name: 'Singapore',      flag: '🇸🇬' },
  { code: 'AE', name: 'UAE',            flag: '🇦🇪' },
  { code: 'IN', name: 'India',          flag: '🇮🇳' },
  { code: 'IT', name: 'Italy',          flag: '🇮🇹' },
  { code: 'ES', name: 'Spain',          flag: '🇪🇸' },
  { code: 'NL', name: 'Netherlands',    flag: '🇳🇱' },
  { code: 'KR', name: 'South Korea',    flag: '🇰🇷' },
  { code: 'BR', name: 'Brazil',         flag: '🇧🇷' },
  { code: 'OT', name: 'Other',          flag: '🌍' },
];

const INTERESTS: { key: string; label: string; emoji: string }[] = [
  { key: 'food',         label: 'Food & Street Eats', emoji: '🍜' },
  { key: 'history',      label: 'History & Heritage', emoji: '📚' },
  { key: 'photography',  label: 'Photography Spots',  emoji: '📸' },
  { key: 'culture',      label: 'Culture & Arts',     emoji: '🎭' },
  { key: 'nightlife',    label: 'Nightlife',          emoji: '🌙' },
  { key: 'hidden gems',  label: 'Hidden Gems',        emoji: '💎' },
  { key: 'adventure',    label: 'Adventure',          emoji: '🧗' },
  { key: 'shopping',     label: 'Shopping & Markets', emoji: '🛍️' },
  { key: 'architecture', label: 'Architecture',       emoji: '🏛️' },
  { key: 'bollywood',    label: 'Bollywood',          emoji: '🎬' },
];

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [nationality,  setNationality]  = useState<string | null>(null);
  const [arrivalDate,  setArrivalDate]  = useState('');
  const [arrivalTime,  setArrivalTime]  = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [departureTime, setDepartureTime] = useState('');
  const [flightIn,     setFlightIn]     = useState('');
  const [flightOut,    setFlightOut]    = useState('');
  const [interests,    setInterests]    = useState<string[]>([]);
  const [submitting,   setSubmitting]   = useState(false);

  // ── Validation per step ───────────────────────────────────────────────────
  const layoverHours = useMemo(() => {
    if (!arrivalDate || !arrivalTime || !departureDate || !departureTime) return null;
    if (!/^\d{2}:\d{2}$/.test(arrivalTime) || !/^\d{2}:\d{2}$/.test(departureTime)) return null;
    const a = parseISO(`${arrivalDate}T${arrivalTime}:00`);
    const d = parseISO(`${departureDate}T${departureTime}:00`);
    if (!isValid(a) || !isValid(d) || isBefore(d, a)) return null;
    return differenceInMinutes(d, a) / 60;
  }, [arrivalDate, arrivalTime, departureDate, departureTime]);
  const isLayoverEligible = layoverHours !== null && layoverHours >= 7;

  const canAdvance = useMemo(() => {
    if (step === 1) return !!nationality;
    if (step === 2) {
      if (!arrivalDate || !arrivalTime || !departureDate || !departureTime) return false;
      if (!/^\d{2}:\d{2}$/.test(arrivalTime) || !/^\d{2}:\d{2}$/.test(departureTime)) return false;
      const a = parseISO(`${arrivalDate}T${arrivalTime}:00`);
      const d = parseISO(`${departureDate}T${departureTime}:00`);
      if (!isValid(a) || !isValid(d) || isBefore(d, a)) return false;
      return isLayoverEligible;  // ← must have ≥7hr layover
    }
    if (step === 3) return interests.length >= 1;
    return true;
  }, [step, nationality, arrivalDate, arrivalTime, departureDate, departureTime, interests, isLayoverEligible]);

  function next() {
    if (!canAdvance) {
      hapticError();
      return;
    }
    hapticImpactMedium();
    if (step < 4) setStep((step + 1) as 1 | 2 | 3 | 4);
    else void finish();
  }

  function prev() {
    if (step > 1) setStep((step - 1) as 1 | 2 | 3 | 4);
  }

  async function finish() {
    if (!nationality || !arrivalDate || !arrivalTime || !departureDate || !departureTime) return;
    setSubmitting(true);
    try {
      // Construct ISO timestamps in IST so the layover window doesn't drift
      // by 5.5h when the device is in another timezone.
      const toIstIso = (date: string, time: string) => {
        const utcMs = Date.UTC(
          Number(date.slice(0, 4)),
          Number(date.slice(5, 7)) - 1,
          Number(date.slice(8, 10)),
          Number(time.slice(0, 2)),
          Number(time.slice(3, 5)),
        ) - (5 * 60 + 30) * 60_000;
        return new Date(utcMs).toISOString();
      };

      await completeOnboarding({
        nationality:  nationality!,
        arrival_at:   toIstIso(arrivalDate, arrivalTime),
        departure_at: toIstIso(departureDate, departureTime),
        flight_in:    flightIn.trim() || null,
        flight_out:   flightOut.trim() || null,
        interests,
      });
      hapticSuccess();
      // Tell useAuth to re-probe `onboarded_at` BEFORE we navigate. Without
      // this, the root layout's router guard still sees `needsOnboarding=true`
      // and bounces the user right back to this screen the instant we replace.
      notifyOnboardingComplete();
      // Tiny delay so the state update lands before the route swap fires.
      await new Promise((r) => setTimeout(r, 50));
      router.replace('/(traveler)/(tabs)' as never);
    } catch (err: unknown) {
      hapticError();
      const msg = err instanceof Error ? err.message : 'Please try again.';
      if (Platform.OS === 'web') window.alert(`Onboarding failed: ${msg}`);
      else Alert.alert('Onboarding failed', msg);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Hero with progress dots */}
      <LinearGradient
        colors={theme.gradients.hero}
        style={{ paddingTop: insets.top + 20, paddingHorizontal: 20, paddingBottom: 24 }}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 26, fontWeight: '800', letterSpacing: -0.4 }}>
          {step === 1 && 'Where are you visiting from?'}
          {step === 2 && 'When are you in Mumbai?'}
          {step === 3 && 'What interests you?'}
          {step === 4 && 'One last thing'}
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 6 }}>
          Step {step} of 4
        </Text>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 14 }}>
          {[1, 2, 3, 4].map((s) => (
            <View
              key={s}
              style={{
                flex: 1, height: 4, borderRadius: 2,
                backgroundColor: s <= step ? theme.colors.primary : 'rgba(255,255,255,0.2)',
              }}
            />
          ))}
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
      >
        {step === 1 && (
          <View style={{ gap: 10 }}>
            {NATIONALITIES.map((n) => {
              const selected = nationality === n.name;
              return (
                <TouchableOpacity
                  key={n.code}
                  onPress={() => { hapticImpactMedium(); setNationality(n.name); }}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 14,
                    backgroundColor: selected ? theme.colors.primaryLight : theme.colors.surface,
                    borderColor: selected ? theme.colors.primary : theme.colors.divider,
                    borderWidth: selected ? 2 : 1,
                    borderRadius: 12, padding: 14,
                  }}
                >
                  <Text style={{ fontSize: 26 }}>{n.flag}</Text>
                  <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: theme.colors.text }}>{n.name}</Text>
                  {selected && <Text style={{ color: theme.colors.primary, fontWeight: '700', fontSize: 14 }}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {step === 2 && (
          <View style={{ gap: 14 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: theme.colors.text, marginBottom: -4 }}>
              ✈️ Arrival in Mumbai
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <NativeDateField label="Date" value={arrivalDate} onChange={setArrivalDate} />
              </View>
              <View style={{ flex: 1 }}>
                <NativeTimeField label="Time" value={arrivalTime} onChange={setArrivalTime} />
              </View>
            </View>
            <Field
              label="Flight in (optional)" placeholder="e.g. EK504"
              value={flightIn} onChangeText={setFlightIn}
            />
            <View style={{ height: 1, backgroundColor: theme.colors.divider, marginVertical: 6 }} />
            <Text style={{ fontSize: 14, fontWeight: '700', color: theme.colors.text, marginBottom: -4 }}>
              🛫 Departure from Mumbai
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <NativeDateField label="Date" value={departureDate} onChange={setDepartureDate} />
              </View>
              <View style={{ flex: 1 }}>
                <NativeTimeField label="Time" value={departureTime} onChange={setDepartureTime} />
              </View>
            </View>
            <Field
              label="Flight out (optional)" placeholder="e.g. AI191"
              value={flightOut} onChangeText={setFlightOut}
            />

            {/* ── Layover eligibility banner ─────────────────────────────── */}
            {layoverHours !== null && (
              <View style={{
                backgroundColor: isLayoverEligible ? '#D1FAE5' : '#FEE2E2',
                borderRadius: 12, padding: 14, marginTop: 8,
                borderLeftWidth: 4,
                borderLeftColor: isLayoverEligible ? '#22C55E' : '#EF4444',
              }}>
                <Text style={{ fontWeight: '800', fontSize: 16, color: isLayoverEligible ? '#166534' : '#991B1B' }}>
                  {isLayoverEligible
                    ? `✅ You qualify! ${layoverHours.toFixed(1)}h layover`
                    : `❌ ${layoverHours.toFixed(1)}h layover — need at least 7h`}
                </Text>
                <Text style={{ fontSize: 13, color: isLayoverEligible ? '#15803D' : '#B91C1C', marginTop: 4, lineHeight: 18 }}>
                  {isLayoverEligible
                    ? 'You have enough time to explore Mumbai with a Buddy. Let\'s go!'
                    : 'Our Buddies need at least 7 hours to show you a meaningful slice of Mumbai. Adjust your arrival or departure times.'}
                </Text>
              </View>
            )}
          </View>
        )}

        {step === 3 && (
          <View>
            <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginBottom: 14 }}>
              Pick at least one — we'll surface buddies whose vibe matches.
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {INTERESTS.map((i) => {
                const selected = interests.includes(i.key);
                return (
                  <TouchableOpacity
                    key={i.key}
                    onPress={() => {
                      hapticImpactMedium();
                      setInterests((prev) =>
                        prev.includes(i.key) ? prev.filter((p) => p !== i.key) : [...prev, i.key],
                      );
                    }}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 8,
                      backgroundColor: selected ? theme.colors.primaryLight : theme.colors.surface,
                      borderColor: selected ? theme.colors.primary : theme.colors.divider,
                      borderWidth: selected ? 2 : 1,
                      borderRadius: 20, paddingVertical: 10, paddingHorizontal: 14,
                    }}
                  >
                    <Text style={{ fontSize: 18 }}>{i.emoji}</Text>
                    <Text style={{
                      fontSize: 14,
                      fontWeight: selected ? '700' : '500',
                      color: selected ? theme.colors.primary : theme.colors.text,
                    }}>{i.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {step === 4 && (
          <View style={{ gap: 14 }}>
            <Text style={{ fontSize: 60, textAlign: 'center', marginTop: 12 }}>🎓</Text>
            <Text style={{ fontSize: 20, fontWeight: '800', color: theme.colors.text, textAlign: 'center' }}>
              You can chat with up to 3 Buddies at a time.
            </Text>
            <Text style={{ fontSize: 14, color: theme.colors.textSecondary, lineHeight: 21, textAlign: 'center', paddingHorizontal: 6 }}>
              Our Buddies are students. We respect their time — keeping the
              shortlist small means each Buddy can fully personalize your day,
              not split attention across a dozen inboxes.
            </Text>
            <View style={{ backgroundColor: theme.colors.primaryLight, borderRadius: 12, padding: 14, marginTop: 8 }}>
              <Text style={{ fontSize: 13, color: theme.colors.primary, fontWeight: '600', lineHeight: 19 }}>
                ✨ Tip: explore each Buddy's profile and itineraries first — message the ones whose vibe matches yours.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: theme.colors.surface,
        borderTopColor: theme.colors.divider, borderTopWidth: 1,
        padding: 16, paddingBottom: insets.bottom + 16,
        flexDirection: 'row', gap: 10,
      }}>
        {step > 1 ? (
          <TouchableOpacity
            onPress={prev}
            disabled={submitting}
            style={{ paddingHorizontal: 18, justifyContent: 'center' }}
          >
            <Text style={{ color: theme.colors.textSecondary, fontWeight: '600' }}>Back</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          onPress={next}
          disabled={!canAdvance || submitting}
          style={{
            flex: 1, height: 52, borderRadius: 14,
            backgroundColor: !canAdvance || submitting ? '#E5E7EB' : theme.colors.accent,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          {submitting
            ? <ActivityIndicator color="#FFFFFF" />
            : (
              <Text style={{ color: !canAdvance ? '#9CA3AF' : '#FFFFFF', fontWeight: '700', fontSize: 16 }}>
                {step < 4 ? 'Continue →' : "Okay, let's go →"}
              </Text>
            )
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Inline labelled text input ─────────────────────────────────────────────
function Field({
  label, value, onChangeText, placeholder, helper, maxLength,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder: string; helper?: string; maxLength?: number;
}) {
  return (
    <View>
      <Text style={{
        fontSize: 11, fontWeight: '700', color: theme.colors.textSecondary,
        letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6,
      }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        maxLength={maxLength}
        style={{
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.md,
          borderWidth: 1, borderColor: theme.colors.divider,
          paddingHorizontal: 14, paddingVertical: 12,
          fontSize: 15, color: theme.colors.text,
          ...(Platform.OS === 'web' ? { outline: 'none' } as any : {}),
        }}
      />
      {helper ? <Text style={{ fontSize: 11, color: theme.colors.textMuted, marginTop: 4 }}>{helper}</Text> : null}
    </View>
  );
}

// ─── Date/time pickers ──────────────────────────────────────────────────────
// Web uses native <input type="date|time"> for the built-in OS picker.
// Native uses @react-native-community/datetimepicker — Android shows a modal
// dialog automatically; iOS needs the spinner wrapped in a confirm modal so
// the user can dismiss after picking.

const fieldLabelStyle = {
  fontSize: 11, fontWeight: '700' as const, color: theme.colors.textSecondary,
  letterSpacing: 0.8, textTransform: 'uppercase' as const, marginBottom: 6,
};

const fieldButtonStyle = {
  backgroundColor: theme.colors.surface,
  borderRadius: theme.borderRadius.md,
  borderWidth: 1,
  borderColor: theme.colors.divider,
  paddingHorizontal: 14,
  paddingVertical: 14,
  minHeight: 48,
  justifyContent: 'center' as const,
};

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function isoFromDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function hhmmFromDate(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function NativeDateField({
  label, value, onChange,
}: { label: string; value: string; onChange: (iso: string) => void }) {
  const [showPicker, setShowPicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(() => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const d = parseISO(`${value}T00:00:00`);
      if (isValid(d)) return d;
    }
    return new Date();
  });

  if (Platform.OS === 'web') {
    return (
      <View>
        <Text style={fieldLabelStyle}>{label}</Text>
        {React.createElement('input', {
          type: 'date',
          value,
          min: new Date().toISOString().slice(0, 10),
          onChange: (e: any) => onChange(e.target.value),
          style: {
            backgroundColor: theme.colors.surface,
            borderRadius: 8,
            border: `1px solid ${theme.colors.divider}`,
            padding: '14px 14px',
            fontSize: 15,
            color: theme.colors.text,
            width: '100%',
            boxSizing: 'border-box',
            outline: 'none',
            fontFamily: 'inherit',
          },
        })}
      </View>
    );
  }

  const display = value && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? format(parseISO(`${value}T00:00:00`), 'EEE, d MMM yyyy')
    : '';

  // Android: picker is a modal dialog managed by the OS — set the value on
  // the 'set' event and dismiss on 'dismissed'. iOS: render an inline spinner
  // inside a Modal with Cancel/Done so the user can confirm.
  const onAndroidChange = (event: DateTimePickerEvent, selected?: Date) => {
    setShowPicker(false);
    if (event.type === 'set' && selected) {
      onChange(isoFromDate(selected));
    }
  };

  return (
    <View>
      <Text style={fieldLabelStyle}>{label}</Text>
      <TouchableOpacity
        onPress={() => {
          hapticImpactMedium();
          setShowPicker(true);
        }}
        style={fieldButtonStyle}
        activeOpacity={0.7}
      >
        <Text style={{
          fontSize: 15,
          color: display ? theme.colors.text : theme.colors.textMuted,
        }}>
          {display || 'Pick a date'}
        </Text>
      </TouchableOpacity>

      {showPicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={tempDate}
          mode="date"
          display="calendar"
          minimumDate={new Date()}
          onChange={onAndroidChange}
        />
      )}

      {Platform.OS === 'ios' && (
        <Modal
          visible={showPicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowPicker(false)}
        >
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
            <View style={{ backgroundColor: theme.colors.surface, paddingBottom: 24 }}>
              <View style={{
                flexDirection: 'row', justifyContent: 'space-between',
                paddingHorizontal: 16, paddingVertical: 12,
                borderBottomWidth: 1, borderBottomColor: theme.colors.divider,
              }}>
                <TouchableOpacity onPress={() => setShowPicker(false)}>
                  <Text style={{ color: theme.colors.textSecondary, fontSize: 16 }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => {
                  onChange(isoFromDate(tempDate));
                  setShowPicker(false);
                }}>
                  <Text style={{ color: theme.colors.primary, fontSize: 16, fontWeight: '700' }}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempDate}
                mode="date"
                display="inline"
                minimumDate={new Date()}
                onChange={(_, selected) => { if (selected) setTempDate(selected); }}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

function NativeTimeField({
  label, value, onChange,
}: { label: string; value: string; onChange: (hhmm: string) => void }) {
  const [showPicker, setShowPicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(() => {
    if (value && /^\d{2}:\d{2}$/.test(value)) {
      const [h, m] = value.split(':').map(Number);
      const d = new Date();
      d.setHours(h, m, 0, 0);
      return d;
    }
    return new Date();
  });

  if (Platform.OS === 'web') {
    return (
      <View>
        <Text style={fieldLabelStyle}>{label}</Text>
        {React.createElement('input', {
          type: 'time',
          value,
          onChange: (e: any) => onChange(e.target.value),
          style: {
            backgroundColor: theme.colors.surface,
            borderRadius: 8,
            border: `1px solid ${theme.colors.divider}`,
            padding: '14px 14px',
            fontSize: 15,
            color: theme.colors.text,
            width: '100%',
            boxSizing: 'border-box',
            outline: 'none',
            fontFamily: 'inherit',
          },
        })}
      </View>
    );
  }

  const display = value && /^\d{2}:\d{2}$/.test(value)
    ? (() => {
        const [h, m] = value.split(':').map(Number);
        const d = new Date();
        d.setHours(h, m, 0, 0);
        return format(d, 'h:mm a');
      })()
    : '';

  const onAndroidChange = (event: DateTimePickerEvent, selected?: Date) => {
    setShowPicker(false);
    if (event.type === 'set' && selected) {
      onChange(hhmmFromDate(selected));
    }
  };

  return (
    <View>
      <Text style={fieldLabelStyle}>{label}</Text>
      <TouchableOpacity
        onPress={() => {
          hapticImpactMedium();
          setShowPicker(true);
        }}
        style={fieldButtonStyle}
        activeOpacity={0.7}
      >
        <Text style={{
          fontSize: 15,
          color: display ? theme.colors.text : theme.colors.textMuted,
        }}>
          {display || 'Pick a time'}
        </Text>
      </TouchableOpacity>

      {showPicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={tempDate}
          mode="time"
          display="clock"
          is24Hour={false}
          onChange={onAndroidChange}
        />
      )}

      {Platform.OS === 'ios' && (
        <Modal
          visible={showPicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowPicker(false)}
        >
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
            <View style={{ backgroundColor: theme.colors.surface, paddingBottom: 24 }}>
              <View style={{
                flexDirection: 'row', justifyContent: 'space-between',
                paddingHorizontal: 16, paddingVertical: 12,
                borderBottomWidth: 1, borderBottomColor: theme.colors.divider,
              }}>
                <TouchableOpacity onPress={() => setShowPicker(false)}>
                  <Text style={{ color: theme.colors.textSecondary, fontSize: 16 }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => {
                  onChange(hhmmFromDate(tempDate));
                  setShowPicker(false);
                }}>
                  <Text style={{ color: theme.colors.primary, fontSize: 16, fontWeight: '700' }}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempDate}
                mode="time"
                display="spinner"
                onChange={(_, selected) => { if (selected) setTempDate(selected); }}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}
