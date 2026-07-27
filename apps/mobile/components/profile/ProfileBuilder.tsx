import type { ReactNode } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import Feather from "@expo/vector-icons/Feather";
import { Card } from "@/components/ui/Card";
import { theme } from "@/config/theme";

type FeatherName = React.ComponentProps<typeof Feather>["name"];

export function ProfileCompletionCard({
  eyebrow,
  title,
  completed,
  total,
  missing,
}: {
  eyebrow: string;
  title: string;
  completed: number;
  total: number;
  missing: string[];
}) {
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <Card
      style={{
        backgroundColor: theme.colors.text,
        borderColor: theme.colors.text,
        marginBottom: 16,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          gap: 18,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: theme.fonts.mono,
              fontSize: 10,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              color: theme.colors.gold,
            }}
          >
            {eyebrow}
          </Text>
          <Text
            style={{
              fontFamily: theme.fonts.display,
              fontSize: 22,
              lineHeight: 27,
              letterSpacing: -0.4,
              color: "#FCF7EA",
              marginTop: 7,
            }}
          >
            {title}
          </Text>
        </View>
        <Text
          accessibilityLabel={`${percent} percent complete`}
          style={{
            fontFamily: theme.fonts.monoMed,
            fontSize: 22,
            color: "#FCF7EA",
          }}
        >
          {percent}%
        </Text>
      </View>

      <View
        style={{
          height: 6,
          borderRadius: 3,
          backgroundColor: "rgba(252,247,234,0.18)",
          overflow: "hidden",
          marginTop: 16,
        }}
      >
        <View
          style={{
            width: `${percent}%`,
            height: "100%",
            borderRadius: 3,
            backgroundColor: theme.colors.primary,
          }}
        />
      </View>

      <Text
        style={{
          fontFamily: theme.fonts.body,
          fontSize: 12.5,
          lineHeight: 18,
          color: "rgba(252,247,234,0.72)",
          marginTop: 10,
        }}
      >
        {missing.length > 0
          ? `Still to add: ${missing.join(", ")}.`
          : "Everything important is in place. Review it before publishing."}
      </Text>
    </Card>
  );
}

export function ProfileSection({
  number,
  icon,
  title,
  description,
  complete,
  children,
}: {
  number: number;
  icon: FeatherName;
  title: string;
  description: string;
  complete: boolean;
  children: ReactNode;
}) {
  return (
    <Card style={{ gap: 16, marginTop: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: complete
              ? "rgba(47,125,87,0.12)"
              : theme.colors.primaryLight,
          }}
        >
          <Feather
            name={complete ? "check" : icon}
            size={17}
            color={complete ? theme.colors.success : theme.colors.primary}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: theme.fonts.mono,
              fontSize: 9.5,
              letterSpacing: 1,
              textTransform: "uppercase",
              color: theme.colors.textMuted,
            }}
          >
            Section {number}
          </Text>
          <Text
            style={{
              fontFamily: theme.fonts.display,
              fontSize: 19,
              color: theme.colors.text,
              letterSpacing: -0.3,
              marginTop: 2,
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              fontFamily: theme.fonts.body,
              fontSize: 12.5,
              lineHeight: 18,
              color: theme.colors.textSecondary,
              marginTop: 4,
            }}
          >
            {description}
          </Text>
        </View>
      </View>
      {children}
    </Card>
  );
}

export function PhotoSlot({
  imageUrl,
  title,
  usage,
  buttonLabel,
  aspectRatio = 4 / 3,
  circular = false,
  busy = false,
  onPick,
  onRemove,
}: {
  imageUrl: string | null;
  title: string;
  usage: string;
  buttonLabel: string;
  aspectRatio?: number;
  circular?: boolean;
  busy?: boolean;
  onPick: () => void;
  onRemove?: () => void;
}) {
  const frameStyle = circular
    ? { width: 112, height: 112, borderRadius: 56 }
    : { width: "100%" as const, aspectRatio, borderRadius: 14 };

  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: theme.fonts.bodyBold,
              fontSize: 14,
              color: theme.colors.text,
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              fontFamily: theme.fonts.body,
              fontSize: 12,
              lineHeight: 17,
              color: theme.colors.textSecondary,
              marginTop: 3,
            }}
          >
            {usage}
          </Text>
        </View>
        {imageUrl && onRemove ? (
          <TouchableOpacity
            onPress={onRemove}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${title}`}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <Feather name="trash-2" size={17} color={theme.colors.error} />
          </TouchableOpacity>
        ) : null}
      </View>

      <TouchableOpacity
        onPress={onPick}
        disabled={busy}
        activeOpacity={0.86}
        accessibilityRole="button"
        accessibilityLabel={`${buttonLabel}. ${usage}`}
        style={{
          ...frameStyle,
          alignSelf: circular ? "center" : "stretch",
          marginTop: 12,
          overflow: "hidden",
          borderWidth: 1.5,
          borderStyle: imageUrl ? "solid" : "dashed",
          borderColor: imageUrl ? theme.colors.divider : theme.colors.primary,
          backgroundColor: theme.colors.primaryLight,
          opacity: busy ? 0.65 : 1,
        }}
      >
        {imageUrl ? (
          <>
            <Image
              source={{ uri: imageUrl }}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
              transition={200}
            />
            <View
              style={{
                position: "absolute",
                right: 10,
                bottom: 10,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 10,
                paddingVertical: 7,
                borderRadius: 999,
                backgroundColor: "rgba(14,25,41,0.82)",
              }}
            >
              <Feather name="edit-2" size={12} color="#FCF7EA" />
              <Text
                style={{
                  fontFamily: theme.fonts.monoMed,
                  fontSize: 9,
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                  color: "#FCF7EA",
                }}
              >
                Replace
              </Text>
            </View>
          </>
        ) : (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
            }}
          >
            <Feather
              name={busy ? "loader" : "camera"}
              size={22}
              color={theme.colors.primary}
            />
            <Text
              style={{
                fontFamily: theme.fonts.monoMed,
                fontSize: 10,
                letterSpacing: 0.5,
                textTransform: "uppercase",
                color: theme.colors.primary,
              }}
            >
              {busy ? "Uploading…" : buttonLabel}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

export function PrivacyNote({
  icon = "lock",
  children,
}: {
  icon?: FeatherName;
  children: ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 9,
        padding: 12,
        borderRadius: 12,
        backgroundColor: theme.colors.accentLight,
      }}
    >
      <Feather
        name={icon}
        size={15}
        color={theme.colors.accent}
        style={{ marginTop: 1 }}
      />
      <Text
        style={{
          flex: 1,
          fontFamily: theme.fonts.body,
          fontSize: 12,
          lineHeight: 17,
          color: theme.colors.textSecondary,
        }}
      >
        {children}
      </Text>
    </View>
  );
}
