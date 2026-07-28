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
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import Feather from "@expo/vector-icons/Feather";
import { format, isValid, parseISO } from "date-fns";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "@/config/theme";
import type { NextLayoverPayload } from "@/lib/api/travelerProfile";
import { hapticImpactMedium, hapticSuccess } from "@/lib/haptics";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { PrivacyNote } from "@/components/profile/ProfileBuilder";

const MIN_LAYOVER_MINUTES = 7 * 60;

interface LayoverEditorModalProps {
  visible: boolean;
  replacingActiveLayover: boolean;
  onClose: () => void;
  onCreate: (payload: NextLayoverPayload) => Promise<void>;
}

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

function dateValue(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function timeValue(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function toMumbaiIso(date: string, time: string): string {
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
}

export function LayoverEditorModal({
  visible,
  replacingActiveLayover,
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
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setArrivalDate("");
    setArrivalTime("");
    setDepartureDate("");
    setDepartureTime("");
    setFlightIn("");
    setFlightOut("");
    setGroupSize(1);
    setFormError(null);
  }, [visible]);

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

    const arrival = Date.parse(toMumbaiIso(arrivalDate, arrivalTime));
    const departure = Date.parse(toMumbaiIso(departureDate, departureTime));
    if (!Number.isFinite(arrival) || !Number.isFinite(departure)) return null;
    return Math.floor((departure - arrival) / 60_000);
  }, [arrivalDate, arrivalTime, departureDate, departureTime]);

  const canSubmit =
    layoverMinutes !== null &&
    layoverMinutes >= MIN_LAYOVER_MINUTES &&
    groupSize >= 1 &&
    groupSize <= 3;

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
        arrival_at: toMumbaiIso(arrivalDate, arrivalTime),
        departure_at: toMumbaiIso(departureDate, departureTime),
        flight_in: flightIn.trim().toUpperCase() || null,
        flight_out: flightOut.trim().toUpperCase() || null,
        group_size: groupSize,
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
            <Text style={fieldLabelStyle}>Travelers in your group</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[1, 2, 3].map((size) => {
                const selected = size === groupSize;
                return (
                  <TouchableOpacity
                    key={size}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${size} ${size === 1 ? "traveler" : "travelers"}`}
                    onPress={() => {
                      hapticImpactMedium();
                      setGroupSize(size);
                    }}
                    style={{
                      flex: 1,
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

const fieldLabelStyle = {
  ...theme.typography.eyebrow,
  color: theme.colors.textSecondary,
  marginBottom: 7,
};

function DateOrTimeField({
  mode,
  label,
  value,
  onChange,
}: {
  mode: "date" | "time";
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [pickerVisible, setPickerVisible] = useState(false);
  const [temporaryDate, setTemporaryDate] = useState(new Date());

  useEffect(() => {
    if (mode === "date" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const parsed = parseISO(`${value}T12:00:00`);
      if (isValid(parsed)) setTemporaryDate(parsed);
    }
    if (mode === "time" && /^\d{2}:\d{2}$/.test(value)) {
      const [hours, minutes] = value.split(":").map(Number);
      const parsed = new Date();
      parsed.setHours(hours, minutes, 0, 0);
      setTemporaryDate(parsed);
    }
  }, [mode, value]);

  if (Platform.OS === "web") {
    return (
      <View>
        <Text style={fieldLabelStyle}>{label}</Text>
        {React.createElement("input", {
          type: mode,
          value,
          ...(mode === "date"
            ? { min: new Date().toISOString().slice(0, 10) }
            : {}),
          onChange: (event: { target: { value: string } }) =>
            onChange(event.target.value),
          style: {
            backgroundColor: theme.colors.surface,
            borderRadius: 8,
            border: `1px solid ${theme.colors.divider}`,
            padding: "14px 14px",
            fontSize: 15,
            color: theme.colors.text,
            width: "100%",
            boxSizing: "border-box",
            outline: "none",
            fontFamily: "inherit",
          },
        })}
      </View>
    );
  }

  const displayValue =
    mode === "date" && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? format(parseISO(`${value}T12:00:00`), "d MMM yyyy")
      : mode === "time" && /^\d{2}:\d{2}$/.test(value)
        ? format(temporaryDate, "h:mm a")
        : null;

  function handleAndroidChange(event: DateTimePickerEvent, selected?: Date) {
    setPickerVisible(false);
    if (event.type !== "set" || !selected) return;
    setTemporaryDate(selected);
    onChange(mode === "date" ? dateValue(selected) : timeValue(selected));
  }

  return (
    <View>
      <Text style={fieldLabelStyle}>{label}</Text>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`${label}. ${displayValue ?? "Not set"}`}
        onPress={() => {
          hapticImpactMedium();
          setPickerVisible(true);
        }}
        style={{
          minHeight: 48,
          justifyContent: "center",
          paddingHorizontal: 12,
          borderRadius: theme.borderRadius.md,
          borderWidth: 1,
          borderColor: theme.colors.divider,
          backgroundColor: theme.colors.surface,
        }}
      >
        <Text
          style={{
            fontFamily: theme.fonts.body,
            fontSize: 14,
            color: displayValue ? theme.colors.text : theme.colors.textMuted,
          }}
        >
          {displayValue ?? (mode === "date" ? "Pick date" : "Pick time")}
        </Text>
      </TouchableOpacity>

      {pickerVisible && Platform.OS === "android" ? (
        <DateTimePicker
          value={temporaryDate}
          mode={mode}
          display={mode === "date" ? "calendar" : "clock"}
          minimumDate={mode === "date" ? new Date() : undefined}
          is24Hour={false}
          onChange={handleAndroidChange}
        />
      ) : null}

      {Platform.OS === "ios" ? (
        <Modal
          visible={pickerVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setPickerVisible(false)}
        >
          <View
            style={{
              flex: 1,
              justifyContent: "flex-end",
              backgroundColor: "rgba(0,0,0,0.42)",
            }}
          >
            <View
              style={{
                backgroundColor: theme.colors.surface,
                paddingBottom: 24,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingHorizontal: 18,
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.colors.divider,
                }}
              >
                <TouchableOpacity onPress={() => setPickerVisible(false)}>
                  <Text
                    style={{
                      fontFamily: theme.fonts.bodySemi,
                      fontSize: 16,
                      color: theme.colors.textSecondary,
                    }}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    onChange(
                      mode === "date"
                        ? dateValue(temporaryDate)
                        : timeValue(temporaryDate),
                    );
                    setPickerVisible(false);
                  }}
                >
                  <Text
                    style={{
                      fontFamily: theme.fonts.bodyBold,
                      fontSize: 16,
                      color: theme.colors.primary,
                    }}
                  >
                    Done
                  </Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={temporaryDate}
                mode={mode}
                display={mode === "date" ? "inline" : "spinner"}
                minimumDate={mode === "date" ? new Date() : undefined}
                onChange={(_, selected) => {
                  if (selected) setTemporaryDate(selected);
                }}
              />
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}
