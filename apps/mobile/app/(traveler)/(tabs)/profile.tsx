import { useCallback, useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Image } from "expo-image";
import Feather from "@expo/vector-icons/Feather";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AccountActions } from "@/components/settings/AccountActions";
import { ProfileLoadError } from "@/components/profile/ProfileLoadError";
import { Card } from "@/components/ui/Card";
import { Header } from "@/components/ui/Header";
import { Loading } from "@/components/ui/Loading";
import { INTEREST_OPTIONS } from "@/config/profileOptions";
import { theme } from "@/config/theme";
import { fetchMyTravelerProfile } from "@/lib/api/travelerProfile";
import { signOut } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

type TravelerSummary = {
  name: string;
  avatarUrl: string | null;
  nationality: string | null;
  language: string | null;
  interests: string[];
  airportCode: string | null;
  arrivalAt: string | null;
  departureAt: string | null;
};

type FeatherName = React.ComponentProps<typeof Feather>["name"];

export default function TravelerProfileHubScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [profile, setProfile] = useState<TravelerSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Please sign in again to view your profile.");
      const [travelerProfile, userResult] = await Promise.all([
        fetchMyTravelerProfile(),
        supabase
          .from("users")
          .select("full_name, avatar_url")
          .eq("id", user.id)
          .maybeSingle(),
      ]);
      if (userResult.error) throw userResult.error;

      setProfile({
        name:
          userResult.data?.full_name ??
          (user.user_metadata?.full_name as string | undefined) ??
          "Traveler",
        avatarUrl: userResult.data?.avatar_url ?? null,
        nationality: travelerProfile?.nationality ?? null,
        language: travelerProfile?.preferred_language ?? null,
        interests: travelerProfile?.interests ?? [],
        airportCode: travelerProfile?.airport_code ?? null,
        arrivalAt: travelerProfile?.arrival_at ?? null,
        departureAt: travelerProfile?.departure_at ?? null,
      });
    } catch (error: unknown) {
      setProfile(null);
      setLoadError(
        error instanceof Error
          ? error.message
          : "We could not load your profile. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile]),
  );

  async function handleSignOut() {
    const shouldSignOut = await new Promise<boolean>((resolve) => {
      Alert.alert(
        "Sign out?",
        "You can always sign back in.",
        [
          { text: "Stay", style: "cancel", onPress: () => resolve(false) },
          {
            text: "Sign out",
            style: "destructive",
            onPress: () => resolve(true),
          },
        ],
        { onDismiss: () => resolve(false) },
      );
    });
    if (shouldSignOut) await signOut();
  }

  if (loading) return <Loading fullScreen />;

  if (loadError) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.background,
          paddingTop: insets.top,
        }}
      >
        <Header title="Profile" />
        <ScrollView
          contentContainerStyle={{
            padding: 20,
            paddingBottom: insets.bottom + 40,
          }}
        >
          <ProfileLoadError
            message={loadError}
            onRetry={() => void loadProfile()}
          />
        </ScrollView>
      </View>
    );
  }

  const initials = (profile?.name ?? "Traveler")
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const layover =
    profile?.arrivalAt && profile.departureAt
      ? `${compactDate(profile.arrivalAt)} – ${compactDate(profile.departureAt)}`
      : "No active layover";
  const visibleInterests = (profile?.interests ?? [])
    .slice(0, 3)
    .map((interest) => {
      const option = INTEREST_OPTIONS.find(
        (candidate) => candidate.key === interest,
      );
      return option
        ? `${option.emoji} ${option.label}`
        : interest
            .replace(/_/g, " ")
            .replace(/\b\w/g, (letter) => letter.toUpperCase());
    });

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.background,
        paddingTop: insets.top,
      }}
    >
      <Header title="Profile" />
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingBottom: insets.bottom + 40,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Card framed style={{ alignItems: "center", paddingVertical: 24 }}>
          <View
            style={{
              width: 92,
              height: 92,
              borderRadius: 46,
              overflow: "hidden",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: theme.colors.primaryLight,
              borderWidth: 3,
              borderColor: theme.colors.surface,
              ...theme.shadows.sm,
            }}
          >
            {profile?.avatarUrl ? (
              <Image
                source={{ uri: profile.avatarUrl }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
                transition={160}
              />
            ) : (
              <Text
                style={{
                  fontFamily: theme.fonts.displaySemi,
                  fontSize: 27,
                  color: theme.colors.primaryDark,
                }}
              >
                {initials}
              </Text>
            )}
          </View>
          <Text
            style={{
              fontFamily: theme.fonts.display,
              fontSize: 27,
              color: theme.colors.text,
              marginTop: 13,
            }}
          >
            {profile?.name ?? "Traveler"}
          </Text>
          <Text
            style={{
              fontFamily: theme.fonts.body,
              fontSize: 13,
              color: theme.colors.textSecondary,
              marginTop: 3,
            }}
          >
            {[profile?.nationality, profile?.language]
              .filter(Boolean)
              .join(" · ") || "Complete your traveler brief"}
          </Text>

          {visibleInterests.length ? (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: 7,
                marginTop: 15,
              }}
            >
              {visibleInterests.map((interest) => (
                <View
                  key={interest}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 999,
                    backgroundColor: theme.colors.surfaceMuted,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: theme.fonts.bodySemi,
                      fontSize: 11,
                      color: theme.colors.textSecondary,
                    }}
                  >
                    {interest}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </Card>

        <Text style={sectionLabelStyle}>Current layover</Text>
        <Card
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 13,
          }}
        >
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 13,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: theme.colors.text,
            }}
          >
            <Feather name="clock" size={19} color={theme.colors.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: theme.fonts.monoMed,
                fontSize: 11,
                letterSpacing: 0.8,
                color: theme.colors.primary,
              }}
            >
              {profile?.airportCode ?? "Airport not set"}
            </Text>
            <Text
              style={{
                fontFamily: theme.fonts.bodyBold,
                fontSize: 14,
                color: theme.colors.text,
                marginTop: 3,
              }}
            >
              {layover}
            </Text>
          </View>
        </Card>

        <Text style={sectionLabelStyle}>Your profile</Text>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <ProfileRow
            icon="edit-3"
            label="Edit traveler profile"
            detail="Layover, interests, comfort and safety"
            onPress={() => router.push("/(traveler)/profile/edit" as never)}
          />
          <Divider />
          <ProfileRow
            icon="bookmark"
            label="Saved guides"
            detail="People you want to meet"
            onPress={() => router.push("/(traveler)/(tabs)/saved")}
          />
          <Divider />
          <ProfileRow
            icon="briefcase"
            label="My trips"
            detail="Upcoming and past Detours"
            onPress={() => router.push("/(traveler)/(tabs)/trips")}
          />
          <Divider />
          <ProfileRow
            icon="message-circle"
            label="Chats"
            detail="Conversations with your Buddies"
            onPress={() => router.push("/(traveler)/(tabs)/messages")}
          />
        </Card>

        <TouchableOpacity
          onPress={() => void handleSignOut()}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          accessibilityHint="Signs you out of the Detour app"
          style={{ alignItems: "center", paddingVertical: 15, marginTop: 20 }}
        >
          <Text
            style={{
              fontFamily: theme.fonts.bodyBold,
              fontSize: 14,
              color: theme.colors.error,
            }}
          >
            Sign out
          </Text>
        </TouchableOpacity>
        <AccountActions />
      </ScrollView>
    </View>
  );
}

function compactDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Date not set";
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function ProfileRow({
  icon,
  label,
  detail,
  onPress,
}: {
  icon: FeatherName;
  label: string;
  detail: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.72}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={detail}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 13,
        padding: 16,
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.colors.primaryLight,
        }}
      >
        <Feather name={icon} size={18} color={theme.colors.primaryDark} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: theme.fonts.bodyBold,
            fontSize: 14.5,
            color: theme.colors.text,
          }}
        >
          {label}
        </Text>
        <Text
          style={{
            fontFamily: theme.fonts.body,
            fontSize: 11.5,
            color: theme.colors.textSecondary,
            marginTop: 2,
          }}
        >
          {detail}
        </Text>
      </View>
      <Feather name="chevron-right" size={18} color={theme.colors.textMuted} />
    </TouchableOpacity>
  );
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: theme.colors.divider }} />;
}

const sectionLabelStyle = {
  fontFamily: theme.fonts.mono,
  fontSize: 10,
  letterSpacing: 1,
  textTransform: "uppercase" as const,
  color: theme.colors.textSecondary,
  marginTop: 24,
  marginBottom: 8,
  marginLeft: 4,
};
