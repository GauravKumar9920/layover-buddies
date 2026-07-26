import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { updatePassword, signOut } from '@/lib/auth';
import { usePasswordRecovery } from '@/lib/stores/passwordRecovery';
import { theme } from '@/config/theme';
import { AuthShell } from '@/components/auth/AuthShell';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';
import { hapticError, hapticImpactLight, hapticSuccess, hapticWarning } from '@/lib/haptics';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const finishRecovery = usePasswordRecovery((s) => s.finish);
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  // The deep-link handler establishes the recovery session before routing here.
  // Confirm it actually landed — without a session updateUser() cannot run, so
  // we show a "request a new link" state instead of a form that can't submit.
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setHasSession(!!data.session);
      setChecking(false);
    });
    return () => { active = false; };
  }, []);

  async function handleUpdate() {
    if (password.length < 8) {
      hapticWarning();
      Alert.alert('Weak password', 'Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      hapticWarning();
      Alert.alert('Passwords don’t match', 'Please re-enter the same password in both fields.');
      return;
    }
    setLoading(true);
    hapticImpactLight();
    try {
      await updatePassword(password);
      hapticSuccess();
      // Clear the recovery flag LAST so the root navigator only re-routes once
      // the new password is committed; it then sends the (still signed-in) user
      // into the app automatically.
      await finishRecovery();
      Alert.alert('Password updated', 'Your password has been changed. You’re all set.');
    } catch (err: unknown) {
      hapticError();
      Alert.alert('Could not update password', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function backToSignIn() {
    // Abandon the recovery session cleanly so the user isn't left in a
    // half-authenticated state, then return to the login screen.
    await finishRecovery();
    await signOut().catch(() => { /* best-effort */ });
    router.replace('/(auth)/login');
  }

  if (checking) return <Loading fullScreen message="Verifying your reset link..." />;

  return (
    <AuthShell tagline="Set a new password">
      <Text style={{ ...theme.typography.h2, color: theme.colors.text, marginBottom: 4 }}>New password</Text>

      {hasSession ? (
        <>
          <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.textSecondary, fontSize: 13, marginBottom: 22, lineHeight: 19 }}>
            Choose a new password for your Detour account. You’ll stay signed in once it’s saved.
          </Text>

          <View style={{ gap: 14 }}>
            <Input
              label="New password"
              value={password}
              onChangeText={setPassword}
              placeholder="8+ characters"
              secureTextEntry
              autoComplete="password-new"
            />
            <Input
              label="Confirm password"
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Re-enter password"
              secureTextEntry
              autoComplete="password-new"
            />
          </View>

          <View style={{ marginTop: 20 }}>
            <Button title="Update password" onPress={handleUpdate} loading={loading} size="lg" />
          </View>
        </>
      ) : (
        <>
          <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.textSecondary, fontSize: 13, marginBottom: 22, lineHeight: 19 }}>
            This reset link has expired or was already used. Request a new one from the sign-in screen.
          </Text>
          <Button
            title="Request a new link"
            onPress={() => {
              void finishRecovery().finally(() => {
                router.replace('/(auth)/forgot-password');
              });
            }}
            size="lg"
          />
        </>
      )}

      <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 20 }}>
        <TouchableOpacity onPress={backToSignIn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={{ fontFamily: theme.fonts.bodyBold, color: theme.colors.primary, fontSize: 13 }}>Back to sign in</Text>
        </TouchableOpacity>
      </View>
    </AuthShell>
  );
}
