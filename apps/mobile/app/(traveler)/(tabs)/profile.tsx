import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { format } from 'date-fns';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';
import { AccountActions } from '@/components/settings/AccountActions';
import { pickImage } from '@/lib/imagePicker';
import { uploadImage } from '@/lib/imageUpload';
import { supabase } from '@/lib/supabase';
import { signOut } from '@/lib/auth';
import {
  fetchMyTravelerProfile,
  updateMyTravelerProfile,
  type TravelerProfile,
} from '@/lib/api/travelerProfile';
import { useAuth } from '@/lib/hooks/useAuth';
import { theme } from '@/config/theme';

// Same interest taxonomy the onboarding screen uses, so chips here round-trip
// cleanly with what was saved at signup. Keys are lowercase to match storage.
const GENDERS: { key: string; label: string }[] = [
  { key: 'female', label: 'Female' },
  { key: 'male', label: 'Male' },
  { key: 'non_binary', label: 'Non-binary' },
  { key: 'prefer_not_to_say', label: 'Prefer not to say' },
];

const INTERESTS: { key: string; label: string; emoji: string }[] = [
  { key: 'food', label: 'Food & Street Eats', emoji: '🍜' },
  { key: 'history', label: 'History & Heritage', emoji: '📚' },
  { key: 'photography', label: 'Photography Spots', emoji: '📸' },
  { key: 'culture', label: 'Culture & Arts', emoji: '🎭' },
  { key: 'nightlife', label: 'Nightlife', emoji: '🌙' },
  { key: 'hidden gems', label: 'Hidden Gems', emoji: '💎' },
  { key: 'adventure', label: 'Adventure', emoji: '🧗' },
  { key: 'shopping', label: 'Shopping & Markets', emoji: '🛍️' },
  { key: 'architecture', label: 'Architecture', emoji: '🏛️' },
  { key: 'bollywood', label: 'Bollywood', emoji: '🎬' },
];

// Small mono uppercase label, reused for section eyebrows.
function Eyebrow({ children }: { children: string }) {
  return (
    <Text style={{
      fontFamily: theme.fonts.mono, fontSize: 11, letterSpacing: 1.2,
      textTransform: 'uppercase', color: theme.colors.textSecondary, marginBottom: 8,
    }}>
      {children}
    </Text>
  );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// arrival_at / departure_at are UTC instants representing an IST wall clock
// (see onboarding). Format them back as IST so travelers in other timezones
// see the same times they entered — not the device-local conversion.
function fmtDate(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const ist = new Date(d.getTime() + (5 * 60 + 30) * 60_000);
  const hh = String(ist.getUTCHours()).padStart(2, '0');
  const mm = String(ist.getUTCMinutes()).padStart(2, '0');
  return `${ist.getUTCDate()} ${MONTHS[ist.getUTCMonth()]}, ${hh}:${mm}`;
}

export default function TravelerProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [profile, setProfile] = useState<TravelerProfile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [name, setName] = useState('');
  const [nationality, setNationality] = useState('');
  const [gender, setGender] = useState<string | null>(null);
  const [language, setLanguage] = useState('');
  const [emName, setEmName] = useState('');
  const [emPhone, setEmPhone] = useState('');
  const [interests, setInterests] = useState<string[]>([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const [tp, authUser] = await Promise.all([
        fetchMyTravelerProfile().catch(() => null),
        supabase.auth.getUser().then((r) => r.data.user),
      ]);

      // Name + avatar live on the users table.
      let fullName = (authUser?.user_metadata?.full_name as string) ?? '';
      let avatar: string | null = (authUser?.user_metadata?.avatar_url as string) ?? null;
      if (authUser) {
        const { data: u } = await supabase
          .from('users')
          .select('full_name, avatar_url')
          .eq('id', authUser.id)
          .maybeSingle();
        if (u?.full_name) fullName = u.full_name;
        if (u?.avatar_url) avatar = u.avatar_url;
      }

      setProfile(tp);
      setAvatarUrl(avatar);
      setName(fullName);
      setNationality(tp?.nationality ?? '');
      setGender(tp?.gender ?? null);
      setLanguage(tp?.preferred_language ?? '');
      setEmName(tp?.emergency_contact_name ?? '');
      setEmPhone(tp?.emergency_contact_phone ?? '');
      setInterests(tp?.interests ?? []);
    } finally {
      setLoading(false);
    }
  }

  function toggleInterest(key: string) {
    setInterests((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateMyTravelerProfile({
        full_name: name.trim(),
        nationality: nationality.trim() || null,
        gender,
        preferred_language: language.trim() || null,
        emergency_contact_name: emName.trim() || null,
        emergency_contact_phone: emPhone.trim() || null,
        interests,
      });
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handlePickImage() {
    const picked = await pickImage({ aspect: [1, 1], quality: 0.7, allowsEditing: true });
    if (!picked) return;
    const authUser = (await supabase.auth.getUser()).data.user;
    if (!authUser) return;
    try {
      const ext = picked.fileName.split('.').pop() ?? 'jpg';
      const path = `avatars/${authUser.id}.${ext}`;
      const { publicUrl } = await uploadImage({
        blob: picked.blob,
        bucket: 'avatars',
        path,
        contentType: picked.mimeType,
        blobUri: picked.uri,
      });
      await updateMyTravelerProfile({ avatar_url: publicUrl });
      setAvatarUrl(publicUrl);
    } catch (err: unknown) {
      Alert.alert('Upload failed', err instanceof Error ? err.message : 'Unknown error');
    }
  }

  async function handleSignOut() {
    const ok = await new Promise<boolean>((resolve) => {
      Alert.alert('Sign out?', 'You can always sign back in.', [
        { text: 'Stay', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Sign out', style: 'destructive', onPress: () => resolve(true) },
      ], { onDismiss: () => resolve(false) });
    });
    if (ok) signOut();
  }

  if (loading) return <Loading fullScreen />;

  const initials = (name || 'T')
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const memberSince = user?.created_at ? format(new Date(user.created_at), 'MMM yyyy') : null;
  const arrival = fmtDate(profile?.arrival_at);
  const departure = fmtDate(profile?.departure_at);
  const hasLayover = Boolean(arrival || departure || profile?.flight_in || profile?.flight_out);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top }}>
      <Header title="My Profile" />
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Identity */}
        <View style={{ alignItems: 'center', marginBottom: 28 }}>
          <TouchableOpacity onPress={handlePickImage} activeOpacity={0.85}>
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={{ width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: theme.colors.primary }}
                contentFit="cover"
                transition={300}
              />
            ) : (
              <View style={{
                width: 96, height: 96, borderRadius: 48,
                backgroundColor: theme.colors.primaryLight,
                alignItems: 'center', justifyContent: 'center',
                borderWidth: 3, borderColor: theme.colors.primary,
              }}>
                <Text style={{ fontFamily: theme.fonts.display, fontSize: 34, color: theme.colors.primary }}>
                  {initials}
                </Text>
              </View>
            )}
            <View style={{
              position: 'absolute', bottom: 0, right: 0,
              backgroundColor: theme.colors.primary,
              borderWidth: 1.5, borderColor: theme.colors.surface,
              borderRadius: 14, padding: 6,
            }}>
              <Feather name="camera" size={13} color="#FCF7EA" />
            </View>
          </TouchableOpacity>

          <Text style={{
            fontFamily: theme.fonts.display, fontSize: 22, color: theme.colors.text,
            letterSpacing: -0.3, marginTop: 14,
          }}>
            {name || 'Traveler'}
          </Text>
          {user?.email && (
            <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 }}>
              {user.email}
            </Text>
          )}
          {memberSince && (
            <Text style={{
              fontFamily: theme.fonts.mono, fontSize: 10.5, letterSpacing: 0.6,
              textTransform: 'uppercase', color: theme.colors.textMuted, marginTop: 6,
            }}>
              Traveler since {memberSince}
            </Text>
          )}
        </View>

        {/* Your layover — read-only summary from onboarding */}
        {hasLayover && (
          <Card style={{ gap: 12, marginBottom: 16 }}>
            <Eyebrow>Your layover</Eyebrow>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <LayoverCell label="Arrive" value={arrival ?? '—'} />
              <LayoverCell label="Depart" value={departure ?? '—'} align="flex-end" />
            </View>
            {(profile?.flight_in || profile?.flight_out) && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <LayoverCell label="Flight in" value={profile?.flight_in ?? '—'} />
                <LayoverCell label="Flight out" value={profile?.flight_out ?? '—'} align="flex-end" />
              </View>
            )}
          </Card>
        )}

        {/* Editable basics */}
        <Card style={{ gap: 16 }}>
          <Text style={{ fontFamily: theme.fonts.display, fontSize: 18, color: theme.colors.text, letterSpacing: -0.3 }}>
            Edit profile
          </Text>
          <Input label="Full Name" value={name} onChangeText={setName} autoCapitalize="words" />

          {/* Gender */}
          <View>
            <Text style={{ fontFamily: theme.fonts.mono, fontSize: 11, color: theme.colors.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1.2 }}>
              Gender
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {GENDERS.map((g) => {
                const active = gender === g.key;
                return (
                  <TouchableOpacity
                    key={g.key}
                    onPress={() => setGender(active ? null : g.key)}
                    activeOpacity={0.8}
                    style={{
                      paddingHorizontal: 13, paddingVertical: 8,
                      borderRadius: theme.borderRadius.full,
                      backgroundColor: active ? theme.colors.primary : theme.colors.surface,
                      borderWidth: 1.5,
                      borderColor: active ? theme.colors.primaryDark : 'rgba(14,25,41,0.14)',
                    }}
                  >
                    <Text style={{ fontFamily: theme.fonts.bodySemi, fontSize: 12.5, color: active ? '#FCF7EA' : theme.colors.textSecondary }}>
                      {g.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <Input
            label="Nationality"
            value={nationality}
            onChangeText={setNationality}
            placeholder="e.g. United States"
            autoCapitalize="words"
          />
          <Input
            label="Preferred Language"
            value={language}
            onChangeText={setLanguage}
            placeholder="e.g. English"
            autoCapitalize="words"
          />
        </Card>

        {/* Emergency contact */}
        <Card style={{ gap: 16, marginTop: 16 }}>
          <View>
            <Text style={{ fontFamily: theme.fonts.display, fontSize: 18, color: theme.colors.text, letterSpacing: -0.3 }}>
              Emergency contact
            </Text>
            <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textSecondary, marginTop: 4, lineHeight: 18 }}>
              Shared with your guide only during an active trip.
            </Text>
          </View>
          <Input label="Contact Name" value={emName} onChangeText={setEmName} autoCapitalize="words" />
          <Input label="Contact Phone" value={emPhone} onChangeText={setEmPhone} keyboardType="phone-pad" />
        </Card>

        {/* Interests */}
        <Card style={{ gap: 14, marginTop: 16 }}>
          <View>
            <Text style={{ fontFamily: theme.fonts.display, fontSize: 18, color: theme.colors.text, letterSpacing: -0.3 }}>
              Interests
            </Text>
            <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textSecondary, marginTop: 4, lineHeight: 18 }}>
              We use these to rank guides who match your vibe.
            </Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {INTERESTS.map((it) => {
              const active = interests.includes(it.key);
              return (
                <TouchableOpacity
                  key={it.key}
                  onPress={() => toggleInterest(it.key)}
                  activeOpacity={0.8}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    paddingHorizontal: 12, paddingVertical: 8,
                    borderRadius: theme.borderRadius.full,
                    backgroundColor: active ? theme.colors.primary : theme.colors.surface,
                    borderWidth: 1.5,
                    borderColor: active ? theme.colors.primaryDark : 'rgba(14,25,41,0.14)',
                  }}
                >
                  <Text style={{ fontSize: 14 }}>{it.emoji}</Text>
                  <Text style={{
                    fontFamily: theme.fonts.bodySemi, fontSize: 12,
                    color: active ? '#FCF7EA' : theme.colors.textSecondary,
                  }}>
                    {it.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        <Button title="Save Changes" onPress={handleSave} loading={saving} style={{ marginTop: 16 }} />

        {/* Quick links */}
        <Card style={{ marginTop: 16, padding: 0, overflow: 'hidden' }}>
          <LinkRow icon="bookmark" label="Saved guides" onPress={() => router.push('/(traveler)/(tabs)/saved')} />
          <View style={{ height: 1, backgroundColor: 'rgba(14,25,41,0.08)' }} />
          <LinkRow icon="briefcase" label="My trips" onPress={() => router.push('/(traveler)/(tabs)/trips')} />
          <View style={{ height: 1, backgroundColor: 'rgba(14,25,41,0.08)' }} />
          <LinkRow icon="message-circle" label="Chats" onPress={() => router.push('/(traveler)/(tabs)/messages')} />
        </Card>

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

function LayoverCell({ label, value, align = 'flex-start' }: { label: string; value: string; align?: 'flex-start' | 'flex-end' }) {
  return (
    <View style={{ alignItems: align }}>
      <Text style={{
        fontFamily: theme.fonts.mono, fontSize: 10, letterSpacing: 0.6,
        textTransform: 'uppercase', color: theme.colors.textMuted,
      }}>
        {label}
      </Text>
      <Text style={{ fontFamily: theme.fonts.monoMed, fontSize: 14, color: theme.colors.text, marginTop: 3 }}>
        {value}
      </Text>
    </View>
  );
}

function LinkRow({ icon, label, onPress }: { icon: React.ComponentProps<typeof Feather>['name']; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 16 }}
    >
      <Feather name={icon} size={18} color={theme.colors.primary} />
      <Text style={{ flex: 1, fontFamily: theme.fonts.bodySemi, fontSize: 15, color: theme.colors.text }}>
        {label}
      </Text>
      <Feather name="chevron-right" size={18} color={theme.colors.textMuted} />
    </TouchableOpacity>
  );
}
