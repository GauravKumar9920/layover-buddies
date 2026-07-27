import type { StyleProp, ViewStyle } from "react-native";
import { Text, View } from "react-native";
import { DIETARY_OPTIONS, TRAVEL_PACE_OPTIONS } from "@/config/profileOptions";
import { theme } from "@/config/theme";
import type { TravelerProfile } from "@/types";

interface TravelerBuddyBriefProps {
  traveler?: TravelerProfile;
  showHeading?: boolean;
  style?: StyleProp<ViewStyle>;
}

function fallbackLabel(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function Chip({ label }: { label: string }) {
  return (
    <View
      style={{
        backgroundColor: theme.colors.surfaceMuted,
        borderWidth: 1,
        borderColor: theme.colors.divider,
        borderRadius: theme.borderRadius.full,
        paddingHorizontal: 9,
        paddingVertical: 4,
      }}
    >
      <Text
        style={{
          fontFamily: theme.fonts.mono,
          fontSize: 9.5,
          color: theme.colors.textSecondary,
          letterSpacing: 0.3,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export function TravelerBuddyBrief({
  traveler,
  showHeading = true,
  style,
}: TravelerBuddyBriefProps) {
  if (!traveler) return null;

  const pace = TRAVEL_PACE_OPTIONS.find(
    (option) => option.key === traveler.travel_pace,
  );
  const dietary = (traveler.dietary_preferences ?? []).map(
    (key) =>
      DIETARY_OPTIONS.find((option) => option.key === key)?.label ??
      fallbackLabel(key),
  );
  const interests = traveler.interests ?? [];
  const hasBrief = Boolean(
    traveler.about_me?.trim() ||
    pace ||
    dietary.length ||
    interests.length ||
    traveler.accessibility_notes?.trim(),
  );

  if (!hasBrief) return null;

  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.surfaceMuted,
          borderRadius: theme.borderRadius.md,
          borderWidth: 1,
          borderColor: theme.colors.divider,
          padding: 14,
          gap: 11,
        },
        style,
      ]}
    >
      {showHeading ? (
        <Text
          style={{
            fontFamily: theme.fonts.mono,
            fontSize: 10.5,
            color: theme.colors.textSecondary,
            textTransform: "uppercase",
            letterSpacing: 1.1,
          }}
        >
          Traveler brief
        </Text>
      ) : null}

      {traveler.about_me?.trim() ? (
        <Text
          style={{
            fontFamily: theme.fonts.body,
            fontSize: 13.5,
            color: theme.colors.text,
            lineHeight: 20,
          }}
        >
          {traveler.about_me.trim()}
        </Text>
      ) : null}

      {pace || dietary.length || interests.length ? (
        <View style={{ gap: 7 }}>
          {pace ? (
            <Text
              style={{
                fontFamily: theme.fonts.bodySemi,
                fontSize: 12.5,
                color: theme.colors.text,
              }}
            >
              Pace · {pace.label}
            </Text>
          ) : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {dietary.map((label) => (
              <Chip key={`diet-${label}`} label={label} />
            ))}
            {interests.map((interest) => (
              <Chip
                key={`interest-${interest}`}
                label={fallbackLabel(interest)}
              />
            ))}
          </View>
        </View>
      ) : null}

      {traveler.accessibility_notes?.trim() ? (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: theme.colors.divider,
            paddingTop: 10,
          }}
        >
          <Text
            style={{
              fontFamily: theme.fonts.monoMed,
              fontSize: 10,
              color: theme.colors.primaryDark,
              textTransform: "uppercase",
              letterSpacing: 0.7,
              marginBottom: 4,
            }}
          >
            Access needs
          </Text>
          <Text
            style={{
              fontFamily: theme.fonts.body,
              fontSize: 13,
              color: theme.colors.text,
              lineHeight: 19,
            }}
          >
            {traveler.accessibility_notes.trim()}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
