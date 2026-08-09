import React, { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "@/config/theme";
import { toMumbaiIso, istPartsFromIso } from "@/lib/time/ist";
import type {
  NextLayoverPayload,
  PartyType,
  TravelerProfile,
} from "@/lib/api/travelerProfile";
import {
  MAX_PARTY_SIZE,
  PARTY_SIZES,
  PARTY_TYPE_OPTIONS,
  PARTY_TYPE_FIXED_SIZE,
} from "@/config/profileOptions";
import { hapticImpactMedium, hapticSuccess } from "@/lib/haptics";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { PrivacyNote } from "@/components/profile/ProfileBuilder";
import {
  DateOrTimeField,
  fieldLabelStyle,
} from "@/components/ui/DateOrTimeField";

const MIN_LAYOVER_MINUTES = 7 * 60;

interface LayoverEditorModalProps {
  visible: boolean;
  replacingActiveLayover: boolean;
  /**
   * `create` archives the active layover and starts a new trip.
   * `edit` patches the current one in place — correcting a flight number must
   * not orphan the bookings that reference this trip.
   */
  mode?: "create" | "edit";
  /** Existing layover to pre-fill from. Required for `edit` to be meaningful. */
  initial?: TravelerProfile | null;
  onClose: () => void;
  onCreate: (payload: NextLayoverPayload) => Promise<void>;
}

export function LayoverEditorModal({
  visible,
  replacingActiveLayover,
  mode = "create",
  initial = null,
  onClose,
  onCreate,
}: LayoverEditorModalProps) {
  const insets = useSafeAreaInsets();
  const [arrivalDate, setArrivalDate] = useState("");
  const [arrivalTime, setArrivalTime] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [departureTime, setDepartureTime] = useState("");
  const [flightIn, setFlightIn] = useState("");
  const [flightOut, setFlightOut] = useState("");
  const [groupSize, setGroupSize] = useState(1);
  const [partyType, setPartyType] = useState<PartyType | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Pre-fill from the trip already on file. This used to blank every field on
  // open, so "fix my flight number" meant retyping four dates and times.
  // istPartsFromIso is the exact inverse of the toMumbaiIso used on save, which
  // is what makes the round-trip safe — see lib/time/ist.ts.
  useEffect(() => {
    if (!visible) return;
    const arrival = istPartsFromIso(initial?.arrival_at);
    const departure = istPartsFromIso(initial?.departure_at);
    setArrivalDate(arrival?.date ?? "");
    setArrivalTime(arrival?.time ?? "");
    setDepartureDate(departure?.date ?? "");
    setDepartureTime(departure?.time ?? "");
    setFlightIn(initial?.flight_in ?? "");
    setFlightOut(initial?.flight_out ?? "");
    setGroupSize(
      Math.max(1, Math.min(MAX_PARTY_SIZE, initial?.group_size ?? 1)),
    );
    setPartyType(initial?.party_type ?? null);
    setFormError(null);
  }, [visible, initial]);

  // Solo and couple imply their own headcount; family and friends do not.
  // Enforced here only — a DB CHECK across two independently-edited columns
  // fails with an opaque 23514 depending on which one moved first.
  function selectPartyType(next: PartyType) {
    hapticImpactMedium();
    setPartyType(next);
    const fixed = PARTY_TYPE_FIXED_SIZE[next];
    if (fixed) setGroupSize(fixed);
    else if (groupSize < 2) setGroupSize(2);
  }

  const layoverMinutes = useMemo(() => {
    if (
      !arrivalDate ||
      !arrivalTime ||
      !departureDate ||
      !departureTime ||
      !/^\d{2}:\d{2}$/.test(arrivalTime) ||
      !/^\d{2}:\d{2}$/.test(departureTime)
    ) {
      return null;
    }

    const arrival = Date.parse(toMumbaiIso(arrivalDate, arrivalTime) ?? "");
    const departure = Date.parse(toMumbaiIso(departureDate, departureTime) ?? "");
    if (!Number.isFinite(arrival) || !Number.isFinite(departure)) return null;
    return Math.floor((departure - arrival) / 60_000);
  }, [arrivalDate, arrivalTime, departureDate, departureTime]);

  const canSubmit =
    layoverMinutes !== null &&
    layoverMinutes >= MIN_LAYOVER_MINUTES &&
    groupSize >= 1 &&
    groupSize <= MAX_PARTY_SIZE;

  async function handleCreate() {
    if (!arrivalDate || !arrivalTime || !departureDate || !departureTime) {
      setFormError("Add both the arrival and departure date and time.");
      return;
    }
    if (layoverMinutes === null || layoverMinutes <= 0) {
      setFormError("Departure must be after arrival.");
      return;
    }
    if (layoverMinutes < MIN_LAYOVER_MINUTES) {
      setFormError(
        "Detour needs at least a 7-hour layover to allow for airport transfers.",
      );
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      await onCreate({
        arrival_at: toMumbaiIso(arrivalDate, arrivalTime) ?? "",
        departure_at: toMumbaiIso(departureDate, departureTime) ?? "",
        flight_in: flightIn.trim().toUpperCase() || null,
        flight_out: flightOut.trim().toUpperCase() || null,
        group_size: groupSize,
        party_type: partyType,
        airport_code: "BOM",
      });
      hapticSuccess();
      onClose();
    } catch (error: unknown) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Your layover could not be saved. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        if (!submitting) onClose();
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, backgroundColor: theme.colors.background }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: Math.max(insets.top, 16),
            paddingHorizontal: 20,
            paddingBottom: 14,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.divider,
          }}
        >
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text
              style={{
                ...theme.typography.eyebrow,
                color: theme.colors.primary,
              }}
            >
              Returning traveler
            </Text>
            <Text
              style={{
                fontFamily: theme.fonts.display,
                fontSize: 24,
                lineHeight: 30,
                color: theme.colors.text,
                marginTop: 3,
              }}
            >
              Plan your next Mumbai layover
            </Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Close layover form"
            disabled={submitting}
            onPress={onClose}
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: theme.colors.surface,
              borderWidth: 1,
              borderColor: theme.colors.divider,
              opacity: submitting ? 0.5 : 1,
            }}
          >
            <Feather name="x" size={20} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={{
            padding: 20,
            paddingBottom: Math.max(insets.bottom, 20) + 24,
            gap: 18,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <PrivacyNote icon={replacingActiveLayover ? "refresh-cw" : "clock"}>
            {replacingActiveLayover
              ? "Saving this archives your current active layover and makes the new one active. Past trips and their original details stay unchanged."
              : "Add the flight window you want to use for matching and planning. Times are entered in Mumbai time (IST)."}
          </PrivacyNote>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              borderRadius: theme.borderRadius.md,
              padding: 14,
              backgroundColor: theme.colors.text,
            }}
          >
            <View>
              <Text
                style={{
                  fontFamily: theme.fonts.mono,
                  fontSize: 10,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  color: "rgba(252,247,234,0.6)",
                }}
              >
                Airport
              </Text>
              <Text
                style={{
                  fontFamily: theme.fonts.bodySemi,
                  fontSize: 14,
                  color: "#FCF7EA",
                  marginTop: 4,
                }}
              >
                Chhatrapati Shivaji Maharaj International
              </Text>
            </View>
            <Text
              style={{
                fontFamily: theme.fonts.monoMed,
                fontSize: 18,
                color: theme.colors.gold,
              }}
            >
              BOM
            </Text>
          </View>

          <View style={{ gap: 10 }}>
            <Text
              style={{
                fontFamily: theme.fonts.bodyBold,
                fontSize: 16,
                color: theme.colors.text,
              }}
            >
              Arrival in Mumbai
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1.25 }}>
                <DateOrTimeField
                  mode="date"
                  label="Arrival date"
                  value={arrivalDate}
                  onChange={setArrivalDate}
                />
              </View>
              <View style={{ flex: 0.75 }}>
                <DateOrTimeField
                  mode="time"
                  label="Arrival time"
                  value={arrivalTime}
                  onChange={setArrivalTime}
                />
              </View>
            </View>
            <Input
              label="Flight in (optional)"
              value={flightIn}
              onChangeText={(value) => setFlightIn(value.toUpperCase())}
              placeholder="EK504"
              autoCapitalize="characters"
              maxLength={20}
            />
          </View>

          <View
            style={{
              height: 1,
              backgroundColor: theme.colors.divider,
            }}
          />

          <View style={{ gap: 10 }}>
            <Text
              style={{
                fontFamily: theme.fonts.bodyBold,
                fontSize: 16,
                color: theme.colors.text,
              }}
            >
              Departure from Mumbai
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1.25 }}>
                <DateOrTimeField
                  mode="date"
                  label="Departure date"
                  value={departureDate}
                  onChange={setDepartureDate}
                />
              </View>
              <View style={{ flex: 0.75 }}>
                <DateOrTimeField
                  mode="time"
                  label="Departure time"
                  value={departureTime}
                  onChange={setDepartureTime}
                />
              </View>
            </View>
            <Input
              label="Flight out (optional)"
              value={flightOut}
              onChangeText={(value) => setFlightOut(value.toUpperCase())}
              placeholder="AI191"
              autoCapitalize="characters"
              maxLength={20}
            />
          </View>

          <View>
            <Text style={fieldLabelStyle}>Who’s travelling?</Text>
            <View
              style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
            >
              {PARTY_TYPE_OPTIONS.map((option) => {
                const selected = option.key === partyType;
                return (
                  <TouchableOpacity
                    key={option.key}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${option.label} — ${option.hint}`}
                    onPress={() => selectPartyType(option.key)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      borderRadius: 20,
                      borderWidth: selected ? 2 : 1,
                      paddingVertical: 9,
                      paddingHorizontal: 13,
                      borderColor: selected
                        ? theme.colors.primary
                        : theme.colors.divider,
                      backgroundColor: selected
                        ? theme.colors.primaryLight
                        : theme.colors.surface,
                    }}
                  >
                    <Text style={{ fontSize: 14 }}>{option.emoji}</Text>
                    <Text
                      style={{
                        fontFamily: selected
                          ? theme.fonts.bodyBold
                          : theme.fonts.bodyMed,
                        fontSize: 13.5,
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
          </View>

          <View>
            <Text style={fieldLabelStyle}>Travelers in your group</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {PARTY_SIZES.map((size) => {
                const selected = size === groupSize;
                const lockedBy = partyType
                  ? PARTY_TYPE_FIXED_SIZE[partyType]
                  : null;
                const disabled = lockedBy !== null && lockedBy !== size;
                return (
                  <TouchableOpacity
                    key={size}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${size} ${size === 1 ? "traveler" : "travelers"}`}
                    disabled={disabled}
                    onPress={() => {
                      hapticImpactMedium();
                      setGroupSize(size);
                    }}
                    style={{
                      flex: 1,
                      opacity: disabled ? 0.4 : 1,
                      minHeight: 48,
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

          {layoverMinutes !== null && layoverMinutes > 0 ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 9,
                padding: 12,
                borderRadius: theme.borderRadius.md,
                backgroundColor:
                  layoverMinutes >= MIN_LAYOVER_MINUTES
                    ? "rgba(61,139,90,0.12)"
                    : "rgba(192,57,43,0.11)",
              }}
            >
              <Feather
                name={
                  layoverMinutes >= MIN_LAYOVER_MINUTES
                    ? "check-circle"
                    : "alert-circle"
                }
                size={18}
                color={
                  layoverMinutes >= MIN_LAYOVER_MINUTES
                    ? theme.colors.success
                    : theme.colors.error
                }
              />
              <Text
                style={{
                  flex: 1,
                  fontFamily: theme.fonts.bodySemi,
                  fontSize: 13,
                  color: theme.colors.text,
                }}
              >
                {(layoverMinutes / 60).toFixed(
                  layoverMinutes % 60 === 0 ? 0 : 1,
                )}
                -hour layover
                {layoverMinutes < MIN_LAYOVER_MINUTES
                  ? " · at least 7 hours required"
                  : " · eligible for a Detour"}
              </Text>
            </View>
          ) : null}

          {formError ? (
            <Text
              accessibilityRole="alert"
              style={{
                fontFamily: theme.fonts.bodySemi,
                fontSize: 13,
                lineHeight: 19,
                color: theme.colors.error,
              }}
            >
              {formError}
            </Text>
          ) : null}

          <Button
            title={
              replacingActiveLayover
                ? "Make this my active layover"
                : "Save active layover"
            }
            onPress={() => void handleCreate()}
            loading={submitting}
            disabled={!canSubmit}
            size="lg"
            icon={
              <Feather
                name={replacingActiveLayover ? "refresh-cw" : "check"}
                size={17}
                color="#FCF7EA"
              />
            }
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
