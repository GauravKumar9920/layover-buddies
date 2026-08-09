// ============================================================================
// TRAVELER ONBOARDING — 4-step flow run right after signup
// ============================================================================
// Step 1 — Who you are (gender, age band, nationality flag picker)
// Step 2 — Trip window (arrival/departure date+time, flight nos, who's coming)
// Step 3 — Interests (multi-select chips)
// Step 4 — "Max 3 buddies at a time" notice + Continue → routes to Explore
//
// Persists all answers via completeOnboarding() at the end of step 4.
// ============================================================================

import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Alert,
  KeyboardAvoidingView,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import {
  parseISO,
  isValid,
  isBefore,
  differenceInMinutes,
} from "date-fns";
import { hapticImpactMedium, hapticSuccess, hapticError } from "@/lib/haptics";
import { DateOrTimeField } from "@/components/ui/DateOrTimeField";
import { NationalityPicker } from "@/components/ui/NationalityPicker";
import { completeOnboarding } from "@/lib/api/travelerProfile";
import { notifyOnboardingComplete } from "@/lib/onboardingSignal";
import { theme } from "@/config/theme";
import {
  AGE_BAND_OPTIONS as AGE_BANDS,
  GENDER_OPTIONS as GENDERS,
  INTEREST_OPTIONS as INTERESTS,
  PARTY_SIZES,
  PARTY_TYPE_OPTIONS,
  PARTY_TYPE_FIXED_SIZE,
} from "@/config/profileOptions";
import type { AgeBand, PartyType } from "@/lib/api/travelerProfile";

// ─── Reference data ─────────────────────────────────────────────────────────

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [nationality, setNationality] = useState<string | null>(null);
  const [gender, setGender] = useState<string | null>(null);
  const [ageBand, setAgeBand] = useState<AgeBand | null>(null);
  const [partyType, setPartyType] = useState<PartyType | null>(null);
  const [groupSize, setGroupSize] = useState(1);
  const [arrivalDate, setArrivalDate] = useState("");
  const [arrivalTime, setArrivalTime] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [departureTime, setDepartureTime] = useState("");
  const [flightIn, setFlightIn] = useState("");
  const [flightOut, setFlightOut] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // ── Validation per step ───────────────────────────────────────────────────
  const layoverHours = useMemo(() => {
    if (!arrivalDate || !arrivalTime || !departureDate || !departureTime)
      return null;
    if (
      !/^\d{2}:\d{2}$/.test(arrivalTime) ||
      !/^\d{2}:\d{2}$/.test(departureTime)
    )
      return null;
    const a = parseISO(`${arrivalDate}T${arrivalTime}:00`);
    const d = parseISO(`${departureDate}T${departureTime}:00`);
    if (!isValid(a) || !isValid(d) || isBefore(d, a)) return null;
    return differenceInMinutes(d, a) / 60;
  }, [arrivalDate, arrivalTime, departureDate, departureTime]);
  const isLayoverEligible = layoverHours !== null && layoverHours >= 7;

  const canAdvance = useMemo(() => {
    if (step === 1) return !!nationality && !!gender && !!ageBand;
    if (step === 2) {
      if (!arrivalDate || !arrivalTime || !departureDate || !departureTime)
        return false;
      if (
        !/^\d{2}:\d{2}$/.test(arrivalTime) ||
        !/^\d{2}:\d{2}$/.test(departureTime)
      )
        return false;
      const a = parseISO(`${arrivalDate}T${arrivalTime}:00`);
      const d = parseISO(`${departureDate}T${departureTime}:00`);
      if (!isValid(a) || !isValid(d) || isBefore(d, a)) return false;
      if (!partyType) return false;
      return isLayoverEligible; // ← must have ≥7hr layover
    }
    if (step === 3) return interests.length >= 1;
    return true;
  }, [
    step,
    nationality,
    gender,
    ageBand,
    partyType,
    arrivalDate,
    arrivalTime,
    departureDate,
    departureTime,
    interests,
    isLayoverEligible,
  ]);

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
    if (
      !nationality ||
      !arrivalDate ||
      !arrivalTime ||
      !departureDate ||
      !departureTime
    )
      return;
    setSubmitting(true);
    try {
      // Construct ISO timestamps in IST so the layover window doesn't drift
      // by 5.5h when the device is in another timezone.
      const toIstIso = (date: string, time: string) => {
        const utcMs =
          Date.UTC(
            Number(date.slice(0, 4)),
            Number(date.slice(5, 7)) - 1,
            Number(date.slice(8, 10)),
            Number(time.slice(0, 2)),
            Number(time.slice(3, 5)),
          ) -
          (5 * 60 + 30) * 60_000;
        return new Date(utcMs).toISOString();
      };

      await completeOnboarding({
        nationality: nationality!,
        gender: gender,
        arrival_at: toIstIso(arrivalDate, arrivalTime),
        departure_at: toIstIso(departureDate, departureTime),
        flight_in: flightIn.trim() || null,
        flight_out: flightOut.trim() || null,
        interests,
        age_band: ageBand,
        party_type: partyType,
        group_size: groupSize,
      });
      hapticSuccess();
      // Tell useAuth to re-probe `onboarded_at` BEFORE we navigate. Without
      // this, the root layout's router guard still sees `needsOnboarding=true`
      // and bounces the user right back to this screen the instant we replace.
      notifyOnboardingComplete();
      // Tiny delay so the state update lands before the route swap fires.
      await new Promise((r) => setTimeout(r, 50));
      router.replace("/(traveler)/(tabs)" as never);
    } catch (err: unknown) {
      hapticError();
      const msg = err instanceof Error ? err.message : "Please try again.";
      if (Platform.OS === "web") window.alert(`Onboarding failed: ${msg}`);
      else Alert.alert("Onboarding failed", msg);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Hero with progress dots */}
      <LinearGradient
        colors={theme.gradients.hero}
        style={{
          paddingTop: insets.top + 20,
          paddingHorizontal: 20,
          paddingBottom: 24,
        }}
      >
        <Text
          style={{
            fontFamily: theme.fonts.mono,
            color: "rgba(252,247,234,0.7)",
            fontSize: 11,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Step {step} of 4
        </Text>
        <Text
          style={{
            fontFamily: theme.fonts.display,
            color: "#FCF7EA",
            fontSize: 26,
            letterSpacing: -0.4,
            lineHeight: 32,
          }}
        >
          {step === 1 && "Tell us about you"}
          {step === 2 && "When are you in Mumbai?"}
          {step === 3 && "What interests you?"}
          {step === 4 && "One last thing"}
        </Text>
        <View style={{ flexDirection: "row", gap: 6, marginTop: 14 }}>
          {[1, 2, 3, 4].map((s) => (
            <View
              key={s}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                backgroundColor:
                  s <= step ? theme.colors.primary : "rgba(255,255,255,0.2)",
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
            {/* Gender */}
            <Text
              style={{
                ...theme.typography.eyebrow,
                color: theme.colors.primary,
                marginBottom: 2,
              }}
            >
              You identify as
            </Text>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: 10,
              }}
            >
              {GENDERS.map((g) => {
                const selected = gender === g.key;
                return (
                  <TouchableOpacity
                    key={g.key}
                    onPress={() => {
                      hapticImpactMedium();
                      setGender(g.key);
                    }}
                    style={{
                      backgroundColor: selected
                        ? theme.colors.primary
                        : theme.colors.surface,
                      borderColor: selected
                        ? theme.colors.primaryDark
                        : theme.colors.divider,
                      borderWidth: 1.5,
                      borderRadius: 20,
                      paddingVertical: 9,
                      paddingHorizontal: 15,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: theme.fonts.bodySemi,
                        fontSize: 13.5,
                        color: selected
                          ? "#FCF7EA"
                          : theme.colors.textSecondary,
                      }}
                    >
                      {g.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text
              style={{
                ...theme.typography.eyebrow,
                color: theme.colors.primary,
                marginBottom: 2,
              }}
            >
              Your age
            </Text>
            <Text
              style={{
                fontFamily: theme.fonts.body,
                fontSize: 12.5,
                color: theme.colors.textSecondary,
                marginTop: -6,
                marginBottom: 4,
              }}
            >
              A range is enough — it helps your Buddy pitch the right day.
            </Text>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: 10,
              }}
            >
              {AGE_BANDS.map((band) => {
                const selected = ageBand === band.key;
                return (
                  <TouchableOpacity
                    key={band.key}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      hapticImpactMedium();
                      setAgeBand(band.key);
                    }}
                    style={{
                      backgroundColor: selected
                        ? theme.colors.primary
                        : theme.colors.surface,
                      borderColor: selected
                        ? theme.colors.primaryDark
                        : theme.colors.divider,
                      borderWidth: 1.5,
                      borderRadius: 20,
                      paddingVertical: 9,
                      paddingHorizontal: 15,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: theme.fonts.monoMed,
                        fontSize: 13.5,
                        color: selected
                          ? "#FCF7EA"
                          : theme.colors.textSecondary,
                      }}
                    >
                      {band.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <NationalityPicker
              label="Nationality"
              value={nationality}
              onChange={setNationality}
            />
          </View>
        )}

        {step === 2 && (
          <View style={{ gap: 14 }}>
            <Text
              style={{
                ...theme.typography.eyebrow,
                color: theme.colors.primary,
                marginBottom: -2,
              }}
            >
              Arrival in Mumbai
            </Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <DateOrTimeField
                  mode="date"
                  label="Date"
                  value={arrivalDate}
                  onChange={setArrivalDate}
                />
              </View>
              <View style={{ flex: 1 }}>
                <DateOrTimeField
                  mode="time"
                  label="Time"
                  value={arrivalTime}
                  onChange={setArrivalTime}
                />
              </View>
            </View>
            <Field
              label="Flight in (optional)"
              placeholder="e.g. EK504"
              value={flightIn}
              onChangeText={setFlightIn}
            />
            <View
              style={{
                height: 1,
                backgroundColor: theme.colors.divider,
                marginVertical: 6,
              }}
            />
            <Text
              style={{
                ...theme.typography.eyebrow,
                color: theme.colors.primary,
                marginBottom: -2,
              }}
            >
              Departure from Mumbai
            </Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <DateOrTimeField
                  mode="date"
                  label="Date"
                  value={departureDate}
                  onChange={setDepartureDate}
                />
              </View>
              <View style={{ flex: 1 }}>
                <DateOrTimeField
                  mode="time"
                  label="Time"
                  value={departureTime}
                  onChange={setDepartureTime}
                />
              </View>
            </View>
            <Field
              label="Flight out (optional)"
              placeholder="e.g. AI191"
              value={flightOut}
              onChangeText={setFlightOut}
            />

            <View
              style={{
                height: 1,
                backgroundColor: theme.colors.divider,
                marginVertical: 6,
              }}
            />
            <Text
              style={{
                ...theme.typography.eyebrow,
                color: theme.colors.primary,
                marginBottom: -2,
              }}
            >
              Who’s travelling?
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {PARTY_TYPE_OPTIONS.map((option) => {
                const selected = partyType === option.key;
                return (
                  <TouchableOpacity
                    key={option.key}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${option.label} — ${option.hint}`}
                    onPress={() => {
                      hapticImpactMedium();
                      setPartyType(option.key);
                      // Solo and couple imply their headcount; family and
                      // friends leave it to the traveler.
                      const fixed = PARTY_TYPE_FIXED_SIZE[option.key];
                      if (fixed) setGroupSize(fixed);
                      else if (groupSize < 2) setGroupSize(2);
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 7,
                      backgroundColor: selected
                        ? theme.colors.primaryLight
                        : theme.colors.surface,
                      borderColor: selected
                        ? theme.colors.primary
                        : theme.colors.divider,
                      borderWidth: selected ? 2 : 1,
                      borderRadius: 20,
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                    }}
                  >
                    <Text style={{ fontSize: 15 }}>{option.emoji}</Text>
                    <Text
                      style={{
                        fontFamily: selected
                          ? theme.fonts.bodyBold
                          : theme.fonts.bodyMed,
                        fontSize: 14,
                        color: selected
                          ? theme.colors.primaryDark
                          : theme.colors.text,
                      }}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {partyType ? (
              <View>
                <Text
                  style={{
                    fontFamily: theme.fonts.mono,
                    fontSize: 11,
                    color: theme.colors.textSecondary,
                    letterSpacing: 1.2,
                    textTransform: "uppercase",
                    marginBottom: 6,
                  }}
                >
                  How many of you
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {PARTY_SIZES.map((size) => {
                    const selected = size === groupSize;
                    const fixed = PARTY_TYPE_FIXED_SIZE[partyType];
                    const disabled = fixed !== null && fixed !== size;
                    return (
                      <TouchableOpacity
                        key={size}
                        accessibilityRole="button"
                        accessibilityState={{ selected, disabled }}
                        accessibilityLabel={`${size} ${size === 1 ? "traveller" : "travellers"}`}
                        disabled={disabled}
                        onPress={() => {
                          hapticImpactMedium();
                          setGroupSize(size);
                        }}
                        style={{
                          flex: 1,
                          minHeight: 48,
                          opacity: disabled ? 0.4 : 1,
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: theme.borderRadius.md,
                          borderWidth: 1.5,
                          borderColor: selected
                            ? theme.colors.primaryDark
                            : theme.colors.divider,
                          backgroundColor: selected
                            ? theme.colors.primary
                            : theme.colors.surface,
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: theme.fonts.monoMed,
                            fontSize: 16,
                            color: selected ? "#FCF7EA" : theme.colors.text,
                          }}
                        >
                          {size}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {/* ── Layover eligibility banner ─────────────────────────────── */}
            {layoverHours !== null && (
              <View
                style={{
                  backgroundColor: isLayoverEligible
                    ? "rgba(61,139,90,0.12)"
                    : theme.colors.primaryLight,
                  borderRadius: theme.borderRadius.md,
                  padding: 14,
                  marginTop: 8,
                  borderLeftWidth: 3,
                  borderLeftColor: isLayoverEligible
                    ? theme.colors.success
                    : theme.colors.error,
                }}
              >
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: isLayoverEligible
                        ? theme.colors.success
                        : theme.colors.error,
                    }}
                  />
                  <Text
                    style={{
                      fontFamily: theme.fonts.displaySemi,
                      fontSize: 16,
                      color: isLayoverEligible ? "#2F6E45" : "#8E2C20",
                    }}
                  >
                    {isLayoverEligible
                      ? `You qualify — ${layoverHours.toFixed(1)}h layover`
                      : `${layoverHours.toFixed(1)}h layover — need at least 7h`}
                  </Text>
                </View>
                <Text
                  style={{
                    fontFamily: theme.fonts.body,
                    fontSize: 13,
                    color: isLayoverEligible ? "#2F6E45" : "#8E2C20",
                    marginTop: 6,
                    lineHeight: 18,
                  }}
                >
                  {isLayoverEligible
                    ? "You have enough time to explore Mumbai with a Buddy. Let's go!"
                    : "Our Buddies need at least 7 hours to show you a meaningful slice of Mumbai. Adjust your arrival or departure times."}
                </Text>
              </View>
            )}
          </View>
        )}

        {step === 3 && (
          <View>
            <Text
              style={{
                fontFamily: theme.fonts.body,
                fontSize: 14,
                color: theme.colors.textSecondary,
                marginBottom: 16,
                lineHeight: 20,
              }}
            >
              Pick at least one — we'll surface buddies whose vibe matches.
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {INTERESTS.map((i) => {
                const selected = interests.includes(i.key);
                return (
                  <TouchableOpacity
                    key={i.key}
                    onPress={() => {
                      hapticImpactMedium();
                      setInterests((prev) =>
                        prev.includes(i.key)
                          ? prev.filter((p) => p !== i.key)
                          : [...prev, i.key],
                      );
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      backgroundColor: selected
                        ? theme.colors.primaryLight
                        : theme.colors.surface,
                      borderColor: selected
                        ? theme.colors.primary
                        : theme.colors.divider,
                      borderWidth: selected ? 2 : 1,
                      borderRadius: 20,
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                    }}
                  >
                    <Text style={{ fontSize: 16 }}>{i.emoji}</Text>
                    <Text
                      style={{
                        fontFamily: selected
                          ? theme.fonts.bodyBold
                          : theme.fonts.bodyMed,
                        fontSize: 14,
                        color: selected
                          ? theme.colors.primaryDark
                          : theme.colors.text,
                      }}
                    >
                      {i.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {step === 4 && (
          <View style={{ gap: 14 }}>
            <View
              style={{
                alignSelf: "center",
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: theme.colors.primary,
                borderWidth: 1.5,
                borderColor: theme.colors.primaryDark,
                alignItems: "center",
                justifyContent: "center",
                marginTop: 12,
              }}
            >
              <Text
                style={{
                  fontFamily: theme.fonts.serif,
                  fontSize: 40,
                  color: "#FCF7EA",
                }}
              >
                3
              </Text>
            </View>
            <Text
              style={{
                fontFamily: theme.fonts.display,
                fontSize: 22,
                color: theme.colors.text,
                textAlign: "center",
                letterSpacing: -0.3,
                lineHeight: 28,
              }}
            >
              You can chat with up to 3 Buddies at a time.
            </Text>
            <Text
              style={{
                fontFamily: theme.fonts.body,
                fontSize: 14,
                color: theme.colors.textSecondary,
                lineHeight: 21,
                textAlign: "center",
                paddingHorizontal: 6,
              }}
            >
              Our Buddies are students. We respect their time — keeping the
              shortlist small means each Buddy can fully personalize your day,
              not split attention across a dozen inboxes.
            </Text>
            <View
              style={{
                backgroundColor: theme.colors.primaryLight,
                borderWidth: 1,
                borderColor: "rgba(200,84,42,0.25)",
                borderRadius: theme.borderRadius.md,
                padding: 14,
                marginTop: 8,
              }}
            >
              <Text
                style={{
                  ...theme.typography.eyebrow,
                  color: theme.colors.primaryDark,
                  marginBottom: 5,
                }}
              >
                Tip
              </Text>
              <Text
                style={{
                  fontFamily: theme.fonts.body,
                  fontSize: 13,
                  color: theme.colors.text,
                  lineHeight: 19,
                }}
              >
                Explore each Buddy's profile and itineraries first — message the
                ones whose vibe matches yours.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: theme.colors.surface,
          borderTopColor: "rgba(14,25,41,0.12)",
          borderTopWidth: 1,
          padding: 16,
          paddingBottom: insets.bottom + 16,
          flexDirection: "row",
          gap: 10,
        }}
      >
        {step > 1 ? (
          <TouchableOpacity
            onPress={prev}
            disabled={submitting}
            style={{ paddingHorizontal: 18, justifyContent: "center" }}
          >
            <Text
              style={{
                fontFamily: theme.fonts.bodySemi,
                color: theme.colors.textSecondary,
                fontSize: 15,
              }}
            >
              Back
            </Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          onPress={next}
          disabled={!canAdvance || submitting}
          activeOpacity={0.9}
          style={{
            flex: 1,
            height: 54,
            borderRadius: theme.borderRadius.md,
            backgroundColor:
              !canAdvance || submitting ? "#E3D9C2" : theme.colors.primary,
            borderWidth: 1.5,
            borderColor:
              !canAdvance || submitting ? "#D3C6A8" : theme.colors.primaryDark,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {submitting ? (
            <ActivityIndicator color="#FCF7EA" />
          ) : (
            <Text
              style={{
                fontFamily: theme.fonts.bodyBold,
                color: !canAdvance ? "#9A9384" : "#FCF7EA",
                fontSize: 16,
                letterSpacing: 0.2,
              }}
            >
              {step < 4 ? "Continue" : "Okay, let's go"}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Inline labelled text input ─────────────────────────────────────────────
function Field({
  label,
  value,
  onChangeText,
  placeholder,
  helper,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  helper?: string;
  maxLength?: number;
}) {
  return (
    <View>
      <Text
        style={{
          fontFamily: theme.fonts.mono,
          fontSize: 11,
          color: theme.colors.textSecondary,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
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
          borderWidth: 1,
          borderColor: theme.colors.divider,
          paddingHorizontal: 14,
          paddingVertical: 12,
          fontSize: 15,
          color: theme.colors.text,
          ...(Platform.OS === "web" ? ({ outline: "none" } as any) : {}),
        }}
      />
      {helper ? (
        <Text
          style={{ fontSize: 11, color: theme.colors.textMuted, marginTop: 4 }}
        >
          {helper}
        </Text>
      ) : null}
    </View>
  );
}
