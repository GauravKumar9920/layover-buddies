import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import Feather from "@expo/vector-icons/Feather";
import { format } from "date-fns";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Header } from "@/components/ui/Header";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Loading } from "@/components/ui/Loading";
import { AccountActions } from "@/components/settings/AccountActions";
import {
  PhotoSlot,
  PrivacyNote,
  ProfileCompletionCard,
  ProfileSection,
} from "@/components/profile/ProfileBuilder";
import { LayoverEditorModal } from "@/components/profile/LayoverEditorModal";
import {
  DIETARY_OPTIONS,
  GENDER_OPTIONS,
  INTEREST_OPTIONS,
  NATIONALITY_OPTIONS,
  TRAVEL_PACE_OPTIONS,
} from "@/config/profileOptions";
import { theme } from "@/config/theme";
import { pickImage } from "@/lib/imagePicker";
import { uploadImage } from "@/lib/imageUpload";
import { supabase } from "@/lib/supabase";
import { signOut } from "@/lib/auth";
import {
  createMyNextLayover,
  fetchMyTravelerProfile,
  updateMyTravelerProfile,
  type NextLayoverPayload,
  type TravelerProfile,
} from "@/lib/api/travelerProfile";
import { useAuth } from "@/lib/hooks/useAuth";

type Pace = TravelerProfile["travel_pace"];
type FeatherName = React.ComponentProps<typeof Feather>["name"];

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * Layovers are stored as UTC instants that represent an IST wall clock.
 * Render in Mumbai time so a traveler abroad sees exactly what they entered.
 */
function formatLayoverDate(iso?: string | null): string {
  if (!iso) return "Not set";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "Not set";
  const ist = new Date(parsed.getTime() + (5 * 60 + 30) * 60_000);
  const hour = ist.getUTCHours();
  const minute = String(ist.getUTCMinutes()).padStart(2, "0");
  const hour12 = hour % 12 || 12;
  const period = hour >= 12 ? "PM" : "AM";
  return `${ist.getUTCDate()} ${MONTHS[ist.getUTCMonth()]} · ${hour12}:${minute} ${period}`;
}

function toggleValue(values: string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function avatarFormat(mimeType: string) {
  const mime = mimeType.toLowerCase().split(";")[0].trim();
  if (mime === "image/jpeg" || mime === "image/jpg") {
    return { extension: "jpg", contentType: "image/jpeg" };
  }
  if (mime === "image/png") {
    return { extension: "png", contentType: "image/png" };
  }
  if (mime === "image/webp") {
    return { extension: "webp", contentType: "image/webp" };
  }
  return null;
}

export default function TravelerProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [profile, setProfile] = useState<TravelerProfile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [layoverEditorVisible, setLayoverEditorVisible] = useState(false);

  // Identity
  const [name, setName] = useState("");
  const [nationality, setNationality] = useState("");
  const [language, setLanguage] = useState("");
  const [aboutMe, setAboutMe] = useState("");

  // Current layover
  const [flightIn, setFlightIn] = useState("");
  const [flightOut, setFlightOut] = useState("");
  const [groupSize, setGroupSize] = useState(1);

  // Preferences
  const [interests, setInterests] = useState<string[]>([]);
  const [travelPace, setTravelPace] = useState<Pace>(null);
  const [dietaryPreferences, setDietaryPreferences] = useState<string[]>([]);
  const [accessibilityNotes, setAccessibilityNotes] = useState("");

  // Private safety
  const [gender, setGender] = useState<string | null>(null);
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");

  useEffect(() => {
    void loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    try {
      const [travelerProfile, authUser] = await Promise.all([
        fetchMyTravelerProfile(),
        supabase.auth.getUser().then((result) => result.data.user),
      ]);

      let fullName =
        (authUser?.user_metadata?.full_name as string | undefined) ?? "";
      let avatar =
        (authUser?.user_metadata?.avatar_url as string | undefined) ?? null;
      if (authUser) {
        const { data: userRow, error } = await supabase
          .from("users")
          .select("full_name, avatar_url")
          .eq("id", authUser.id)
          .maybeSingle();
        if (error) throw error;
        fullName = userRow?.full_name ?? fullName;
        avatar = userRow?.avatar_url ?? avatar;
      }

      setProfile(travelerProfile);
      setAvatarUrl(avatar);
      setName(fullName);
      setNationality(travelerProfile?.nationality ?? "");
      setLanguage(travelerProfile?.preferred_language ?? "");
      setAboutMe(travelerProfile?.about_me ?? "");
      setFlightIn(travelerProfile?.flight_in ?? "");
      setFlightOut(travelerProfile?.flight_out ?? "");
      setGroupSize(Math.max(1, Math.min(3, travelerProfile?.group_size ?? 1)));
      setInterests(travelerProfile?.interests ?? []);
      setTravelPace(travelerProfile?.travel_pace ?? null);
      setDietaryPreferences(travelerProfile?.dietary_preferences ?? []);
      setAccessibilityNotes(travelerProfile?.accessibility_notes ?? "");
      setGender(travelerProfile?.gender ?? null);
      setEmergencyName(travelerProfile?.emergency_contact_name ?? "");
      setEmergencyPhone(travelerProfile?.emergency_contact_phone ?? "");
    } catch (error: unknown) {
      Alert.alert(
        "Unable to load profile",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  const hasActiveLayover = Boolean(
    profile?.active_layover_id && profile.arrival_at && profile.departure_at,
  );
  const layoverComplete = hasActiveLayover && groupSize >= 1 && groupSize <= 3;
  const identityComplete = Boolean(
    avatarUrl &&
    name.trim() &&
    nationality &&
    language.trim() &&
    aboutMe.trim(),
  );
  const preferencesComplete = interests.length > 0 && travelPace !== null;
  const hasEmergencyName = emergencyName.trim().length > 0;
  const hasEmergencyPhone = emergencyPhone.trim().length > 0;
  const safetyComplete =
    (!hasEmergencyName && !hasEmergencyPhone) ||
    (hasEmergencyName && hasEmergencyPhone);

  const completion = useMemo(() => {
    const sections = [
      { complete: layoverComplete, label: "current layover" },
      { complete: identityComplete, label: "identity" },
      { complete: preferencesComplete, label: "preferences" },
    ];
    return {
      completed: sections.filter((section) => section.complete).length,
      missing: sections
        .filter((section) => !section.complete)
        .map((section) => section.label),
    };
  }, [identityComplete, layoverComplete, preferencesComplete]);

  const interestLabels = interests
    .map((key) => INTEREST_OPTIONS.find((option) => option.key === key))
    .filter((option): option is (typeof INTEREST_OPTIONS)[number] =>
      Boolean(option),
    );
  const selectedPace = TRAVEL_PACE_OPTIONS.find(
    (option) => option.key === travelPace,
  );
  const selectedDietary = dietaryPreferences
    .map((key) => DIETARY_OPTIONS.find((option) => option.key === key))
    .filter((option): option is (typeof DIETARY_OPTIONS)[number] =>
      Boolean(option),
    );

  async function handlePickAvatar() {
    if (uploadingAvatar) return;
    const picked = await pickImage({
      aspect: [1, 1],
      quality: 0.75,
      allowsEditing: true,
    });
    if (!picked) return;
    const format = avatarFormat(picked.mimeType);
    if (!format) {
      if (Platform.OS === "web" && picked.uri.startsWith("blob:")) {
        URL.revokeObjectURL(picked.uri);
      }
      Alert.alert(
        "Unsupported image",
        "Choose a JPEG, PNG, or WebP image so your photo displays on every device.",
      );
      return;
    }

    const authUser = (await supabase.auth.getUser()).data.user;
    if (!authUser) {
      if (Platform.OS === "web" && picked.uri.startsWith("blob:")) {
        URL.revokeObjectURL(picked.uri);
      }
      Alert.alert(
        "Session expired",
        "Please sign in again before uploading a photo.",
      );
      return;
    }

    setUploadingAvatar(true);
    try {
      const { publicUrl } = await uploadImage({
        blob: picked.blob,
        bucket: "avatars",
        path: `avatars/${authUser.id}.${format.extension}`,
        contentType: format.contentType,
        blobUri: picked.uri,
      });
      // The object is uploaded now, but its profile meaning is committed with
      // the rest of the builder when the traveler taps Save.
      setAvatarUrl(publicUrl);
    } catch (error: unknown) {
      Alert.alert(
        "Upload failed",
        error instanceof Error ? error.message : "Please choose another image.",
      );
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleSave() {
    const cleanName = name.trim();
    if (!cleanName) {
      Alert.alert(
        "Add your name",
        "Your Buddy needs to know what to call you.",
      );
      return;
    }
    if (groupSize < 1 || groupSize > 3) {
      Alert.alert(
        "Check group size",
        "Detour supports groups of 1 to 3 travelers.",
      );
      return;
    }
    const hasAnyEmergencyDetail = Boolean(
      emergencyName.trim() || emergencyPhone.trim(),
    );
    if (
      hasAnyEmergencyDetail &&
      (!emergencyName.trim() || !emergencyPhone.trim())
    ) {
      Alert.alert(
        "Complete the emergency contact",
        "Add both a contact name and phone number, or leave both blank.",
      );
      return;
    }

    setSaving(true);
    try {
      await updateMyTravelerProfile({
        full_name: cleanName,
        ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
        nationality: nationality || null,
        preferred_language: language.trim() || null,
        about_me: aboutMe.trim() || null,
        interests,
        travel_pace: travelPace,
        dietary_preferences: dietaryPreferences,
        accessibility_notes: accessibilityNotes.trim() || null,
        gender,
        emergency_contact_name: emergencyName.trim() || null,
        emergency_contact_phone: emergencyPhone.trim() || null,
        ...(hasActiveLayover
          ? {
              flight_in: flightIn.trim().toUpperCase() || null,
              flight_out: flightOut.trim().toUpperCase() || null,
              group_size: groupSize,
            }
          : {}),
      });

      const refreshed = await fetchMyTravelerProfile();
      setProfile(refreshed);
      Alert.alert("Profile saved", "Your Detour brief is up to date.");
    } catch (error: unknown) {
      Alert.alert(
        "Unable to save profile",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateNextLayover(payload: NextLayoverPayload) {
    const refreshed = await createMyNextLayover(payload);
    setProfile(refreshed);
    setFlightIn(refreshed.flight_in ?? "");
    setFlightOut(refreshed.flight_out ?? "");
    setGroupSize(Math.max(1, Math.min(3, refreshed.group_size)));
  }

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

  const initials = (name || "Traveler")
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const memberSince = user?.created_at
    ? format(new Date(user.created_at), "MMM yyyy")
    : null;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.background,
        paddingTop: insets.top,
      }}
    >
      <Header title="My Profile" />
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingBottom: insets.bottom + 40,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ marginBottom: 2 }}>
          <Text
            style={{ ...theme.typography.eyebrow, color: theme.colors.primary }}
          >
            Your traveler brief
          </Text>
          <Text
            style={{
              fontFamily: theme.fonts.display,
              fontSize: 28,
              lineHeight: 34,
              letterSpacing: -0.5,
              color: theme.colors.text,
              marginTop: 5,
            }}
          >
            One clear profile, built for your layover.
          </Text>
          <Text
            style={{
              fontFamily: theme.fonts.body,
              fontSize: 13.5,
              lineHeight: 20,
              color: theme.colors.textSecondary,
              marginTop: 7,
              marginBottom: 18,
            }}
          >
            Tell your Buddy who you are, how you like to explore, and what will
            make the day comfortable. Your safety details stay private.
          </Text>
        </View>

        <ProfileCompletionCard
          eyebrow="Profile map"
          title={
            completion.completed === 3
              ? "Ready for your next Detour"
              : "A few details will make matching better"
          }
          completed={completion.completed}
          total={3}
          missing={completion.missing}
        />

        <ProfileSection
          number={1}
          icon="clock"
          title="Current layover"
          description="Trip-specific timing and group details. Past Detours keep their original information."
          complete={layoverComplete}
        >
          {hasActiveLayover ? (
            <>
              <View
                style={{
                  backgroundColor: theme.colors.text,
                  borderRadius: theme.borderRadius.md,
                  padding: 16,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 16,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: theme.fonts.mono,
                      fontSize: 10,
                      letterSpacing: 1.1,
                      textTransform: "uppercase",
                      color: theme.colors.gold,
                    }}
                  >
                    Active layover
                  </Text>
                  <Text
                    style={{
                      fontFamily: theme.fonts.monoMed,
                      fontSize: 14,
                      color: "#FCF7EA",
                    }}
                  >
                    {profile?.airport_code ?? "BOM"}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", gap: 16 }}>
                  <LayoverTime
                    label="Arrive"
                    value={formatLayoverDate(profile?.arrival_at)}
                  />
                  <Feather
                    name="arrow-right"
                    size={16}
                    color="rgba(252,247,234,0.45)"
                    style={{ marginTop: 18 }}
                  />
                  <LayoverTime
                    label="Depart"
                    value={formatLayoverDate(profile?.departure_at)}
                    align="flex-end"
                  />
                </View>
                <Text
                  style={{
                    fontFamily: theme.fonts.mono,
                    fontSize: 9.5,
                    letterSpacing: 0.5,
                    textTransform: "uppercase",
                    color: "rgba(252,247,234,0.52)",
                    marginTop: 14,
                  }}
                >
                  Mumbai time · IST
                </Text>
              </View>

              <View style={{ flexDirection: "row", gap: 12 }}>
                <Input
                  label="Flight in"
                  value={flightIn}
                  onChangeText={(value) => setFlightIn(value.toUpperCase())}
                  placeholder="EK504"
                  autoCapitalize="characters"
                  maxLength={20}
                  style={{ flex: 1 }}
                />
                <Input
                  label="Flight out"
                  value={flightOut}
                  onChangeText={(value) => setFlightOut(value.toUpperCase())}
                  placeholder="AI191"
                  autoCapitalize="characters"
                  maxLength={20}
                  style={{ flex: 1 }}
                />
              </View>

              <View>
                <FieldLabel>Travelers in your group</FieldLabel>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <CounterButton
                    icon="minus"
                    label="Remove one traveler"
                    disabled={groupSize <= 1}
                    onPress={() =>
                      setGroupSize((current) => Math.max(1, current - 1))
                    }
                  />
                  <View
                    accessibilityLabel={`${groupSize} travelers`}
                    style={{
                      minWidth: 72,
                      height: 48,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: theme.borderRadius.md,
                      backgroundColor: theme.colors.surfaceMuted,
                      borderWidth: 1,
                      borderColor: theme.colors.divider,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: theme.fonts.monoMed,
                        fontSize: 21,
                        color: theme.colors.text,
                      }}
                    >
                      {groupSize}
                    </Text>
                  </View>
                  <CounterButton
                    icon="plus"
                    label="Add one traveler"
                    disabled={groupSize >= 3}
                    onPress={() =>
                      setGroupSize((current) => Math.min(3, current + 1))
                    }
                  />
                </View>
              </View>

              <PrivacyNote icon="map-pin">
                Flight numbers and group size update this active layover only.
                Dates stay fixed here so a casual profile edit cannot
                accidentally move an agreed trip.
              </PrivacyNote>

              <Button
                title="Plan another layover"
                variant="secondary"
                onPress={() => setLayoverEditorVisible(true)}
                icon={
                  <Feather
                    name="refresh-cw"
                    size={16}
                    color={theme.colors.text}
                  />
                }
              />
            </>
          ) : (
            <>
              <PrivacyNote icon="calendar">
                No active layover is attached to this account yet. Add your
                arrival and departure window to start matching with a Buddy.
              </PrivacyNote>
              <Button
                title="Add my layover"
                onPress={() => setLayoverEditorVisible(true)}
                icon={<Feather name="plus" size={17} color="#FCF7EA" />}
              />
            </>
          )}
        </ProfileSection>

        <ProfileSection
          number={2}
          icon="user"
          title="Identity"
          description="One real photo and a short introduction—never a random traveler gallery."
          complete={identityComplete}
        >
          <PhotoSlot
            imageUrl={avatarUrl}
            title="Profile photo"
            usage="Your Buddy sees this in requests and chat. It also appears beside reviews you publish."
            buttonLabel={avatarUrl ? "Replace photo" : "Add your photo"}
            circular
            busy={uploadingAvatar}
            onPick={() => void handlePickAvatar()}
          />

          <Input
            label="Full name"
            value={name}
            onChangeText={setName}
            placeholder="What should your Buddy call you?"
            autoCapitalize="words"
            autoComplete="name"
          />

          <View>
            <FieldLabel>Visiting from</FieldLabel>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingRight: 8 }}
            >
              {NATIONALITY_OPTIONS.map((option) => (
                <ChoiceChip
                  key={option.code}
                  label={`${option.flag} ${option.name}`}
                  selected={nationality === option.name}
                  onPress={() => setNationality(option.name)}
                />
              ))}
            </ScrollView>
          </View>

          <Input
            label="Preferred language"
            value={language}
            onChangeText={setLanguage}
            placeholder="e.g. English"
            autoCapitalize="words"
            hint="The language you would most like your Buddy to use."
          />

          <Input
            label="A little about you"
            value={aboutMe}
            onChangeText={setAboutMe}
            placeholder="What would help your Buddy understand you?"
            multiline
            maxLength={500}
            inputStyle={{ minHeight: 88, textAlignVertical: "top" }}
            hint={`${aboutMe.length}/500 · Keep it warm and useful.`}
          />
        </ProfileSection>

        <ProfileSection
          number={3}
          icon="compass"
          title="How you like to explore"
          description="These choices shape guide matching and help your Buddy plan a day that feels like yours."
          complete={preferencesComplete}
        >
          <View>
            <FieldLabel>Interests</FieldLabel>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {INTEREST_OPTIONS.map((option) => (
                <ChoiceChip
                  key={option.key}
                  label={`${option.emoji} ${option.label}`}
                  selected={interests.includes(option.key)}
                  onPress={() =>
                    setInterests((current) => toggleValue(current, option.key))
                  }
                />
              ))}
            </View>
          </View>

          <View>
            <FieldLabel>Your pace</FieldLabel>
            <View style={{ gap: 8 }}>
              {TRAVEL_PACE_OPTIONS.map((option) => {
                const selected = travelPace === option.key;
                return (
                  <TouchableOpacity
                    key={option.key}
                    onPress={() => setTravelPace(selected ? null : option.key)}
                    activeOpacity={0.82}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${option.label}. ${option.description}`}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      padding: 13,
                      borderRadius: theme.borderRadius.md,
                      borderWidth: 1.5,
                      borderColor: selected
                        ? theme.colors.primary
                        : "rgba(14,25,41,0.14)",
                      backgroundColor: selected
                        ? theme.colors.primaryLight
                        : theme.colors.surface,
                    }}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: selected
                          ? theme.colors.primary
                          : theme.colors.surfaceMuted,
                      }}
                    >
                      <Feather
                        name={option.icon as FeatherName}
                        size={16}
                        color={
                          selected ? "#FCF7EA" : theme.colors.textSecondary
                        }
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontFamily: theme.fonts.bodyBold,
                          fontSize: 14,
                          color: theme.colors.text,
                        }}
                      >
                        {option.label}
                      </Text>
                      <Text
                        style={{
                          fontFamily: theme.fonts.body,
                          fontSize: 12,
                          lineHeight: 17,
                          color: theme.colors.textSecondary,
                          marginTop: 2,
                        }}
                      >
                        {option.description}
                      </Text>
                    </View>
                    {selected ? (
                      <Feather
                        name="check-circle"
                        size={18}
                        color={theme.colors.primary}
                      />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View>
            <FieldLabel>Food preferences</FieldLabel>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {DIETARY_OPTIONS.map((option) => (
                <ChoiceChip
                  key={option.key}
                  label={option.label}
                  selected={dietaryPreferences.includes(option.key)}
                  onPress={() =>
                    setDietaryPreferences((current) =>
                      toggleValue(current, option.key),
                    )
                  }
                />
              ))}
            </View>
          </View>

          <Input
            label="Accessibility or comfort notes"
            value={accessibilityNotes}
            onChangeText={setAccessibilityNotes}
            placeholder="Mobility, sensory, stamina, or other needs"
            multiline
            maxLength={500}
            inputStyle={{ minHeight: 76, textAlignVertical: "top" }}
            hint="Optional. Shared with your Buddy while planning your Detour."
          />
        </ProfileSection>

        <ProfileSection
          number={4}
          icon="shield"
          title="Private safety details"
          description="Stored separately from the profile information used for matching."
          complete={safetyComplete}
        >
          <View>
            <FieldLabel>Gender (optional)</FieldLabel>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {GENDER_OPTIONS.map((option) => (
                <ChoiceChip
                  key={option.key}
                  label={option.label}
                  selected={gender === option.key}
                  onPress={() =>
                    setGender(gender === option.key ? null : option.key)
                  }
                />
              ))}
            </View>
          </View>

          <Input
            label="Emergency contact name"
            value={emergencyName}
            onChangeText={setEmergencyName}
            placeholder="Someone we can contact if needed"
            autoCapitalize="words"
            maxLength={255}
          />
          <Input
            label="Emergency contact phone"
            value={emergencyPhone}
            onChangeText={setEmergencyPhone}
            placeholder="+1 415 555 0198"
            keyboardType="phone-pad"
            autoComplete="tel"
            maxLength={20}
          />

          <PrivacyNote>
            Your gender and emergency contact are available to your assigned
            Buddy only when the trip is marked Trip Ready or In Progress. They
            do not appear in matching, chat, reviews, or your traveler brief.
          </PrivacyNote>
        </ProfileSection>

        <Card framed style={{ marginTop: 16, gap: 14 }}>
          <View>
            <Text
              style={{
                ...theme.typography.eyebrow,
                color: theme.colors.primary,
              }}
            >
              What your Buddy sees
            </Text>
            <Text
              style={{
                fontFamily: theme.fonts.display,
                fontSize: 20,
                color: theme.colors.text,
                letterSpacing: -0.3,
                marginTop: 4,
              }}
            >
              Your planning brief
            </Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: 29,
                  borderWidth: 2,
                  borderColor: theme.colors.primary,
                }}
                contentFit="cover"
              />
            ) : (
              <View
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: 29,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: theme.colors.primaryLight,
                  borderWidth: 2,
                  borderColor: theme.colors.primary,
                }}
              >
                <Text
                  style={{
                    fontFamily: theme.fonts.display,
                    fontSize: 19,
                    color: theme.colors.primary,
                  }}
                >
                  {initials}
                </Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: theme.fonts.display,
                  fontSize: 18,
                  color: theme.colors.text,
                }}
              >
                {name.trim() || "Traveler"}
              </Text>
              <Text
                style={{
                  fontFamily: theme.fonts.mono,
                  fontSize: 10.5,
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                  color: theme.colors.textSecondary,
                  marginTop: 3,
                }}
              >
                {[nationality, language.trim()].filter(Boolean).join(" · ") ||
                  "Add your country and language"}
              </Text>
            </View>
          </View>

          {aboutMe.trim() ? (
            <Text
              style={{
                fontFamily: theme.fonts.serif,
                fontSize: 20,
                lineHeight: 26,
                color: theme.colors.text,
              }}
            >
              “{aboutMe.trim()}”
            </Text>
          ) : null}

          {interestLabels.length > 0 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {interestLabels.map((option) => (
                <PreviewTag key={option.key}>
                  {option.emoji} {option.label}
                </PreviewTag>
              ))}
            </View>
          ) : null}

          <View style={{ gap: 7 }}>
            {selectedPace ? (
              <SummaryLine
                icon="compass"
                label="Pace"
                value={selectedPace.label}
              />
            ) : null}
            {selectedDietary.length > 0 ? (
              <SummaryLine
                icon="coffee"
                label="Food"
                value={selectedDietary.map((option) => option.label).join(", ")}
              />
            ) : null}
            {accessibilityNotes.trim() ? (
              <SummaryLine
                icon="heart"
                label="Comfort"
                value={accessibilityNotes.trim()}
              />
            ) : null}
          </View>

          <PrivacyNote icon="eye">
            This brief becomes visible to a Buddy after you open an inquiry.
            Your email, gender, and emergency contact are not part of it.
          </PrivacyNote>
        </Card>

        <Button
          title="Save traveler profile"
          onPress={() => void handleSave()}
          loading={saving}
          disabled={uploadingAvatar}
          size="lg"
          style={{ marginTop: 18 }}
        />

        <Card style={{ marginTop: 16, padding: 0, overflow: "hidden" }}>
          <LinkRow
            icon="bookmark"
            label="Saved guides"
            onPress={() => router.push("/(traveler)/(tabs)/saved")}
          />
          <View style={{ height: 1, backgroundColor: "rgba(14,25,41,0.08)" }} />
          <LinkRow
            icon="briefcase"
            label="My trips"
            onPress={() => router.push("/(traveler)/(tabs)/trips")}
          />
          <View style={{ height: 1, backgroundColor: "rgba(14,25,41,0.08)" }} />
          <LinkRow
            icon="message-circle"
            label="Chats"
            onPress={() => router.push("/(traveler)/(tabs)/messages")}
          />
        </Card>

        <Button
          title="Sign Out"
          onPress={() => void handleSignOut()}
          variant="danger"
          style={{ marginTop: 24 }}
        />

        {memberSince ? (
          <Text
            style={{
              fontFamily: theme.fonts.mono,
              fontSize: 10,
              letterSpacing: 0.7,
              textTransform: "uppercase",
              textAlign: "center",
              color: theme.colors.textMuted,
              marginTop: 18,
            }}
          >
            Traveler since {memberSince}
          </Text>
        ) : null}

        <AccountActions />
      </ScrollView>

      <LayoverEditorModal
        visible={layoverEditorVisible}
        replacingActiveLayover={hasActiveLayover}
        onClose={() => setLayoverEditorVisible(false)}
        onCreate={handleCreateNextLayover}
      />
    </View>
  );
}

function FieldLabel({ children }: { children: string }) {
  return (
    <Text
      style={{
        ...theme.typography.eyebrow,
        color: theme.colors.textSecondary,
        marginBottom: 7,
      }}
    >
      {children}
    </Text>
  );
}

function ChoiceChip({
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
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: theme.borderRadius.full,
        backgroundColor: selected ? theme.colors.primary : theme.colors.surface,
        borderWidth: 1.5,
        borderColor: selected
          ? theme.colors.primaryDark
          : "rgba(14,25,41,0.14)",
      }}
    >
      <Text
        style={{
          fontFamily: theme.fonts.bodySemi,
          fontSize: 12,
          color: selected ? "#FCF7EA" : theme.colors.textSecondary,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function CounterButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: "minus" | "plus";
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={{
        width: 48,
        height: 48,
        borderRadius: theme.borderRadius.md,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: disabled
          ? theme.colors.surfaceMuted
          : theme.colors.surface,
        borderWidth: 1.5,
        borderColor: disabled ? theme.colors.divider : theme.colors.text,
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <Feather name={icon} size={19} color={theme.colors.text} />
    </TouchableOpacity>
  );
}

function LayoverTime({
  label,
  value,
  align = "flex-start",
}: {
  label: string;
  value: string;
  align?: "flex-start" | "flex-end";
}) {
  return (
    <View style={{ flex: 1, alignItems: align }}>
      <Text
        style={{
          fontFamily: theme.fonts.mono,
          fontSize: 9.5,
          letterSpacing: 0.8,
          textTransform: "uppercase",
          color: "rgba(252,247,234,0.54)",
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: theme.fonts.monoMed,
          fontSize: 13,
          lineHeight: 19,
          color: "#FCF7EA",
          marginTop: 3,
          textAlign: align === "flex-end" ? "right" : "left",
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function PreviewTag({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        paddingHorizontal: 9,
        paddingVertical: 5,
        borderRadius: theme.borderRadius.full,
        backgroundColor: theme.colors.primaryLight,
      }}
    >
      <Text
        style={{
          fontFamily: theme.fonts.bodySemi,
          fontSize: 10.5,
          color: theme.colors.primaryDark,
        }}
      >
        {children}
      </Text>
    </View>
  );
}

function SummaryLine({
  icon,
  label,
  value,
}: {
  icon: FeatherName;
  label: string;
  value: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 9 }}>
      <Feather
        name={icon}
        size={14}
        color={theme.colors.accent}
        style={{ marginTop: 2 }}
      />
      <Text
        style={{
          flex: 1,
          fontFamily: theme.fonts.body,
          fontSize: 12.5,
          lineHeight: 18,
          color: theme.colors.textSecondary,
        }}
      >
        <Text
          style={{ fontFamily: theme.fonts.bodyBold, color: theme.colors.text }}
        >
          {label}:{" "}
        </Text>
        {value}
      </Text>
    </View>
  );
}

function LinkRow({
  icon,
  label,
  onPress,
}: {
  icon: FeatherName;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        paddingHorizontal: 16,
        paddingVertical: 16,
      }}
    >
      <Feather name={icon} size={18} color={theme.colors.primary} />
      <Text
        style={{
          flex: 1,
          fontFamily: theme.fonts.bodySemi,
          fontSize: 15,
          color: theme.colors.text,
        }}
      >
        {label}
      </Text>
      <Feather name="chevron-right" size={18} color={theme.colors.textMuted} />
    </TouchableOpacity>
  );
}
