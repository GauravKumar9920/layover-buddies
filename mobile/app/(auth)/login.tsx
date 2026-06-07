import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { Link } from 'expo-router';
import { signIn } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/lib/hooks/useAuth';
import { theme } from '@/config/theme';
import { AuthShell } from '@/components/auth/AuthShell';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { hapticError, hapticImpactMedium, hapticSuccess, hapticWarning } from '@/lib/haptics';

function Banner({ tone, title, body }: { tone: 'warn' | 'error'; title: string; body: string }) {
  const c = tone === 'warn'
    ? { bg: theme.colors.gold + '1F', border: 'rgba(232,159,44,0.45)', fg: '#946312' }
    : { bg: theme.colors.primaryLight, border: 'rgba(192,57,43,0.4)', fg: '#8E2C20' };
  return (
    <View style={{ backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, borderRadius: theme.borderRadius.md, padding: 12, marginBottom: 18 }}>
      <Text style={{ fontFamily: theme.fonts.bodyBold, fontSize: 12, color: c.fg }}>{title}</Text>
      <Text style={{ fontFamily: theme.fonts.body, fontSize: 12, color: c.fg, opacity: 0.85, marginTop: 3, lineHeight: 18 }}>{body}</Text>
    </View>
  );
}

export default function LoginScreen() {
  const { bootstrapError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [bootstrapBanner, setBootstrapBanner] = useState<string | null>(bootstrapError);
  useEffect(() => { setBootstrapBanner(bootstrapError); }, [bootstrapError]);

  async function handleLogin() {
    if (!email.trim() || !password) {
      hapticWarning();
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    if (!isSupabaseConfigured) {
      Alert.alert('Setup required', 'Add your Supabase credentials to mobile/.env.local to enable sign in.', [{ text: 'Got it' }]);
      return;
    }
    setLoading(true);
    hapticImpactMedium();
    try {
      await signIn(email.trim(), password);
      hapticSuccess();
    } catch (err: unknown) {
      hapticError();
      Alert.alert('Sign in failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      {!isSupabaseConfigured && (
        <Banner tone="warn" title="Setup required" body="Copy .env.local.example → .env.local and add your Supabase keys." />
      )}
      {bootstrapBanner && (
        <Banner tone="error" title="Session notice" body={bootstrapBanner} />
      )}

      <Text style={{ ...theme.typography.h2, color: theme.colors.text, marginBottom: 4 }}>Welcome back</Text>
      <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.textSecondary, fontSize: 13, marginBottom: 22 }}>
        Sign in to your Detour account
      </Text>

      <View style={{ gap: 16 }}>
        <Input
          label="Email"
          value={email}
          onChangeText={(v) => { setEmail(v); setBootstrapBanner(null); }}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />

        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <Text style={{ ...theme.typography.eyebrow, color: theme.colors.textSecondary }}>Password</Text>
            <Link href="/(auth)/forgot-password" asChild>
              <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={{ fontFamily: theme.fonts.bodySemi, color: theme.colors.primary, fontSize: 12 }}>Forgot?</Text>
              </TouchableOpacity>
            </Link>
          </View>
          <Input
            value={password}
            onChangeText={(v) => { setPassword(v); setBootstrapBanner(null); }}
            placeholder="••••••••"
            secureTextEntry
            autoComplete="password"
          />
        </View>
      </View>

      <View style={{ marginTop: 22 }}>
        <Button title="Sign in" onPress={handleLogin} loading={loading} size="lg" />
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

      {/* Join as */}
      <View style={{ marginTop: 22 }}>
        <Text style={{ ...theme.typography.eyebrow, color: theme.colors.textMuted, textAlign: 'center', marginBottom: 10 }}>New here? Join as</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Link href="/(auth)/signup?role=traveler" asChild>
            <TouchableOpacity activeOpacity={0.85} style={{ flex: 1, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(45,123,169,0.55)', backgroundColor: theme.colors.accentLight, paddingVertical: 13, alignItems: 'center' }}>
              <Text style={{ fontFamily: theme.fonts.bodyBold, color: theme.colors.accentDark, fontSize: 13 }}>Traveler</Text>
            </TouchableOpacity>
          </Link>
          <Link href="/(auth)/signup?role=guide" asChild>
            <TouchableOpacity activeOpacity={0.85} style={{ flex: 1, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(200,84,42,0.55)', backgroundColor: theme.colors.primaryLight, paddingVertical: 13, alignItems: 'center' }}>
              <Text style={{ fontFamily: theme.fonts.bodyBold, color: theme.colors.primaryDark, fontSize: 13 }}>Guide</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </AuthShell>
  );
}
