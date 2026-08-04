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
import { theme } from "@/config/theme";
import { signOut } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

type GuideSummary = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  university: string | null;
  status: "setup" | "draft" | "published";
  acceptingInquiries: boolean;
  rating: number;
  reviewCount: number;
};

type FeatherName = React.ComponentProps<typeof Feather>["name"];

export default function GuideProfileHubScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [profile, setProfile] = useState<GuideSummary | null>(null);
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

      const [userResult, guideResult] = await Promise.all([
        supabase
          .from("users")
          .select("full_name, avatar_url")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("guide_profiles")
          .select(
            "id, university, profile_status, is_active, avg_rating, total_reviews",
          )
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
      if (userResult.error) throw userResult.error;
      if (guideResult.error) throw guideResult.error;

      let coverUrl: string | null = null;
      if (guideResult.data?.id) {
        const { data, error } = await supabase
          .from("guide_profile_photos")
          .select("url")
          .eq("guide_profile_id", guideResult.data.id)
          .eq("role", "cover")
          .order("position")
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        coverUrl = data?.url ?? null;
      }

      setProfile({
        userId: user.id,
        name:
          userResult.data?.full_name ??
          (user.user_metadata?.full_name as string | undefined) ??
          "Student guide",
        avatarUrl: userResult.data?.avatar_url ?? null,
        coverUrl,
        university: guideResult.data?.university ?? null,
        status:
          !guideResult.data
            ? "setup"
            : guideResult.data.profile_status === "published"
            ? "published"
            : "draft",
        acceptingInquiries: guideResult.data?.is_active ?? false,
        rating: Number(guideResult.data?.avg_rating ?? 0),
        reviewCount: Number(guideResult.data?.total_reviews ?? 0),
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

  const initials = (profile?.name ?? "Student guide")
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

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
        <Card style={{ padding: 0, overflow: "hidden" }} framed>
          <View
            style={{
              height: 128,
              backgroundColor: theme.colors.surfaceMuted,
            }}
          >
            {profile?.coverUrl ? (
              <Image
                source={{ uri: profile.coverUrl }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
                transition={180}
              />
            ) : (
              <View
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Feather
                  name="image"
                  size={26}
                  color={theme.colors.textMuted}
                />
              </View>
            )}
          </View>

          <View style={{ padding: 18, paddingTop: 0 }}>
            <View
              style={{
                width: 78,
                height: 78,
                borderRadius: 39,
                marginTop: -39,
                borderWidth: 4,
                borderColor: theme.colors.surface,
                overflow: "hidden",
                backgroundColor: theme.colors.primaryLight,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {profile?.avatarUrl ? (
                <Image
                  source={{ uri: profile.avatarUrl }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                />
              ) : (
                <Text
                  style={{
                    fontFamily: theme.fonts.displaySemi,
                    fontSize: 22,
                    color: theme.colors.primaryDark,
                  }}
                >
                  {initials}
                </Text>
              )}
            </View>

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                gap: 12,
                marginTop: 12,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: theme.fonts.display,
                    fontSize: 25,
                    color: theme.colors.text,
                  }}
                >
                  {profile?.name ?? "Student guide"}
                </Text>
                <Text
                  style={{
                    fontFamily: theme.fonts.body,
                    fontSize: 13,
                    lineHeight: 18,
                    color: theme.colors.textSecondary,
                    marginTop: 3,
                  }}
                  numberOfLines={2}
                >
                  {profile?.university ?? "Add your university"}
                </Text>
              </View>
              <StatusPill status={profile?.status ?? "setup"} />
            </View>

            <View
              style={{
                flexDirection: "row",
                gap: 18,
                marginTop: 15,
                paddingTop: 14,
                borderTopWidth: 1,
                borderTopColor: theme.colors.divider,
              }}
            >
              <SummaryStat
                label="Visibility"
                value={
                  profile?.status === "published"
                    ? "Live"
                    : profile?.status === "draft"
                      ? "Draft"
                      : "Set up"
                }
              />
              <SummaryStat
                label="Inquiries"
                value={
                  profile?.status === "setup"
                    ? "—"
                    : profile?.acceptingInquiries
                      ? "Open"
                      : "Paused"
                }
              />
              <SummaryStat
                label="Rating"
                value={
                  profile?.status === "setup"
                    ? "—"
                    : profile?.reviewCount
                    ? `${profile.rating.toFixed(1)} (${profile.reviewCount})`
                    : "New"
                }
              />
            </View>
          </View>
        </Card>

        <Text style={sectionLabelStyle}>Your profile</Text>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <ProfileRow
            icon="edit-3"
            label="Edit profile"
            detail="Identity, story, photos and publishing"
            onPress={() => router.push("/(guide)/profile/edit" as never)}
          />
          <Divider />
          <ProfileRow
            icon="eye"
            label="Preview as traveler"
            detail="See exactly what travelers see"
            onPress={() =>
              profile &&
              router.push(`/(traveler)/guide/${profile.userId}` as never)
            }
          />
          <Divider />
          <ProfileRow
            icon="credit-card"
            label="Payout details"
            detail="Where your Detour earnings are sent"
            onPress={() => router.push("/(guide)/profile/payout-vpa" as never)}
          />
        </Card>

        <ButtonLikeSignOut onPress={() => void handleSignOut()} />
        <AccountActions />
      </ScrollView>
    </View>
  );
}

function StatusPill({ status }: { status: GuideSummary["status"] }) {
  const published = status === "published";
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: published ? "#DCFCE7" : theme.colors.surfaceMuted,
      }}
    >
      <View
        style={{
          width: 7,
          height: 7,
          borderRadius: 4,
          backgroundColor: published
            ? theme.colors.success
            : theme.colors.textMuted,
        }}
      />
      <Text
        style={{
          fontFamily: theme.fonts.monoMed,
          fontSize: 9,
          letterSpacing: 0.6,
          textTransform: "uppercase",
          color: theme.colors.text,
        }}
      >
        {published ? "Published" : status === "draft" ? "Draft" : "Set up"}
      </Text>
    </View>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text
        style={{
          fontFamily: theme.fonts.mono,
          fontSize: 8.5,
          letterSpacing: 0.7,
          textTransform: "uppercase",
          color: theme.colors.textMuted,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: theme.fonts.bodyBold,
          fontSize: 12.5,
          color: theme.colors.text,
          marginTop: 4,
        }}
      >
        {value}
      </Text>
    </View>
  );
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

function ButtonLikeSignOut({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Sign out"
      accessibilityHint="Signs you out of the Detour app"
      style={{
        alignItems: "center",
        paddingVertical: 15,
        marginTop: 20,
      }}
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
  );
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
