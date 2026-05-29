import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { signUp } from '@/lib/auth';
import type { UserRole } from '@/types';
import { isSupabaseConfigured } from '@/lib/supabase';
import { hapticError, hapticImpactMedium, hapticSuccess, hapticWarning } from '@/lib/haptics';

// ─── Photo data ───
const PHOTOS = [
  'https://images.unsplash.com/photo-1567157577867-05ccb1388e66?w=300&h=400&fit=crop&q=75',
  'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?w=300&h=220&fit=crop&q=75',
  'https://images.unsplash.com/photo-1529253355930-ddbe423a2ac7?w=260&h=360&fit=crop&q=75',
  'https://images.unsplash.com/photo-1595658658481-d53d3f999875?w=280&h=200&fit=crop&q=75',
  'https://images.unsplash.com/photo-1611270629569-8b357cb88da9?w=300&h=400&fit=crop&q=75',
  'https://images.unsplash.com/photo-1576502200916-3808e07386a5?w=240&h=320&fit=crop&q=75',
  'https://images.unsplash.com/photo-1548013146-72479768bada?w=260&h=180&fit=crop&q=75',
  'https://images.unsplash.com/photo-1586500036706-41963de24d8b?w=220&h=300&fit=crop&q=75',
  'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=280&h=360&fit=crop&q=75',
  'https://images.unsplash.com/photo-1477587458883-47145ed94245?w=300&h=200&fit=crop&q=75',
];

// Percentage-based positions — anchor from edges
const LAYOUT = [
  // Left edge
  { x: -6,  y: 2,   w: 145, h: 200, rot: -8,  anchor: 'TL', delay: 0,    dur: 6200 },
  { x: -5,  y: 40,  w: 125, h: 170, rot: 7,   anchor: 'TL', delay: 2100, dur: 5800 },
  { x: 3,   y: 86,  w: 150, h: 110, rot: -5,  anchor: 'TL', delay: 800,  dur: 8300 },
  // Right edge
  { x: -5,  y: 6,   w: 170, h: 125, rot: 5,   anchor: 'TR', delay: 1300, dur: 7100 },
  { x: -7,  y: 58,  w: 112, h: 150, rot: -7,  anchor: 'TR', delay: 1900, dur: 6700 },
  { x: -6,  y: 86,  w: 140, h: 186, rot: 8,   anchor: 'TR', delay: 3200, dur: 7500 },
  // Top centre
  { x: 28,  y: -1,  w: 125, h: 90,  rot: 3,   anchor: 'TL', delay: 2800, dur: 9100 },
  { x: 56,  y: -2,  w: 110, h: 80,  rot: -4,  anchor: 'TL', delay: 4100, dur: 6400 },
  // Bottom centre
  { x: 22,  y: 93,  w: 115, h: 85,  rot: -3,  anchor: 'TL', delay: 3500, dur: 8000 },
  { x: 53,  y: 91,  w: 100, h: 135, rot: 4,   anchor: 'TL', delay: 1500, dur: 6900 },
] as const;

function FloatingPhoto({ uri, style: posStyle, w, h, rot, delay, dur }: {
  uri: string; style: Record<string, number>; w: number; h: number;
  rot: number; delay: number; dur: number;
}) {
  const ty = useSharedValue(0);
  useEffect(() => {
    ty.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(-10, { duration: dur / 2, easing: Easing.inOut(Easing.sin) }),
        withTiming(0,   { duration: dur / 2, easing: Easing.inOut(Easing.sin) }),
      ), -1, false,
    ));
  }, []);
  const anim = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot}deg` }, { translateY: ty.value }],
  }));
  return (
    <Animated.View style={[{
      position: 'absolute', borderRadius: 16, overflow: 'hidden',
      shadowColor: '#000', shadowOffset: { width: 0, height: 14 },
      shadowOpacity: 0.60, shadowRadius: 20, elevation: 18,
      ...posStyle,
    }, anim]}>
      <Image source={{ uri }} style={{ width: w, height: h }} contentFit="cover" />
    </Animated.View>
  );
}

function getRoleFromParam(value: string | string[] | undefined): UserRole | null {
  const first = Array.isArray(value) ? value[0] : value;
  if (first === 'guide' || first === 'traveler') return first;
  return null;
}

export default function SignUpScreen() {
  const router                  = useRouter();
  const { width: W, height: H } = useWindowDimensions();
  const { role: roleParam }     = useLocalSearchParams<{ role?: string | string[] }>();
  const [role, setRole]         = useState<UserRole>(() => getRoleFromParam(roleParam) ?? 'traveler');
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [focused, setFocused]   = useState<string | null>(null);

  const cardY       = useSharedValue(50);
  const cardOpacity = useSharedValue(0);
  useEffect(() => {
    cardY.value       = withSpring(0, { damping: 18, stiffness: 100 });
    cardOpacity.value = withTiming(1, { duration: 700 });
  }, []);

  useEffect(() => {
    const nextRole = getRoleFromParam(roleParam);
    if (nextRole) {
      setRole(nextRole);
    }
  }, [roleParam]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: cardY.value }],
    opacity: cardOpacity.value,
  }));

  const photoProps = useMemo(() => LAYOUT.map((cfg, i) => {
    const pos: Record<string, number> = {};
    const pxX = (cfg.x / 100) * W;
    const pxY = (cfg.y / 100) * H;
    if (cfg.anchor === 'TL') { pos.left = pxX; pos.top = pxY; }
    else if (cfg.anchor === 'TR') { pos.right = -pxX; pos.top = pxY; }
    const scale = Math.min(1, 420 / W);
    const w = Math.min(cfg.w, 180) * (1 + scale * 0.1);
    const h = Math.min(cfg.h, 220) * (1 + scale * 0.1);
    return { uri: PHOTOS[i], style: pos, w, h, rot: cfg.rot, delay: cfg.delay, dur: cfg.dur };
  }), [W, H]);

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
      Alert.alert('⚙️ Setup Required', 'Add your Supabase credentials to mobile/.env.local to enable sign up.', [{ text: 'Got it' }]);
      return;
    }
    setLoading(true);
    hapticImpactMedium();
    try {
      await signUp(email.trim(), password, name.trim(), role);
      hapticSuccess();
      // Show the "check your email" message (single-button Alert.alert works
      // fine on RN-Web — it's only multi-button that's broken) and then
      // route to the login screen so the user has a clear next step.
      // Previously the modal closed and we left them stranded on the now-
      // populated signup form, looking like nothing had happened.
      if (Platform.OS === 'web') {
        window.alert("Almost there! Check your email to confirm your account, then sign in.");
        router.replace('/(auth)/login');
      } else {
        Alert.alert(
          '🎉 Almost there!',
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

  const inputStyle = (field: string) => ({
    backgroundColor: focused === field ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: focused === field ? 'rgba(249,115,22,0.85)' : 'rgba(255,255,255,0.14)',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    color: '#FFFFFF' as const, fontSize: 15,
    ...(Platform.OS === 'web' ? { outline: 'none' } as any : {}),
  });

  return (
    <View style={{ flex: 1, backgroundColor: '#0B1229' }}>
      {photoProps.map((p, i) => <FloatingPhoto key={i} {...p} />)}

      {/* Coral-tinted overlay for signup */}
      <LinearGradient
        colors={['rgba(249,115,22,0.22)', 'rgba(11,18,41,0.55)', 'rgba(11,18,41,0.60)', 'rgba(11,18,41,0.96)']}
        locations={[0, 0.28, 0.62, 1]}
        start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 48 }}
          keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
        >
          <View style={{ width: '100%', maxWidth: 420 }}>
            {/* Logo */}
            <View style={{ alignItems: 'center', marginBottom: 28 }}>
              <View style={{
                width: 60, height: 60, borderRadius: 20,
                backgroundColor: 'rgba(249,115,22,0.92)', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
                shadowColor: '#F97316', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.55, shadowRadius: 24, elevation: 18,
              }}>
                <Text style={{ fontSize: 30 }}>🗺️</Text>
              </View>
              <Text style={{ color: '#FFFFFF', fontSize: 28, fontWeight: '800', letterSpacing: -0.5 }}>Detour</Text>
              <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, marginTop: 5 }}>Your local guide awaits</Text>
            </View>

            {/* Glass card */}
            <Animated.View style={[{
              borderRadius: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
              padding: 28, backgroundColor: 'rgba(10,30,35,0.78)',
              shadowColor: '#000', shadowOffset: { width: 0, height: 24 }, shadowOpacity: 0.55, shadowRadius: 40, elevation: 30,
              ...(Platform.OS === 'web' ? { backdropFilter: 'blur(40px) saturate(180%)', WebkitBackdropFilter: 'blur(40px) saturate(180%)' } as any : {}),
            }, cardStyle]}>

              <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '700', letterSpacing: -0.3, marginBottom: 4 }}>Create your account</Text>
              <Text style={{ color: 'rgba(255,255,255,0.40)', fontSize: 13, marginBottom: 22 }}>Join thousands exploring Mumbai like a local</Text>

              {/* Role selector */}
              <View style={{ marginBottom: 22 }}>
                <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 }}>I am joining as a…</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {([
                    { value: 'traveler' as UserRole, emoji: '🧳', title: 'Traveler', sub: 'I\'m on a layover' },
                    { value: 'guide' as UserRole, emoji: '🎓', title: 'Guide', sub: 'I\'m a student guide' },
                  ] as const).map(({ value, emoji, title, sub }) => {
                    const active = role === value;
                    return (
                      <TouchableOpacity
                        key={value}
                        onPress={() => setRole(value)}
                        activeOpacity={0.8}
                        style={{
                          flex: 1,
                          borderRadius: 14,
                          borderWidth: active ? 2 : 1,
                          borderColor: active ? '#F97316' : 'rgba(255,255,255,0.14)',
                          backgroundColor: active ? 'rgba(249,115,22,0.18)' : 'rgba(255,255,255,0.05)',
                          paddingVertical: 14,
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <Text style={{ fontSize: 28 }}>{emoji}</Text>
                        <Text style={{ color: active ? '#F97316' : '#FFFFFF', fontSize: 14, fontWeight: '700' }}>{title}</Text>
                        <Text style={{ color: 'rgba(255,255,255,0.40)', fontSize: 11, textAlign: 'center' }}>{sub}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Full Name */}
              <View style={{ marginBottom: 14 }}>
                <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>Full Name</Text>
                <TextInput value={name} onChangeText={setName} placeholder="Priya Sharma" placeholderTextColor="rgba(255,255,255,0.28)"
                  autoCapitalize="words" autoComplete="name"
                  style={inputStyle('name')} onFocus={() => setFocused('name')} onBlur={() => setFocused(null)} />
              </View>

              {/* Email */}
              <View style={{ marginBottom: 14 }}>
                <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>Email</Text>
                <TextInput value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor="rgba(255,255,255,0.28)"
                  keyboardType="email-address" autoCapitalize="none" autoComplete="email"
                  style={inputStyle('email')} onFocus={() => setFocused('email')} onBlur={() => setFocused(null)} />
              </View>

              {/* Password */}
              <View style={{ marginBottom: 6 }}>
                <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>Password</Text>
                <TextInput value={password} onChangeText={setPassword} placeholder="8+ characters" placeholderTextColor="rgba(255,255,255,0.28)"
                  secureTextEntry autoComplete="password"
                  style={inputStyle('password')} onFocus={() => setFocused('password')} onBlur={() => setFocused(null)} />
              </View>

              {/* Join CTA */}
              <TouchableOpacity onPress={handleSignUp} disabled={loading} activeOpacity={0.85} style={{ marginTop: 24 }}>
                <LinearGradient colors={['#F97316', '#EC4899']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={{ borderRadius: 14, paddingVertical: 16, alignItems: 'center', shadowColor: '#F97316', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.45, shadowRadius: 22, elevation: 14 }}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Join Detour</Text>}
                </LinearGradient>
              </TouchableOpacity>

              {/* Divider */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 20 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.10)' }} />
                <Text style={{ color: 'rgba(255,255,255,0.28)', fontSize: 12, marginHorizontal: 12 }}>or</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.10)' }} />
              </View>

              {/* Google */}
              <TouchableOpacity onPress={() => Alert.alert('Coming soon', 'Google sign-in will be available soon!')} activeOpacity={0.8}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.06)' }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#4285F4', fontSize: 13, fontWeight: '800' }}>G</Text>
                </View>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Continue with Google</Text>
              </TouchableOpacity>

              {/* Sign in link */}
              <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 22, gap: 4 }}>
                <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>Already have an account?</Text>
                <Link href="/(auth)/login" asChild>
                  <TouchableOpacity><Text style={{ color: '#F97316', fontSize: 13, fontWeight: '700' }}>Sign In</Text></TouchableOpacity>
                </Link>
              </View>

              <Text style={{ color: 'rgba(255,255,255,0.18)', fontSize: 11, textAlign: 'center', marginTop: 14, lineHeight: 17 }}>
                By joining you agree to our Terms of Service & Privacy Policy.
              </Text>
            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
