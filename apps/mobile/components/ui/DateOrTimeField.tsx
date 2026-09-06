/**
 * Labelled date / time picker.
 *
 * Extracted verbatim from LayoverEditorModal, where it was the only usable
 * date entry in the app while the guide's agreement draft still asked people
 * to hand-type `2026-05-04T09:00:00.000Z` into a text box. Web gets the native
 * <input>, Android the OS dialog, iOS a spinner in a confirm sheet.
 *
 * Values are plain strings — `YYYY-MM-DD` for dates, `HH:mm` for times — which
 * is exactly what lib/time/ist.ts converts to and from.
 */

import React, { useEffect, useRef, useState } from "react";
import {
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
import { theme } from "@/config/theme";
import { hapticImpactMedium } from "@/lib/haptics";

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

function dateValue(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function timeValue(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}


const HOURS_12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTE_STEPS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
const COLUMN_HEIGHT = 208;
const OPTION_HEIGHT = 40;

/** "14:35" → { hour12: 2, minute: 35, meridiem: "PM" }; null when unparseable. */
function parseHhMm(
  value: string,
): { hour12: number; minute: number; meridiem: "AM" | "PM" } | null {
  if (!/^\d{1,2}:\d{2}$/.test(value)) return null;
  const [hours24, minute] = value.split(":").map(Number);
  if (hours24 > 23 || minute > 59) return null;
  return {
    hour12: hours24 % 12 === 0 ? 12 : hours24 % 12,
    minute,
    meridiem: hours24 < 12 ? "AM" : "PM",
  };
}

function toHhMm(hour12: number, minute: number, meridiem: "AM" | "PM"): string {
  const hours24 =
    meridiem === "AM" ? (hour12 === 12 ? 0 : hour12) : hour12 === 12 ? 12 : hour12 + 12;
  return `${pad2(hours24)}:${pad2(minute)}`;
}

function TimeOption({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        height: OPTION_HEIGHT,
        justifyContent: "center",
        alignItems: "center",
        borderRadius: 8,
        backgroundColor: selected ? theme.colors.primary : "transparent",
      }}
    >
      <Text
        style={{
          fontFamily: selected ? theme.fonts.monoMed : theme.fonts.mono,
          fontSize: 16,
          color: selected ? "#FCF7EA" : theme.colors.textSecondary,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/**
 * The web replacement for <input type="time">.
 *
 * Three tap-to-pick columns rather than a free-text field: on a phone-width
 * browser there is no keyboard shortcut to a time, and the browser's own clock
 * affordance is a 16px icon that does nothing when tapped. Minutes step by 5 —
 * enough precision for a flight window, few enough rows to scan.
 */
function WebTimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const parsed = parseHhMm(value);
  const [hour12, setHour12] = useState(parsed?.hour12 ?? 9);
  const [minute, setMinute] = useState(parsed?.minute ?? 0);
  const [meridiem, setMeridiem] = useState<"AM" | "PM">(
    parsed?.meridiem ?? "AM",
  );
  const hourScroll = useRef<ScrollView>(null);
  const minuteScroll = useRef<ScrollView>(null);

  // Re-seed from the prop whenever the sheet opens, so reopening after an
  // external change (a prefill, a reset) doesn't show a stale selection.
  useEffect(() => {
    if (!open) return;
    const current = parseHhMm(value);
    if (current) {
      setHour12(current.hour12);
      setMinute(current.minute);
      setMeridiem(current.meridiem);
    }
    const hourIndex = HOURS_12.indexOf(current?.hour12 ?? 9);
    const minuteIndex = MINUTE_STEPS.findIndex(
      (step) => step >= (current?.minute ?? 0),
    );
    // Land the current value in view rather than at the top of a long column.
    requestAnimationFrame(() => {
      hourScroll.current?.scrollTo({
        y: Math.max(0, (hourIndex - 2) * OPTION_HEIGHT),
        animated: false,
      });
      minuteScroll.current?.scrollTo({
        y: Math.max(0, (minuteIndex - 2) * OPTION_HEIGHT),
        animated: false,
      });
    });
  }, [open, value]);

  const display = parsed
    ? `${parsed.hour12}:${pad2(parsed.minute)} ${parsed.meridiem}`
    : null;

  return (
    <View>
      <Text style={fieldLabelStyle}>{label}</Text>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`${label}. ${display ?? "Not set"}`}
        activeOpacity={0.75}
        onPress={() => setOpen(true)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          minHeight: 50,
          paddingHorizontal: 14,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: theme.colors.divider,
          backgroundColor: theme.colors.surface,
        }}
      >
        <Feather name="clock" size={16} color={theme.colors.textSecondary} />
        <Text
          style={{
            flex: 1,
            fontFamily: theme.fonts.body,
            fontSize: 15,
            color: display ? theme.colors.text : theme.colors.textMuted,
          }}
        >
          {display ?? "Pick time"}
        </Text>
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Close time picker"
          activeOpacity={1}
          onPress={() => setOpen(false)}
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            backgroundColor: "rgba(0,0,0,0.42)",
          }}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => {}}
            style={{
              width: "100%",
              maxWidth: 340,
              borderRadius: theme.borderRadius.lg,
              backgroundColor: theme.colors.surface,
              paddingHorizontal: 16,
              paddingTop: 16,
              paddingBottom: 12,
            }}
          >
            <Text
              style={{
                ...theme.typography.eyebrow,
                color: theme.colors.textSecondary,
                marginBottom: 12,
              }}
            >
              {label}
            </Text>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <ScrollView
                ref={hourScroll}
                style={{ flex: 1, height: COLUMN_HEIGHT }}
                showsVerticalScrollIndicator={false}
              >
                {HOURS_12.map((hour) => (
                  <TimeOption
                    key={hour}
                    label={String(hour)}
                    selected={hour === hour12}
                    onPress={() => {
                      hapticImpactMedium();
                      setHour12(hour);
                    }}
                  />
                ))}
              </ScrollView>
              <ScrollView
                ref={minuteScroll}
                style={{ flex: 1, height: COLUMN_HEIGHT }}
                showsVerticalScrollIndicator={false}
              >
                {MINUTE_STEPS.map((step) => (
                  <TimeOption
                    key={step}
                    label={pad2(step)}
                    selected={step === minute}
                    onPress={() => {
                      hapticImpactMedium();
                      setMinute(step);
                    }}
                  />
                ))}
              </ScrollView>
              <View style={{ flex: 1, gap: 8 }}>
                {(["AM", "PM"] as const).map((option) => (
                  <TimeOption
                    key={option}
                    label={option}
                    selected={option === meridiem}
                    onPress={() => {
                      hapticImpactMedium();
                      setMeridiem(option);
                    }}
                  />
                ))}
              </View>
            </View>

            <View
              style={{
                flexDirection: "row",
                justifyContent: "flex-end",
                alignItems: "center",
                gap: 20,
                marginTop: 12,
                paddingTop: 12,
                borderTopWidth: 1,
                borderTopColor: theme.colors.divider,
              }}
            >
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => setOpen(false)}
              >
                <Text
                  style={{
                    fontFamily: theme.fonts.bodySemi,
                    fontSize: 15,
                    color: theme.colors.textSecondary,
                  }}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => {
                  onChange(toHhMm(hour12, minute, meridiem));
                  setOpen(false);
                }}
              >
                <Text
                  style={{
                    fontFamily: theme.fonts.bodyBold,
                    fontSize: 15,
                    color: theme.colors.primary,
                  }}
                >
                  Done
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

export const fieldLabelStyle = {
  ...theme.typography.eyebrow,
  color: theme.colors.textSecondary,
  marginBottom: 7,
};

export function DateOrTimeField({
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

  // Web dates keep the browser's own <input type="date"> — its calendar popup
  // is good and every browser draws it the same way. Times do not: Chrome's
  // <input type="time"> hides its clock behind a small icon that is easy to
  // miss and unreachable on a touch screen, so web gets the explicit picker
  // below instead.
  if (Platform.OS === "web" && mode === "date") {
    return (
      <View>
        <Text style={fieldLabelStyle}>{label}</Text>
        {React.createElement("input", {
          type: "date",
          value,
          min: new Date().toISOString().slice(0, 10),
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

  if (Platform.OS === "web") {
    return <WebTimeField label={label} value={value} onChange={onChange} />;
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