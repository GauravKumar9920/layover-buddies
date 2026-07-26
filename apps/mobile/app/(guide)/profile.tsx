import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import Feather from '@expo/vector-icons/Feather';
import { pickImage, pickImages } from '@/lib/imagePicker';
import { uploadImage } from '@/lib/imageUpload';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StarRating } from '@/components/ui/StarRating';
import { Loading } from '@/components/ui/Loading';
import { AccountActions } from '@/components/settings/AccountActions';
import { supabase } from '@/lib/supabase';
import { updateGuideProfile, normalizePromptArray } from '@/lib/api/guides';
import { signOut } from '@/lib/auth';
import { theme } from '@/config/theme';
import type { GuideProfile, GuidePrompt } from '@/types';

// The same three questions that the traveler-facing fallback uses
// (mobile/app/(traveler)/guide/[id].tsx:78-95). Keeping them identical
// means guides see familiar prompts and only fill in the answers.
const DEFAULT_PROMPTS: GuidePrompt[] = [
  { question: 'Three things about me', answer: '' },
  { question: 'Hosting travelers has taught me…', answer: '' },
  { question: 'You should skip my walk if…', answer: '' },
];

export default function GuideProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [profile, setProfile] = useState<GuideProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Card 1 — basics
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [languages, setLanguages] = useState('');
  const [university, setUniversity] = useState('');
  const [hometown, setHometown] = useState('');

  // Card 2 — "Your Story" (the editorial-zine fields)
  const [pullQuote, setPullQuote] = useState('');
  const [prompts, setPrompts] = useState<GuidePrompt[]>(DEFAULT_PROMPTS);

  // Card 3 — photo gallery (feeds the traveler-facing hero gallery + journal)
  const [gallery, setGallery] = useState<string[]>([]);
  const [galleryBusy, setGalleryBusy] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  function toTagList(value: unknown, preferredKey: 'language' | 'name'): string[] {
    if (!Array.isArray(value)) return [];

    return value
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (!item || typeof item !== 'object') return '';
        const record = item as Record<string, unknown>;
        const preferred = record[preferredKey];
        if (typeof preferred === 'string') return preferred.trim();
        const fallback = record.name ?? record.language;
        return typeof fallback === 'string' ? fallback.trim() : '';
      })
      .filter((item): item is string => item.length > 0);
  }

  async function loadProfile() {
    try {
      setLoadError(null);
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        setLoadError('Please sign in again to view your profile.');
        return;
      }

      let { data, error } = await supabase
        .from('guide_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      // Self-heal: if the auth-sync trigger didn't run (older accounts), create
      // a placeholder row so the rest of the screen has something to bind to.
      if (!data) {
        const { data: created, error: createError } = await supabase
          .from('guide_profiles')
          .insert({ user_id: user.id, is_active: true })
          .select('*')
          .single();

        if (createError) throw createError;
        data = created;
      }

      const { data: userData } = await supabase
        .from('users')
        .select('full_name, avatar_url')
        .eq('id', user.id)
        .maybeSingle();

      const normalizedLanguages = toTagList(data.languages, 'language');
      const normalizedCategories = toTagList(data.skills, 'name');
      const existingPrompts = normalizePromptArray(data.prompts);

      const mappedProfile: GuideProfile = {
        id: data.id,
        user_id: data.user_id,
        name: userData?.full_name ?? '',
        bio: data.bio ?? null,
        avatar_url: userData?.avatar_url ?? null,
        university: data.university ?? null,
        avg_rating: Number(data.avg_rating ?? 0),
        total_reviews: Number(data.total_reviews ?? 0),
        is_active: data.is_active ?? true,
        languages: normalizedLanguages,
        hometown: data.hometown ?? null,
        categories: normalizedCategories,
        created_at: data.created_at ?? new Date().toISOString(),
        prompts: existingPrompts as GuidePrompt[],
        pull_quote: data.pull_quote ?? null,
        gallery_urls: Array.isArray(data.gallery_urls) ? data.gallery_urls : [],
      };

      setProfile(mappedProfile);
      setGallery(Array.isArray(data.gallery_urls) ? data.gallery_urls : []);
      setName(userData?.full_name ?? '');
      setBio(data.bio ?? '');
      setLanguages(normalizedLanguages.join(', '));
      setUniversity(data.university ?? '');
      setHometown(data.hometown ?? '');
      setPullQuote(data.pull_quote ?? '');

      // If the guide has saved 3 prompts, pre-fill from those. Otherwise keep
      // the empty scaffold so all 3 question slots are visible to fill in.
      if (existingPrompts.length === 3) {
        setPrompts(existingPrompts as GuidePrompt[]);
      } else {
        setPrompts(DEFAULT_PROMPTS);
      }
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load your profile.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!profile) return;
    setSaving(true);
    try {
      // Only persist prompts whose answer is non-empty so the traveler view
      // falls back gracefully (to fabricated content) rather than rendering
      // empty Q/A cards.
      const filledPrompts = prompts
        .filter((p) => p.answer.trim().length > 0)
        .map((p) => ({ question: p.question, answer: p.answer.trim() }));

      await updateGuideProfile(profile.id, {
        name: name.trim(),
        bio: bio.trim() || null,
        languages: languages.split(',').map((l) => l.trim()).filter(Boolean),
        university: university.trim() || null,
        hometown: hometown.trim() || null,
        pull_quote: pullQuote.trim() || null,
        prompts: filledPrompts,
      });
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  function updatePromptAnswer(index: number, answer: string) {
    setPrompts((prev) => prev.map((p, i) => (i === index ? { ...p, answer } : p)));
  }

  async function handlePickImage() {
    const picked = await pickImage({ aspect: [1, 1], quality: 0.7, allowsEditing: true });
    if (!picked) return;

    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    try {
      const ext = picked.fileName.split('.').pop() ?? 'jpg';
      const path = `avatars/${user.id}.${ext}`;
      const { publicUrl } = await uploadImage({
        blob: picked.blob,
        bucket: 'avatars',
        path,
        contentType: picked.mimeType,
        blobUri: picked.uri,
      });
      if (profile) {
        await updateGuideProfile(profile.id, { avatar_url: publicUrl });
        setProfile({ ...profile, avatar_url: publicUrl });
      }
    } catch (err: unknown) {
      Alert.alert('Upload failed', err instanceof Error ? err.message : 'Unknown error');
    }
  }

  async function persistGallery(next: string[]) {
    setGallery(next);
    if (profile) {
      try {
        await updateGuideProfile(profile.id, { gallery_urls: next });
        setProfile({ ...profile, gallery_urls: next });
      } catch (err: unknown) {
        Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save gallery');
      }
    }
  }

  async function handleAddGalleryPhoto() {
    const picked = await pickImages({ quality: 0.8, limit: 10 });
    if (picked.length === 0) return;
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;
    setGalleryBusy(true);
    try {
      const uploaded: string[] = [];
      for (let i = 0; i < picked.length; i += 1) {
        const img = picked[i];
        const ext = img.fileName.split('.').pop() ?? 'jpg';
        const path = `gallery/${user.id}/${Date.now()}-${i}.${ext}`;
        const { publicUrl } = await uploadImage({
          blob: img.blob,
          bucket: 'itinerary-photos',
          path,
          contentType: img.mimeType,
          blobUri: img.uri,
        });
        uploaded.push(publicUrl);
      }
      await persistGallery([...gallery, ...uploaded]);
    } catch (err: unknown) {
      Alert.alert('Upload failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setGalleryBusy(false);
    }
  }

  function handleRemoveGalleryPhoto(url: string) {
    persistGallery(gallery.filter((u) => u !== url));
  }

  async function handleSignOut() {
    await signOut();
  }

  if (loading) return <Loading fullScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top }}>
      <Header title="My Profile" />
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {loadError && (
          <Card style={{ marginBottom: 16, borderWidth: 1, borderColor: '#FCA5A5' }}>
            <Text style={{ fontSize: 13, color: theme.colors.error }}>
              {loadError}
            </Text>
          </Card>
        )}

        {/* Avatar */}
        <View style={{ alignItems: 'center', marginBottom: 28 }}>
          <TouchableOpacity onPress={handlePickImage}>
            {profile?.avatar_url ? (
              <Image
                source={{ uri: profile.avatar_url }}
                style={{ width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: theme.colors.primary }}
                contentFit="cover"
                transition={300}
              />
            ) : (
              <View
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 48,
                  backgroundColor: theme.colors.primaryLight,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 3,
                  borderColor: theme.colors.primary,
                }}
              >
                <Text style={{ fontFamily: theme.fonts.display, fontSize: 34, color: theme.colors.primary }}>
                  {(name || 'G').split(' ').map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()}
                </Text>
              </View>
            )}
            <View
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                backgroundColor: theme.colors.primary,
                borderWidth: 1.5,
                borderColor: theme.colors.surface,
                borderRadius: 14,
                padding: 6,
              }}
            >
              <Feather name="camera" size={13} color="#FCF7EA" />
            </View>
          </TouchableOpacity>

          {/* Rating Summary */}
          {profile && profile.total_reviews > 0 && (
            <View style={{ alignItems: 'center', marginTop: 12 }}>
              <StarRating rating={profile.avg_rating} size={20} animate />
              <Text style={{ color: theme.colors.textSecondary, fontSize: 13, marginTop: 4 }}>
                {profile.avg_rating.toFixed(1)} · {profile.total_reviews} reviews
              </Text>
            </View>
          )}
        </View>

        {/* Preview as traveler — opens the guide's own public-facing profile */}
        {profile && (
          <TouchableOpacity
            onPress={() => router.push(`/(traveler)/guide/${profile.user_id}` as never)}
            activeOpacity={0.85}
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
              marginBottom: 16,
              borderWidth: 1.5, borderColor: theme.colors.primary,
              backgroundColor: theme.colors.primaryLight,
              borderRadius: theme.borderRadius.full, paddingVertical: 13,
            }}
          >
            <Feather name="eye" size={16} color={theme.colors.primary} />
            <Text style={{ fontFamily: theme.fonts.bodyBold, fontSize: 14, color: theme.colors.primaryDark }}>
              Preview as traveler
            </Text>
          </TouchableOpacity>
        )}

        {/* Card 1 — basics */}
        <Card style={{ gap: 16 }}>
          <Text style={{ fontFamily: theme.fonts.display, fontSize: 18, color: theme.colors.text, letterSpacing: -0.3, marginBottom: 4 }}>
            Edit Profile
          </Text>
          <Input label="Full Name" value={name} onChangeText={setName} autoCapitalize="words" />
          <Input
            label="University"
            value={university}
            onChangeText={setUniversity}
            placeholder="e.g. IIT Bombay"
            autoCapitalize="words"
          />
          <Input
            label="Hometown"
            value={hometown}
            onChangeText={setHometown}
            placeholder="e.g. Mumbai"
            hint="Shown alongside your university on your profile."
            autoCapitalize="words"
          />
          <Input
            label="Languages (comma separated)"
            value={languages}
            onChangeText={setLanguages}
            placeholder="English, Hindi, Marathi"
          />
          <View>
            <Text style={{ fontFamily: theme.fonts.mono, fontSize: 11, color: theme.colors.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1.2 }}>
              Bio
            </Text>
            <Input
              value={bio}
              onChangeText={setBio}
              placeholder="Tell travelers about yourself — your interests, experience, what makes your tours special..."
              multiline
              numberOfLines={4}
            />
          </View>
        </Card>

        {/* Card 2 — Your Story (editorial-zine fields) */}
        <Card style={{ gap: 16, marginTop: 16 }}>
          <View>
            <Text style={{ fontFamily: theme.fonts.display, fontSize: 18, color: theme.colors.text, letterSpacing: -0.3 }}>
              Your Story
            </Text>
            <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginTop: 4, lineHeight: 18 }}>
              This is what travelers see first on your profile. Leave blank to use a friendly default.
            </Text>
          </View>

          <View>
            <Text style={{ fontFamily: theme.fonts.mono, fontSize: 11, color: theme.colors.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1.2 }}>
              Headline quote
            </Text>
            <Input
              value={pullQuote}
              onChangeText={setPullQuote}
              placeholder="The best part of Mumbai isn't on anyone's checklist…"
              multiline
              numberOfLines={3}
              hint="Shown large and italic at the top of your profile. Aim for under 30 words."
            />
          </View>

          {prompts.map((prompt, idx) => (
            <View key={idx}>
              <Text style={{ fontFamily: theme.fonts.mono, fontSize: 11, color: theme.colors.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1.2 }}>
                {prompt.question}
              </Text>
              <Input
                value={prompt.answer}
                onChangeText={(v) => updatePromptAnswer(idx, v)}
                placeholder="Your answer..."
                multiline
                numberOfLines={3}
              />
            </View>
          ))}
        </Card>

        {/* Card 3 — Photo gallery */}
        <Card style={{ gap: 14, marginTop: 16 }}>
          <View>
            <Text style={{ fontFamily: theme.fonts.display, fontSize: 18, color: theme.colors.text, letterSpacing: -0.3 }}>
              Photo gallery
            </Text>
            <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginTop: 4, lineHeight: 18 }}>
              Real photos from your walks. These show up on your profile — the swipeable header and the photo journal travelers scroll through.
            </Text>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {gallery.map((url) => (
              <View key={url} style={{ width: 96, height: 72, borderRadius: 10, overflow: 'hidden', backgroundColor: theme.colors.surfaceMuted }}>
                <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={200} />
                <TouchableOpacity
                  onPress={() => handleRemoveGalleryPhoto(url)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  style={{
                    position: 'absolute', top: 4, right: 4,
                    width: 22, height: 22, borderRadius: 11,
                    backgroundColor: 'rgba(14,25,41,0.7)',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Feather name="x" size={13} color="#FCF7EA" />
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity
              onPress={handleAddGalleryPhoto}
              disabled={galleryBusy}
              style={{
                width: 96, height: 72, borderRadius: 10,
                borderWidth: 1.5, borderColor: theme.colors.primary, borderStyle: 'dashed',
                backgroundColor: theme.colors.primaryLight,
                alignItems: 'center', justifyContent: 'center', gap: 3,
                opacity: galleryBusy ? 0.6 : 1,
              }}
            >
              <Feather name={galleryBusy ? 'loader' : 'plus'} size={18} color={theme.colors.primary} />
              <Text style={{ fontFamily: theme.fonts.mono, fontSize: 9, letterSpacing: 0.4, textTransform: 'uppercase', color: theme.colors.primary }}>
                {galleryBusy ? 'Adding…' : 'Add photos'}
              </Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Single shared Save button — handleSave writes both cards atomically */}
        <Button title="Save Changes" onPress={handleSave} loading={saving} style={{ marginTop: 16 }} />

        {/* Active Status Toggle */}
        {profile && (
          <Card style={{ marginTop: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ fontFamily: theme.fonts.displaySemi, fontSize: 15, color: theme.colors.text }}>
                Accepting bookings
              </Text>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 }}>
                {profile.is_active ? 'You appear in search results' : 'Hidden from search'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={async () => {
                const newVal = !profile.is_active;
                await updateGuideProfile(profile.id, { is_active: newVal });
                setProfile({ ...profile, is_active: newVal });
              }}
              style={{
                width: 52,
                height: 28,
                borderRadius: 14,
                backgroundColor: profile.is_active ? theme.colors.primary : theme.colors.surfaceMuted,
                padding: 2,
                justifyContent: 'center',
              }}
            >
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: theme.colors.surface,
                  alignSelf: profile.is_active ? 'flex-end' : 'flex-start',
                  ...theme.shadows.sm,
                }}
              />
            </TouchableOpacity>
          </Card>
        )}

        {/* Sign Out */}
        <Button
          title="Sign Out"
          onPress={handleSignOut}
          variant="danger"
          style={{ marginTop: 24 }}
        />

        {/* Legal links + account deletion (Apple 5.1.1(v) / store requirements) */}
        <AccountActions />
      </ScrollView>
    </View>
  );
}
