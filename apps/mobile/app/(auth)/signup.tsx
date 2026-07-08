import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Platform, Alert, Linking } from 'react-native';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { signUp } from '@/lib/auth';
import type { UserRole } from '@/types';
import { isSupabaseConfigured } from '@/lib/supabase';
import { LEGAL } from '@/config/constants';
import { theme } from '@/config/theme';
import { AuthShell } from '@/components/auth/AuthShell';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { hapticError, hapticImpactMedium, hapticSuccess, hapticWarning } from '@/lib/haptics';

function getRoleFromParam(value: string | string[] | undefined): UserRole | null {
  const first = Array.isArray(value) ? value[0] : value;
  if (first === 'guide' || first === 'traveler') return first;
  return null;
}

const ROLES = [
  { value: 'traveler' as UserRole, title: 'Traveler', sub: "I'm on a layover", tint: theme.colors.accent, tintBg: theme.colors.accentLight, tintFg: theme.colors.accentDark },
  { value: 'guide' as UserRole, title: 'Guide', sub: "I'm a student guide", tint: theme.colors.primary, tintBg: theme.colors.primaryLight, tintFg: theme.colors.primaryDark },
];

export default function SignUpScreen() {
  const router = useRouter();
  const { role: roleParam } = useLocalSearchParams<{ role?: string | string[] }>();
  const [role, setRole] = useState<UserRole>(() => getRoleFromParam(roleParam) ?? 'traveler');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const nextRole = getRoleFromParam(roleParam);
    if (nextRole) setRole(nextRole);
  }, [roleParam]);

  async function handleSignUp() {
    if (!name.trim() || !email.trim() || !password) {
      hapticWarning();
      Alert.alert('Missing fields', 'Please fill in all fields.');
      return;
    }
    if (password.length < 8) {
      hapticWarning();
      Alert.alert('Weak password', 'Password must be at least 8 characters.');
      return;
    }
    if (!isSupabaseConfigured) {
      Alert.alert('Setup required', 'Add your Supabase credentials to mobile/.env.local to enable sign up.', [{ text: 'Got it' }]);
      return;
    }
    setLoading(true);
    hapticImpactMedium();
    try {
      await signUp(email.trim(), password, name.trim(), role);
      hapticSuccess();
      if (Platform.OS === 'web') {
        window.alert('Almost there! Check your email to confirm your account, then sign in.');
        router.replace('/(auth)/login');
      } else {
        Alert.alert(
          'Almost there!',
          'Check your email to confirm your account, then sign in.',
          [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }],
          { onDismiss: () => router.replace('/(auth)/login') },
        );
      }
    } catch (err: unknown) {
      hapticError();
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (Platform.OS === 'web') window.alert(`Sign up failed: ${msg}`);
      else Alert.alert('Sign up failed', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <Text style={{ ...theme.typography.h2, color: theme.colors.text, marginBottom: 4 }}>Create your account</Text>
      <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.textSecondary, fontSize: 13, marginBottom: 20 }}>
        Join thousands exploring Mumbai like a local
      </Text>

      {/* Role selector */}
      <Text style={{ ...theme.typography.eyebrow, color: theme.colors.textSecondary, marginBottom: 10 }}>I am joining as a…</Text>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
        {ROLES.map(({ value, title, sub, tint, tintBg, tintFg }) => {
          const active = role === value;
          return (
            <TouchableOpacity
              key={value}
              onPress={() => { hapticImpactMedium(); setRole(value); }}
              activeOpacity={0.85}
              style={{
                flex: 1,
                borderRadius: theme.borderRadius.md,
                borderWidth: active ? 2 : 1.5,
                borderColor: active ? tint : 'rgba(14,25,41,0.14)',
                backgroundColor: active ? tintBg : theme.colors.background,
                paddingVertical: 16,
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Text style={{ fontFamily: theme.fonts.display, color: active ? tintFg : theme.colors.text, fontSize: 16 }}>{title}</Text>
              <Text style={{ fontFamily: theme.fonts.mono, color: theme.colors.textMuted, fontSize: 10, letterSpacing: 0.3, textAlign: 'center' }}>{sub}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={{ gap: 14 }}>
        <Input label="Full name" value={name} onChangeText={setName} placeholder="Priya Sharma" autoCapitalize="words" autoComplete="name" />
        <Input label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
        <Input label="Password" value={password} onChangeText={setPassword} placeholder="8+ characters" secureTextEntry autoComplete="password" />
      </View>

      <View style={{ marginTop: 22 }}>
        <Button title="Join Detour" onPress={handleSignUp} loading={loading} size="lg" />
      </View>

      {/* Divider */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 20 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(14,25,41,0.12)' }} />
        <Text style={{ fontFamily: theme.fonts.mono, color: theme.colors.textMuted, fontSize: 11, letterSpacing: 1, marginHorizontal: 12 }}>OR</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(14,25,41,0.12)' }} />
      </View>

      <Button
        title="Continue with Google"
        onPress={() => Alert.alert('Coming soon', 'Google sign-in will be available soon!')}
        variant="secondary"
        size="lg"
        icon={
          <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: 'rgba(14,25,41,0.15)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#4285F4', fontSize: 12, fontWeight: '800' }}>G</Text>
          </View>
        }
      />

      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 22, gap: 5 }}>
        <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.textSecondary, fontSize: 13 }}>Already have an account?</Text>
        <Link href="/(auth)/login" asChild>
          <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={{ fontFamily: theme.fonts.bodyBold, color: theme.colors.primary, fontSize: 13 }}>Sign in</Text>
          </TouchableOpacity>
        </Link>
      </View>

      <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 14, lineHeight: 17 }}>
        By joining you agree to our{' '}
        <Text
          style={{ color: theme.colors.primary, textDecorationLine: 'underline' }}
          onPress={() => Linking.openURL(LEGAL.termsUrl).catch(() => {})}
        >
          Terms of Service
        </Text>
        {' & '}
        <Text
          style={{ color: theme.colors.primary, textDecorationLine: 'underline' }}
          onPress={() => Linking.openURL(LEGAL.privacyUrl).catch(() => {})}
        >
          Privacy Policy
        </Text>
        .
      </Text>
    </AuthShell>
  );
}
