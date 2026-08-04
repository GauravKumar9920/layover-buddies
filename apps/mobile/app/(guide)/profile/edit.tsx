import { useEffect, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import Feather from "@expo/vector-icons/Feather";
import { useNavigation, usePreventRemove } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Header } from "@/components/ui/Header";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StarRating } from "@/components/ui/StarRating";
import { Loading } from "@/components/ui/Loading";
import {
  PhotoSlot,
  ProfileCompletionCard,
  ProfileSection,
} from "@/components/profile/ProfileBuilder";
import { pickImage, pickImages, type PickedImage } from "@/lib/imagePicker";
import { uploadImage } from "@/lib/imageUpload";
import {
  deleteGuideProfilePhoto,
  fetchGuideProfilePhotos,
  saveGuideProfilePhoto,
} from "@/lib/api/guideProfilePhotos";
import {
  moveGuideProfileToDraft,
  normalizePromptArray,
  publishGuideProfile,
  saveGuideProfileBuilder,
  setGuideAvailability,
  updateGuideProfile,
} from "@/lib/api/guides";
import { supabase } from "@/lib/supabase";
import { theme } from "@/config/theme";
import type {
  GuideProfile,
  GuideProfilePhoto,
  GuideProfilePhotoRole,
  GuidePrompt,
} from "@/types";

const DEFAULT_PROMPTS: GuidePrompt[] = [
  { question: "Three things about me", answer: "" },
  { question: "Hosting travelers has taught me…", answer: "" },
  { question: "You should skip my walk if…", answer: "" },
];

function promptKey(question: string): string {
  return question
    .trim()
    .toLocaleLowerCase()
    .replace(/…/g, "...")
    .replace(/[?.!,;:'"’]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Keep the three stable builder prompts while preserving every valid saved
 * answer. Canonical questions return to their own slot; older/custom questions
 * are assigned, in saved order, to the remaining empty slots.
 */
function mergeSavedPromptAnswers(savedPrompts: GuidePrompt[]): GuidePrompt[] {
  const merged = DEFAULT_PROMPTS.map((prompt) => ({ ...prompt }));
  const usedSavedIndexes = new Set<number>();

  savedPrompts.forEach((savedPrompt, savedIndex) => {
    const matchingDefaultIndex = DEFAULT_PROMPTS.findIndex(
      (defaultPrompt) =>
        promptKey(defaultPrompt.question) === promptKey(savedPrompt.question),
    );
    if (
      matchingDefaultIndex >= 0 &&
      merged[matchingDefaultIndex].answer.length === 0
    ) {
      merged[matchingDefaultIndex].answer = savedPrompt.answer;
      usedSavedIndexes.add(savedIndex);
    }
  });

  savedPrompts.forEach((savedPrompt, savedIndex) => {
    if (usedSavedIndexes.has(savedIndex)) return;
    const firstEmptyIndex = merged.findIndex(
      (prompt) => prompt.answer.length === 0,
    );
    if (firstEmptyIndex >= 0) {
      merged[firstEmptyIndex].answer = savedPrompt.answer;
    }
  });

  return merged;
}

const MAX_GALLERY_PHOTOS = 12;
const PROFILE_PHOTO_BUCKET = "itinerary-photos";

type PhotoBusy = "avatar" | GuideProfilePhotoRole | null;

function sortPhotos(photos: GuideProfilePhoto[]): GuideProfilePhoto[] {
  const roleOrder: Record<GuideProfilePhotoRole, number> = {
    cover: 0,
    story: 1,
    gallery: 2,
  };
  return [...photos].sort(
    (a, b) =>
      roleOrder[a.role] - roleOrder[b.role] ||
      a.position - b.position ||
      a.created_at.localeCompare(b.created_at),
  );
}

function releaseTemporaryImage(image: PickedImage) {
  if (Platform.OS === "web" && image.uri.startsWith("blob:")) {
    URL.revokeObjectURL(image.uri);
  }
}

function supportedImageFormat(image: PickedImage): {
  contentType: "image/jpeg" | "image/png" | "image/webp";
  extension: "jpg" | "png" | "webp";
} {
  const mime = image.mimeType.toLowerCase().split(";")[0].trim();
  if (mime === "image/jpeg" || mime === "image/jpg") {
    return { contentType: "image/jpeg", extension: "jpg" };
  }
  if (mime === "image/png") {
    return { contentType: "image/png", extension: "png" };
  }
  if (mime === "image/webp") {
    return { contentType: "image/webp", extension: "webp" };
  }
  throw new Error(
    "Choose a JPEG, PNG, or WebP image so it displays on every device.",
  );
}

function uniquePhotoName(
  role: GuideProfilePhotoRole,
  extension: string,
): string {
  return `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
}

export default function GuideProfileEditScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();
  const [profile, setProfile] = useState<GuideProfile | null>(null);
  const [profilePhotos, setProfilePhotos] = useState<GuideProfilePhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState<PhotoBusy>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [languages, setLanguages] = useState("");
  const [university, setUniversity] = useState("");
  const [hometown, setHometown] = useState("");
  const [pullQuote, setPullQuote] = useState("");
  const [prompts, setPrompts] = useState<GuidePrompt[]>(DEFAULT_PROMPTS);

  usePreventRemove(dirty && !saving && !statusBusy, ({ data }) => {
    Alert.alert(
      "Discard profile changes?",
      "Your unsaved text, captions, and photo order will be lost.",
      [
        { text: "Keep editing", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            setDirty(false);
            requestAnimationFrame(() => navigation.dispatch(data.action));
          },
        },
      ],
    );
  });

  useEffect(() => {
    void loadProfile();
    // This screen owns one signed-in guide profile for its entire mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toTagList(
    value: unknown,
    preferredKey: "language" | "name",
  ): string[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (!item || typeof item !== "object") return "";
        const record = item as Record<string, unknown>;
        const preferred = record[preferredKey];
        if (typeof preferred === "string") return preferred.trim();
        const fallback = record.name ?? record.language;
        return typeof fallback === "string" ? fallback.trim() : "";
      })
      .filter((item): item is string => item.length > 0);
  }

  async function loadProfile() {
    try {
      setLoadError(null);
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        setLoadError("Please sign in again to view your profile.");
        return;
      }

      let { data, error } = await supabase
        .from("guide_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;

      if (!data) {
        const { data: created, error: createError } = await supabase
          .from("guide_profiles")
          .insert({ user_id: user.id, is_active: false })
          .select("*")
          .single();
        if (createError) throw createError;
        data = created;
      }

      const [{ data: userData }, photos] = await Promise.all([
        supabase
          .from("users")
          .select("full_name, avatar_url")
          .eq("id", user.id)
          .maybeSingle(),
        fetchGuideProfilePhotos(data.id),
      ]);

      const normalizedLanguages = toTagList(data.languages, "language");
      const normalizedCategories = toTagList(data.skills, "name");
      const existingPrompts = normalizePromptArray(data.prompts);
      const sortedPhotos = sortPhotos(photos);

      const mappedProfile: GuideProfile = {
        profile_id: data.id,
        id: data.user_id,
        user_id: data.user_id,
        name: userData?.full_name ?? "",
        bio: data.bio ?? null,
        avatar_url: userData?.avatar_url ?? null,
        portfolio_image_url: null,
        gallery_urls: Array.isArray(data.gallery_urls) ? data.gallery_urls : [],
        profile_photos: sortedPhotos,
        university: data.university ?? null,
        avg_rating: Number(data.avg_rating ?? 0),
        total_reviews: Number(data.total_reviews ?? 0),
        total_trips: Number(data.total_trips ?? 0),
        is_active: data.is_active ?? false,
        profile_status:
          data.profile_status === "published" ? "published" : "draft",
        profile_completed_at: data.profile_completed_at ?? null,
        languages: normalizedLanguages,
        hometown: data.hometown ?? null,
        categories: normalizedCategories,
        created_at: data.created_at ?? new Date().toISOString(),
        prompts: existingPrompts as GuidePrompt[],
        pull_quote: data.pull_quote ?? null,
      };

      setProfile(mappedProfile);
      setProfilePhotos(sortedPhotos);
      setName(userData?.full_name ?? "");
      setBio(data.bio ?? "");
      setLanguages(normalizedLanguages.join(", "));
      setUniversity(data.university ?? "");
      setHometown(data.hometown ?? "");
      setPullQuote(data.pull_quote ?? "");
      setPrompts(mergeSavedPromptAnswers(existingPrompts as GuidePrompt[]));
      setDirty(false);
    } catch (err: unknown) {
      setLoadError(
        err instanceof Error ? err.message : "Failed to load your profile.",
      );
    } finally {
      setLoading(false);
    }
  }

  function updatePromptAnswer(index: number, answer: string) {
    setDirty(true);
    setPrompts((previous) =>
      previous.map((prompt, promptIndex) =>
        promptIndex === index ? { ...prompt, answer } : prompt,
      ),
    );
  }

  async function handlePickAvatar() {
    const picked = await pickImage({
      aspect: [1, 1],
      quality: 0.75,
      allowsEditing: true,
    });
    if (!picked || !profile) return;

    let format: ReturnType<typeof supportedImageFormat>;
    try {
      format = supportedImageFormat(picked);
    } catch (err: unknown) {
      releaseTemporaryImage(picked);
      Alert.alert(
        "Unsupported image",
        err instanceof Error ? err.message : "Choose another image.",
      );
      return;
    }

    const user = (await supabase.auth.getUser()).data.user;
    if (!user) {
      releaseTemporaryImage(picked);
      return;
    }
    setPhotoBusy("avatar");
    try {
      const path = `avatars/${user.id}.${format.extension}`;
      const { publicUrl } = await uploadImage({
        blob: picked.blob,
        bucket: "avatars",
        path,
        contentType: format.contentType,
        blobUri: picked.uri,
      });
      await updateGuideProfile(profile.profile_id, { avatar_url: publicUrl });
      setProfile((previous) =>
        previous ? { ...previous, avatar_url: publicUrl } : previous,
      );
    } catch (err: unknown) {
      Alert.alert(
        "Upload failed",
        err instanceof Error ? err.message : "Unknown error",
      );
    } finally {
      releaseTemporaryImage(picked);
      setPhotoBusy(null);
    }
  }

  async function uploadPlacedPhoto(
    image: PickedImage,
    role: GuideProfilePhotoRole,
    position: number,
  ): Promise<GuideProfilePhoto> {
    if (!profile) throw new Error("Profile is not ready yet.");
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error("Please sign in again.");

    const format = supportedImageFormat(image);
    const storagePath = `gallery/${user.id}/${uniquePhotoName(role, format.extension)}`;
    const { publicUrl } = await uploadImage({
      blob: image.blob,
      bucket: PROFILE_PHOTO_BUCKET,
      path: storagePath,
      contentType: format.contentType,
      blobUri: image.uri,
    });

    try {
      return await saveGuideProfilePhoto({
        guideProfileId: profile.profile_id,
        role,
        url: publicUrl,
        storageBucket: PROFILE_PHOTO_BUCKET,
        storagePath,
        position,
      });
    } catch (err) {
      // The object has no useful owner-visible placement if the metadata write
      // fails. Remove it immediately rather than leaving an orphan in Storage.
      await supabase.storage.from(PROFILE_PHOTO_BUCKET).remove([storagePath]);
      throw err;
    }
  }

  async function handlePickPlacedPhoto(role: "cover" | "story") {
    const picked = await pickImage({
      aspect: role === "cover" ? [16, 9] : [4, 3],
      quality: 0.8,
      allowsEditing: true,
    });
    if (!picked) return;

    try {
      supportedImageFormat(picked);
    } catch (err: unknown) {
      releaseTemporaryImage(picked);
      Alert.alert(
        "Unsupported image",
        err instanceof Error ? err.message : "Choose another image.",
      );
      return;
    }

    setPhotoBusy(role);
    try {
      const saved = await uploadPlacedPhoto(picked, role, 0);
      const next = sortPhotos([
        ...profilePhotos.filter((photo) => photo.role !== role),
        saved,
      ]);
      setProfilePhotos(next);
      setProfile((current) =>
        current ? { ...current, profile_photos: next } : current,
      );
    } catch (err: unknown) {
      Alert.alert(
        "Upload failed",
        err instanceof Error ? err.message : "Unknown error",
      );
    } finally {
      releaseTemporaryImage(picked);
      setPhotoBusy(null);
    }
  }

  async function handleAddGalleryPhotos() {
    const existingGallery = profilePhotos.filter(
      (photo) => photo.role === "gallery",
    );
    const remaining = MAX_GALLERY_PHOTOS - existingGallery.length;
    if (remaining <= 0) {
      Alert.alert(
        "Journal full",
        `You can add up to ${MAX_GALLERY_PHOTOS} photos.`,
      );
      return;
    }

    const picked = await pickImages({ quality: 0.8, limit: remaining });
    if (picked.length === 0) return;

    try {
      picked.forEach((image) => supportedImageFormat(image));
    } catch (err: unknown) {
      picked.forEach(releaseTemporaryImage);
      Alert.alert(
        "Unsupported image",
        err instanceof Error ? err.message : "Choose other images.",
      );
      return;
    }

    setPhotoBusy("gallery");
    let next = [...profilePhotos];
    try {
      for (let index = 0; index < picked.length; index += 1) {
        const saved = await uploadPlacedPhoto(
          picked[index],
          "gallery",
          existingGallery.length + index,
        );
        next = sortPhotos([...next, saved]);
        // Show each durable item as it finishes instead of making the guide wait
        // for the whole batch before seeing any progress.
        setProfilePhotos(next);
      }
      setProfile((current) =>
        current ? { ...current, profile_photos: next } : current,
      );
    } catch (err: unknown) {
      Alert.alert(
        "Upload failed",
        err instanceof Error ? err.message : "Unknown error",
      );
    } finally {
      picked.forEach(releaseTemporaryImage);
      setPhotoBusy(null);
    }
  }

  async function handleRemovePhoto(photo: GuideProfilePhoto) {
    setPhotoBusy(photo.role);
    try {
      await deleteGuideProfilePhoto(photo);
      const next = sortPhotos(
        profilePhotos
          .filter((candidate) => candidate.id !== photo.id)
          .map((candidate) =>
            candidate.role === "gallery"
              ? {
                  ...candidate,
                  position: profilePhotos
                    .filter(
                      (item) => item.role === "gallery" && item.id !== photo.id,
                    )
                    .findIndex((item) => item.id === candidate.id),
                }
              : candidate,
          ),
      );
      setProfilePhotos(next);
      setProfile((current) =>
        current
          ? {
              ...current,
              profile_photos: next,
              ...(photo.role === "cover"
                ? {
                    profile_status: "draft" as const,
                    is_active: false,
                  }
                : {}),
            }
          : current,
      );
    } catch (err: unknown) {
      Alert.alert(
        "Unable to remove photo",
        err instanceof Error ? err.message : "Please try again.",
      );
    } finally {
      setPhotoBusy(null);
    }
  }

  function updateGalleryCaption(photoId: string, caption: string) {
    setDirty(true);
    setProfilePhotos((previous) =>
      previous.map((photo) =>
        photo.id === photoId ? { ...photo, caption } : photo,
      ),
    );
  }

  function moveGalleryPhoto(photoId: string, direction: -1 | 1) {
    setDirty(true);
    setProfilePhotos((previous) => {
      const fixed = previous.filter((photo) => photo.role !== "gallery");
      const gallery = previous
        .filter((photo) => photo.role === "gallery")
        .sort((a, b) => a.position - b.position);
      const currentIndex = gallery.findIndex((photo) => photo.id === photoId);
      const nextIndex = currentIndex + direction;
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= gallery.length)
        return previous;
      [gallery[currentIndex], gallery[nextIndex]] = [
        gallery[nextIndex],
        gallery[currentIndex],
      ];
      return sortPhotos([
        ...fixed,
        ...gallery.map((photo, index) => ({ ...photo, position: index })),
      ]);
    });
  }

  async function persistBuilder(): Promise<{
    photos: GuideProfilePhoto[];
    autoDrafted: boolean;
    missing: string[];
  }> {
    if (!profile) {
      return { photos: profilePhotos, autoDrafted: false, missing: [] };
    }
    const filledPrompts = prompts
      .filter((prompt) => prompt.answer.trim().length > 0)
      .map((prompt) => ({
        question: prompt.question,
        answer: prompt.answer.trim(),
      }));
    const normalizedLanguages = languages
      .split(",")
      .map((language) => language.trim())
      .filter(Boolean);

    const fixed = profilePhotos.filter((photo) => photo.role !== "gallery");
    const gallery = profilePhotos
      .filter((photo) => photo.role === "gallery")
      .sort((a, b) => a.position - b.position)
      .map((photo, position) => ({
        ...photo,
        caption: photo.caption?.trim() || null,
        position,
      }));

    const saveResult = await saveGuideProfileBuilder({
      fullName: name.trim(),
      bio: bio.trim() || null,
      languages: normalizedLanguages,
      university: university.trim() || null,
      hometown: hometown.trim() || null,
      pullQuote: pullQuote.trim() || null,
      prompts: filledPrompts,
      galleryPhotos: gallery,
    });

    const nextPhotos = sortPhotos([...fixed, ...gallery]);

    setProfilePhotos(nextPhotos);
    setProfile((current) =>
      current
        ? {
            ...current,
            name: name.trim(),
            bio: bio.trim() || null,
            languages: normalizedLanguages,
            university: university.trim() || null,
            hometown: hometown.trim() || null,
            pull_quote: pullQuote.trim() || null,
            prompts: filledPrompts,
            profile_photos: nextPhotos,
            profile_status: saveResult.profileStatus,
            is_active: saveResult.autoDrafted ? false : current.is_active,
          }
        : current,
    );
    return {
      photos: nextPhotos,
      autoDrafted: saveResult.autoDrafted,
      missing: saveResult.missing,
    };
  }

  async function handleSave() {
    if (!profile) return;
    setSaving(true);
    try {
      const result = await persistBuilder();
      Alert.alert(
        result.autoDrafted ? "Saved as draft" : "Saved",
        result.autoDrafted
          ? `This profile still needs ${result.missing.join(", ")}, so inquiries were paused while you finish it.`
          : "Your profile builder changes are saved.",
      );
      setDirty(false);
    } catch (err: unknown) {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Failed to save",
      );
    } finally {
      setSaving(false);
    }
  }

  const coverPhoto =
    profilePhotos.find((photo) => photo.role === "cover") ?? null;
  const storyPhoto =
    profilePhotos.find((photo) => photo.role === "story") ?? null;
  const galleryPhotos = profilePhotos
    .filter((photo) => photo.role === "gallery")
    .sort((a, b) => a.position - b.position);
  const completionChecks = [
    { label: "profile photo", complete: Boolean(profile?.avatar_url) },
    { label: "full name", complete: name.trim().length > 0 },
    { label: "university", complete: university.trim().length > 0 },
    { label: "hometown", complete: hometown.trim().length > 0 },
    {
      label: "languages",
      complete: languages.split(",").some((item) => item.trim()),
    },
    { label: "bio", complete: bio.trim().length > 0 },
    { label: "headline quote", complete: pullQuote.trim().length > 0 },
    {
      label: "all three story answers",
      complete:
        prompts.length === DEFAULT_PROMPTS.length &&
        prompts.every((prompt) => prompt.answer.trim().length > 0),
    },
    { label: "profile cover", complete: Boolean(coverPhoto) },
  ];
  const missing = completionChecks
    .filter((check) => !check.complete)
    .map((check) => check.label);
  const completedCount = completionChecks.length - missing.length;
  const identityComplete = completionChecks
    .slice(0, 5)
    .every((check) => check.complete);
  const storyComplete = completionChecks
    .slice(5, 8)
    .every((check) => check.complete);
  const mediaComplete = Boolean(coverPhoto);

  async function handleStatusChange(nextStatus: "draft" | "published") {
    if (!profile) return;

    setStatusBusy(true);
    try {
      await persistBuilder();
      setDirty(false);
      if (nextStatus === "published") {
        const result = await publishGuideProfile();
        if (!result.published) {
          Alert.alert(
            "Profile is not ready yet",
            `Add ${result.missing.join(", ")} before publishing.`,
          );
          return;
        }
      } else {
        await moveGuideProfileToDraft();
      }
      const completedAt =
        nextStatus === "published"
          ? (profile.profile_completed_at ?? new Date().toISOString())
          : profile.profile_completed_at;
      setProfile((current) =>
        current
          ? {
              ...current,
              profile_status: nextStatus,
              profile_completed_at: completedAt,
              is_active: nextStatus === "draft" ? false : current.is_active,
            }
          : current,
      );
      Alert.alert(
        nextStatus === "published"
          ? "Profile published"
          : "Profile moved to draft",
        nextStatus === "published"
          ? "Travelers can now see your structured profile."
          : "Your profile is hidden while you make changes.",
      );
    } catch (err: unknown) {
      Alert.alert(
        "Unable to update profile status",
        err instanceof Error ? err.message : "Please try again.",
      );
    } finally {
      setStatusBusy(false);
    }
  }

  async function handleAcceptingToggle() {
    if (!profile) return;
    const nextValue = !profile.is_active;
    if (nextValue && profile.profile_status !== "published") {
      Alert.alert(
        "Publish your profile first",
        "Accepting inquiries becomes available after the profile passes its publication check.",
      );
      return;
    }
    try {
      await setGuideAvailability(nextValue);
      setProfile((current) =>
        current ? { ...current, is_active: nextValue } : current,
      );
    } catch (err: unknown) {
      Alert.alert(
        "Unable to update availability",
        err instanceof Error ? err.message : "Please try again.",
      );
    }
  }

  if (loading) return <Loading fullScreen />;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.background,
        paddingTop: insets.top,
      }}
    >
      <Header
        title="Edit guide profile"
        showBack
        backFallback="/(guide)/profile"
      />
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingBottom: insets.bottom + 40,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {loadError ? (
          <Card
            style={{ marginBottom: 16, borderWidth: 1, borderColor: "#FCA5A5" }}
          >
            <Text style={{ fontSize: 13, color: theme.colors.error }}>
              {loadError}
            </Text>
          </Card>
        ) : null}

        <ProfileCompletionCard
          eyebrow={
            profile?.profile_status === "published"
              ? "Published profile"
              : "Draft profile"
          }
          title="Build the profile travelers will trust"
          completed={completedCount}
          total={completionChecks.length}
          missing={missing}
        />

        {profile ? (
          <TouchableOpacity
            onPress={() =>
              router.push(`/(traveler)/guide/${profile.user_id}` as never)
            }
            activeOpacity={0.85}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              marginBottom: 2,
              borderWidth: 1.5,
              borderColor: theme.colors.primary,
              backgroundColor: theme.colors.primaryLight,
              borderRadius: theme.borderRadius.full,
              paddingVertical: 13,
            }}
          >
            <Feather name="eye" size={16} color={theme.colors.primary} />
            <Text
              style={{
                fontFamily: theme.fonts.bodyBold,
                fontSize: 14,
                color: theme.colors.primaryDark,
              }}
            >
              Preview as traveler
            </Text>
          </TouchableOpacity>
        ) : null}

        <ProfileSection
          number={1}
          icon="user"
          title="Identity"
          description="Your headshot and the essentials travelers use to understand who you are."
          complete={identityComplete}
        >
          <PhotoSlot
            imageUrl={profile?.avatar_url ?? null}
            title="Profile photo"
            usage="Your face appears in the circular identity slot on cards, chats, and your profile. It is never used as a cover."
            buttonLabel="Add headshot"
            circular
            busy={photoBusy === "avatar"}
            onPick={() => void handlePickAvatar()}
          />

          {profile && profile.total_reviews > 0 ? (
            <View style={{ alignItems: "center" }}>
              <StarRating rating={profile.avg_rating} size={18} animate />
              <Text
                style={{
                  color: theme.colors.textSecondary,
                  fontSize: 12.5,
                  marginTop: 4,
                }}
              >
                {profile.avg_rating.toFixed(1)} · {profile.total_reviews}{" "}
                reviews
              </Text>
            </View>
          ) : null}

          <Input
            label="Full name"
            value={name}
            onChangeText={(value) => {
              setDirty(true);
              setName(value);
            }}
            autoCapitalize="words"
          />
          <Input
            label="University"
            value={university}
            onChangeText={(value) => {
              setDirty(true);
              setUniversity(value);
            }}
            placeholder="e.g. IIT Bombay"
            autoCapitalize="words"
          />
          <Input
            label="Hometown"
            value={hometown}
            onChangeText={(value) => {
              setDirty(true);
              setHometown(value);
            }}
            placeholder="e.g. Mumbai"
            hint="Shown alongside your university on the public profile."
            autoCapitalize="words"
          />
          <Input
            label="Languages"
            value={languages}
            onChangeText={(value) => {
              setDirty(true);
              setLanguages(value);
            }}
            placeholder="English, Hindi, Marathi"
            hint="Separate languages with commas."
          />
        </ProfileSection>

        <ProfileSection
          number={2}
          icon="edit-3"
          title="Your story"
          description="Write this in your own voice. Blank answers remain hidden rather than being invented for you."
          complete={storyComplete}
        >
          <Input
            label="Bio"
            value={bio}
            onChangeText={(value) => {
              setDirty(true);
              setBio(value);
            }}
            placeholder="What makes time with you different?"
            multiline
            numberOfLines={4}
          />
          <Input
            label="Headline quote"
            value={pullQuote}
            onChangeText={(value) => {
              setDirty(true);
              setPullQuote(value);
            }}
            placeholder="The best part of Mumbai isn't on anyone's checklist…"
            multiline
            numberOfLines={3}
            hint="Shown as the lead line in your story. Aim for under 30 words."
          />
          {prompts.map((prompt, index) => (
            <Input
              key={prompt.question}
              label={prompt.question}
              value={prompt.answer}
              onChangeText={(value) => updatePromptAnswer(index, value)}
              placeholder="Your answer…"
              multiline
              numberOfLines={3}
            />
          ))}
        </ProfileSection>

        <ProfileSection
          number={3}
          icon="image"
          title="Visual story"
          description="Every photo has one declared job, so adding a journal image cannot unexpectedly move it into your cover or interview."
          complete={mediaComplete}
        >
          <PhotoSlot
            imageUrl={coverPhoto?.url ?? null}
            title="Profile cover"
            usage="The lead landscape image on your guide card and public profile header."
            buttonLabel="Choose cover"
            aspectRatio={16 / 9}
            busy={photoBusy === "cover"}
            onPick={() => void handlePickPlacedPhoto("cover")}
            onRemove={
              coverPhoto ? () => void handleRemovePhoto(coverPhoto) : undefined
            }
          />

          <View style={{ height: 1, backgroundColor: theme.colors.divider }} />

          <PhotoSlot
            imageUrl={storyPhoto?.url ?? null}
            title="Interview photo (optional)"
            usage="Used only behind your headline quote. It never becomes your cover or enters the journal."
            buttonLabel="Choose story photo"
            aspectRatio={4 / 3}
            busy={photoBusy === "story"}
            onPick={() => void handlePickPlacedPhoto("story")}
            onRemove={
              storyPhoto ? () => void handleRemovePhoto(storyPhoto) : undefined
            }
          />

          <View style={{ height: 1, backgroundColor: theme.colors.divider }} />

          <View>
            <Text
              style={{
                fontFamily: theme.fonts.bodyBold,
                fontSize: 14,
                color: theme.colors.text,
              }}
            >
              Photo journal
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
              Ordered moments from real walks. Add context, then use the arrows
              to decide exactly what travelers see first.
            </Text>
          </View>

          {galleryPhotos.length > 0 ? (
            <View style={{ gap: 12 }}>
              {galleryPhotos.map((photo, index) => (
                <JournalPhotoRow
                  key={photo.id}
                  photo={photo}
                  index={index}
                  total={galleryPhotos.length}
                  busy={photoBusy === "gallery"}
                  onCaptionChange={(caption) =>
                    updateGalleryCaption(photo.id, caption)
                  }
                  onMove={(direction) => moveGalleryPhoto(photo.id, direction)}
                  onRemove={() => void handleRemovePhoto(photo)}
                />
              ))}
              <Text
                style={{
                  fontFamily: theme.fonts.body,
                  fontSize: 11.5,
                  color: theme.colors.textMuted,
                }}
              >
                Captions and order are applied when you tap Save changes.
              </Text>
            </View>
          ) : (
            <View
              style={{
                padding: 16,
                borderRadius: 12,
                backgroundColor: theme.colors.surfaceMuted,
              }}
            >
              <Text
                style={{
                  fontFamily: theme.fonts.body,
                  fontSize: 13,
                  lineHeight: 18,
                  color: theme.colors.textSecondary,
                }}
              >
                No journal photos yet. This section stays hidden on your public
                profile until you add real walk moments.
              </Text>
            </View>
          )}

          <Button
            title={
              photoBusy === "gallery"
                ? "Adding photos…"
                : galleryPhotos.length >= MAX_GALLERY_PHOTOS
                  ? "Journal full"
                  : "Add journal photos"
            }
            variant="secondary"
            loading={photoBusy === "gallery"}
            disabled={galleryPhotos.length >= MAX_GALLERY_PHOTOS}
            onPress={() => void handleAddGalleryPhotos()}
            icon={<Feather name="plus" size={16} color={theme.colors.text} />}
          />
        </ProfileSection>

        <Button
          title="Save changes"
          onPress={() => void handleSave()}
          loading={saving}
          disabled={statusBusy || photoBusy !== null}
          style={{ marginTop: 16 }}
        />

        {profile ? (
          <Card style={{ gap: 14, marginTop: 16 }}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor:
                    profile.profile_status === "published"
                      ? theme.colors.success
                      : theme.colors.gold,
                }}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: theme.fonts.displaySemi,
                    fontSize: 16,
                    color: theme.colors.text,
                  }}
                >
                  {profile.profile_status === "published"
                    ? "Profile is published"
                    : "Profile is a draft"}
                </Text>
                <Text
                  style={{
                    fontFamily: theme.fonts.body,
                    fontSize: 12.5,
                    lineHeight: 18,
                    color: theme.colors.textSecondary,
                    marginTop: 2,
                  }}
                >
                  Publication controls visibility. Accepting inquiries is a
                  separate setting below.
                </Text>
              </View>
            </View>

            {profile.profile_status === "published" ? (
              <Button
                title="Move profile to draft"
                variant="secondary"
                loading={statusBusy}
                disabled={saving || photoBusy !== null}
                onPress={() => void handleStatusChange("draft")}
              />
            ) : (
              <Button
                title="Publish profile"
                loading={statusBusy}
                disabled={saving || photoBusy !== null}
                onPress={() => void handleStatusChange("published")}
              />
            )}
          </Card>
        ) : null}

        {profile ? (
          <Card
            style={{
              marginTop: 16,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <View style={{ flex: 1, paddingRight: 16 }}>
              <Text
                style={{
                  fontFamily: theme.fonts.displaySemi,
                  fontSize: 15,
                  color: theme.colors.text,
                }}
              >
                Accepting inquiries
              </Text>
              <Text
                style={{
                  fontFamily: theme.fonts.body,
                  fontSize: 13,
                  color: theme.colors.textSecondary,
                  marginTop: 2,
                }}
              >
                {profile.is_active
                  ? "Travelers can message you or start planning a walk."
                  : "New inquiries are paused; your published profile and photos stay visible."}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => void handleAcceptingToggle()}
              accessibilityRole="switch"
              accessibilityState={{ checked: profile.is_active }}
              style={{
                width: 52,
                height: 28,
                borderRadius: 14,
                backgroundColor: profile.is_active
                  ? theme.colors.primary
                  : theme.colors.surfaceMuted,
                padding: 2,
                justifyContent: "center",
              }}
            >
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: theme.colors.surface,
                  alignSelf: profile.is_active ? "flex-end" : "flex-start",
                  ...theme.shadows.sm,
                }}
              />
            </TouchableOpacity>
          </Card>
        ) : null}

      </ScrollView>
    </View>
  );
}

function JournalPhotoRow({
  photo,
  index,
  total,
  busy,
  onCaptionChange,
  onMove,
  onRemove,
}: {
  photo: GuideProfilePhoto;
  index: number;
  total: number;
  busy: boolean;
  onCaptionChange: (caption: string) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <View
      style={{
        padding: 12,
        borderWidth: 1,
        borderColor: theme.colors.divider,
        borderRadius: 14,
        backgroundColor: theme.colors.surface,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <Text
          style={{
            fontFamily: theme.fonts.monoMed,
            fontSize: 10,
            letterSpacing: 0.7,
            textTransform: "uppercase",
            color: theme.colors.primary,
          }}
        >
          Journal photo {index + 1}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <JournalAction
            icon="arrow-up"
            label={`Move photo ${index + 1} earlier`}
            disabled={busy || index === 0}
            onPress={() => onMove(-1)}
          />
          <JournalAction
            icon="arrow-down"
            label={`Move photo ${index + 1} later`}
            disabled={busy || index === total - 1}
            onPress={() => onMove(1)}
          />
          <JournalAction
            icon="trash-2"
            label={`Remove photo ${index + 1}`}
            destructive
            disabled={busy}
            onPress={onRemove}
          />
        </View>
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 12,
          marginTop: 10,
        }}
      >
        <Image
          source={{ uri: photo.url }}
          style={{
            width: 104,
            height: 92,
            borderRadius: 10,
            backgroundColor: theme.colors.surfaceMuted,
          }}
          contentFit="cover"
          transition={200}
        />
        <Input
          label="Caption"
          value={photo.caption ?? ""}
          onChangeText={onCaptionChange}
          placeholder="Where was this, and why does it matter?"
          maxLength={180}
          multiline
          numberOfLines={3}
          style={{ flex: 1 }}
          inputStyle={{ fontSize: 13, minHeight: 54, textAlignVertical: "top" }}
        />
      </View>
    </View>
  );
}

function JournalAction({
  icon,
  label,
  disabled,
  destructive = false,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  disabled: boolean;
  destructive?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
      style={{
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: destructive
          ? "rgba(190,55,43,0.08)"
          : theme.colors.surfaceMuted,
        opacity: disabled ? 0.35 : 1,
      }}
    >
      <Feather
        name={icon}
        size={14}
        color={destructive ? theme.colors.error : theme.colors.textSecondary}
      />
    </TouchableOpacity>
  );
}
