import { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { resetPassword } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase';
import { theme } from '@/config/theme';
import { AuthShell } from '@/components/auth/AuthShell';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { hapticError, hapticImpactLight, hapticSuccess, hapticWarning } from '@/lib/haptics';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleResetPassword() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      hapticWarning();
      Alert.alert('Email required', 'Please enter the email for your account.');
      return;
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(normalizedEmail)) {
      hapticWarning();
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }
    if (!isSupabaseConfigured) {
      Alert.alert('Setup required', 'Add your Supabase credentials in mobile/.env.local before using password reset.');
      return;
    }
    setLoading(true);
    hapticImpactLight();
    try {
      await resetPassword(normalizedEmail);
      setSent(true);
      hapticSuccess();
    } catch (err: unknown) {
      hapticError();
      Alert.alert('Reset failed', err instanceof Error ? err.message : 'Could not send reset link.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell tagline="Reset your password">
      <Text style={{ ...theme.typography.h2, color: theme.colors.text, marginBottom: 4 }}>Reset password</Text>
      <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.textSecondary, fontSize: 13, marginBottom: 22, lineHeight: 19 }}>
        Enter your account email and we’ll send a password reset link.
      </Text>

      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
      />

      <View style={{ marginTop: 18 }}>
        <Button title="Send reset link" onPress={handleResetPassword} loading={loading} size="lg" />
      </View>

      {sent && (
        <View style={{ marginTop: 16, borderRadius: theme.borderRadius.md, borderWidth: 1, borderColor: 'rgba(61,139,90,0.45)', backgroundColor: 'rgba(61,139,90,0.12)', padding: 12 }}>
          <Text style={{ fontFamily: theme.fonts.body, color: '#2F6E45', fontSize: 13, lineHeight: 19 }}>
            Reset link sent. Check your inbox (and spam folder) for next steps.
          </Text>
        </View>
      )}

      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20, gap: 8 }}>
        <TouchableOpacity onPress={() => router.replace('/(auth)/login')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={{ fontFamily: theme.fonts.bodyBold, color: theme.colors.primary, fontSize: 13 }}>Back to sign in</Text>
        </TouchableOpacity>
        <Text style={{ fontFamily: theme.fonts.mono, color: theme.colors.textMuted, fontSize: 12 }}>·</Text>
        <Link href="/(auth)/signup" asChild>
          <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={{ fontFamily: theme.fonts.bodyBold, color: theme.colors.accent, fontSize: 13 }}>Create account</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </AuthShell>
  );
}
