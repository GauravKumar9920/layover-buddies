import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { resetPassword } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase';
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
      Alert.alert('Setup Required', 'Add your Supabase credentials in mobile/.env.local before using password reset.');
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
    <View style={{ flex: 1, backgroundColor: '#051718' }}>
      <LinearGradient
        colors={['#0D7377', '#095456', '#1A1A2E']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingHorizontal: 24,
            paddingVertical: 40,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ width: '100%', maxWidth: 420, alignSelf: 'center' }}>
            <View
              style={{
                borderRadius: 24,
                padding: 24,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.16)',
                backgroundColor: 'rgba(8,28,32,0.78)',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 18 },
                shadowOpacity: 0.45,
                shadowRadius: 24,
                elevation: 18,
              }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '800', letterSpacing: -0.4 }}>
                Reset Password
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, marginTop: 8, lineHeight: 20 }}>
                Enter your account email and we will send a password reset link.
              </Text>

              <View style={{ marginTop: 22 }}>
                <Text
                  style={{
                    color: 'rgba(255,255,255,0.55)',
                    fontSize: 11,
                    fontWeight: '700',
                    letterSpacing: 0.7,
                    textTransform: 'uppercase',
                    marginBottom: 8,
                  }}
                >
                  Email
                </Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor="rgba(255,255,255,0.28)"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.18)',
                    color: '#FFFFFF',
                    fontSize: 15,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    ...(Platform.OS === 'web' ? ({ outline: 'none' } as any) : {}),
                  }}
                />
              </View>

              <TouchableOpacity
                onPress={handleResetPassword}
                disabled={loading}
                activeOpacity={0.85}
                style={{ marginTop: 18 }}
              >
                <LinearGradient
                  colors={['#FF6B6B', '#F5A623']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    borderRadius: 14,
                    paddingVertical: 15,
                    alignItems: 'center',
                    shadowColor: '#FF6B6B',
                    shadowOffset: { width: 0, height: 10 },
                    shadowOpacity: 0.5,
                    shadowRadius: 20,
                    elevation: 12,
                  }}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>Send Reset Link</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {sent && (
                <View
                  style={{
                    marginTop: 16,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: 'rgba(39,174,96,0.45)',
                    backgroundColor: 'rgba(39,174,96,0.14)',
                    padding: 12,
                  }}
                >
                  <Text style={{ color: '#B7F5CE', fontSize: 13, lineHeight: 19 }}>
                    Reset link sent. Check your inbox (and spam folder) for next steps.
                  </Text>
                </View>
              )}

              <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20, gap: 6 }}>
                <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
                  <Text style={{ color: '#3FA796', fontSize: 13, fontWeight: '700' }}>Back to Sign In</Text>
                </TouchableOpacity>
                <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>or</Text>
                <Link href="/(auth)/signup" asChild>
                  <TouchableOpacity>
                    <Text style={{ color: '#FF6B6B', fontSize: 13, fontWeight: '700' }}>Create account</Text>
                  </TouchableOpacity>
                </Link>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
