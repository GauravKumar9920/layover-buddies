import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { pickImage } from '@/lib/imagePicker';
import { uploadImage } from '@/lib/imageUpload';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StarRating } from '@/components/ui/StarRating';
import { Loading } from '@/components/ui/Loading';
import { supabase } from '@/lib/supabase';
import { updateGuideProfile } from '@/lib/api/guides';
import { signOut } from '@/lib/auth';
import { theme } from '@/config/theme';
import type { GuideProfile } from '@/types';

export default function GuideProfileScreen() {
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<GuideProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [languages, setLanguages] = useState('');

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
        hometown: null,
        categories: normalizedCategories,
        created_at: data.created_at ?? new Date().toISOString(),
      };

      setProfile(mappedProfile);
      setName(userData?.full_name ?? '');
      setBio(data.bio ?? '');
      setLanguages(normalizedLanguages.join(', '));
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
      await updateGuideProfile(profile.id, {
        name: name.trim(),
        bio: bio.trim() || null,
        languages: languages.split(',').map((l) => l.trim()).filter(Boolean),
      });
      Alert.alert('✅ Saved', 'Your profile has been updated.');
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
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
                <Text style={{ fontSize: 36 }}>👤</Text>
              </View>
            )}
            <View
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                backgroundColor: theme.colors.primary,
                borderRadius: 12,
                padding: 4,
              }}
            >
              <Text style={{ fontSize: 12 }}>📷</Text>
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

        {/* Form */}
        <Card style={{ gap: 16 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: theme.colors.text, marginBottom: 4 }}>
            Edit Profile
          </Text>
          <Input label="Full Name" value={name} onChangeText={setName} autoCapitalize="words" />
          <Input
            label="Languages (comma separated)"
            value={languages}
            onChangeText={setLanguages}
            placeholder="English, Hindi, Marathi"
          />
          <View>
            <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.3 }}>
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
          <Button title="Save Changes" onPress={handleSave} loading={saving} />
        </Card>

        {/* Active Status Toggle */}
        {profile && (
          <Card style={{ marginTop: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ fontSize: 15, fontWeight: '600', color: theme.colors.text }}>
                Accepting Bookings
              </Text>
              <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 }}>
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
                backgroundColor: profile.is_active ? theme.colors.primary : '#E5E7EB',
                padding: 2,
                justifyContent: 'center',
              }}
            >
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: '#FFFFFF',
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
      </ScrollView>
    </View>
  );
}
