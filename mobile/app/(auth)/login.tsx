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
import { Link } from 'expo-router';
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
import { signIn } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/lib/hooks/useAuth';
import { hapticError, hapticImpactMedium, hapticSuccess, hapticWarning } from '@/lib/haptics';

// ─── Photo data ───
// Unsplash Mumbai photos — small fetch sizes for fast loads
const PHOTOS = [
  'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?w=300&h=400&fit=crop&q=75', // Marine Drive
  'https://images.unsplash.com/photo-1567157577867-05ccb1388e66?w=300&h=220&fit=crop&q=75', // Gateway
  'https://images.unsplash.com/photo-1611270629569-8b357cb88da9?w=260&h=360&fit=crop&q=75', // Street scene
  'https://images.unsplash.com/photo-1529253355930-ddbe423a2ac7?w=280&h=200&fit=crop&q=75', // Train
  'https://images.unsplash.com/photo-1595658658481-d53d3f999875?w=300&h=400&fit=crop&q=75', // Skyline
  'https://images.unsplash.com/photo-1576502200916-3808e07386a5?w=240&h=320&fit=crop&q=75', // Haji Ali
  'https://images.unsplash.com/photo-1548013146-72479768bada?w=260&h=180&fit=crop&q=75', // Bandra
  'https://images.unsplash.com/photo-1586500036706-41963de24d8b?w=220&h=300&fit=crop&q=75', // Market
  'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=280&h=360&fit=crop&q=75', // India Gate style
  'https://images.unsplash.com/photo-1477587458883-47145ed94245?w=300&h=200&fit=crop&q=75', // Coastal city
];

// Positions as percentages of viewport — images poke in from all edges
// x/y are percentage offsets from the anchor edge
const LAYOUT = [
  // Left edge
  { x: -8,  y: 3,   w: 140, h: 190, rot: -7,  anchor: 'TL', delay: 0,    dur: 7200 },
  { x: -6,  y: 42,  w: 120, h: 165, rot: 8,   anchor: 'TL', delay: 2400, dur: 5800 },
  { x: 2,   y: 88,  w: 145, h: 108, rot: -5,  anchor: 'TL', delay: 700,  dur: 8600 },
  // Right edge
  { x: -6,  y: 5,   w: 165, h: 120, rot: 6,   anchor: 'TR', delay: 1100, dur: 6400 },
  { x: -5,  y: 60,  w: 108, h: 144, rot: -8,  anchor: 'TR', delay: 1700, dur: 7100 },
  { x: -8,  y: 88,  w: 135, h: 180, rot: 7,   anchor: 'TR', delay: 3400, dur: 6800 },
  // Top centre
  { x: 30,  y: -2,  w: 130, h: 95,  rot: 4,   anchor: 'TL', delay: 2800, dur: 8700 },
  { x: 58,  y: -1,  w: 115, h: 85,  rot: -3,  anchor: 'TL', delay: 4000, dur: 9200 },
  // Bottom centre
  { x: 25,  y: 92,  w: 120, h: 88,  rot: -4,  anchor: 'TL', delay: 3600, dur: 7800 },
  { x: 55,  y: 90,  w: 105, h: 140, rot: 5,   anchor: 'TL', delay: 1400, dur: 6500 },
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

export default function LoginScreen() {
  const { width: W, height: H } = useWindowDimensions();
  const { bootstrapError } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [focused, setFocused]   = useState<string | null>(null);
  // Mirror bootstrapError into local state so we can dismiss it on input
  // without needing a setter on useAuth. Re-syncs whenever bootstrapError changes.
  const [bootstrapBanner, setBootstrapBanner] = useState<string | null>(bootstrapError);
  useEffect(() => { setBootstrapBanner(bootstrapError); }, [bootstrapError]);

  // Card entrance
  const cardY       = useSharedValue(50);
  const cardOpacity = useSharedValue(0);
  useEffect(() => {
    cardY.value       = withSpring(0, { damping: 18, stiffness: 100 });
    cardOpacity.value = withTiming(1, { duration: 700 });
  }, []);
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: cardY.value }],
    opacity: cardOpacity.value,
  }));

  // Build absolute positions from percentage-based layout
  const photoProps = useMemo(() => LAYOUT.map((cfg, i) => {
    const pos: Record<string, number> = {};
    const pxX = (cfg.x / 100) * W;
    const pxY = (cfg.y / 100) * H;
    if (cfg.anchor === 'TL') { pos.left = pxX; pos.top = pxY; }
    else if (cfg.anchor === 'TR') { pos.right = -pxX; pos.top = pxY; }
    // Clamp photo size — never bigger than 180px wide
    const scale = Math.min(1, 420 / W); // shrink on phones, 1:1 on desktop
    const w = Math.min(cfg.w, 180) * (1 + scale * 0.1);
    const h = Math.min(cfg.h, 220) * (1 + scale * 0.1);
    return { uri: PHOTOS[i], style: pos, w, h, rot: cfg.rot, delay: cfg.delay, dur: cfg.dur };
  }), [W, H]);

  async function handleLogin() {
    if (!email.trim() || !password) {
      hapticWarning();
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    if (!isSupabaseConfigured) {
      Alert.alert('⚙️ Setup Required', 'Add your Supabase credentials to mobile/.env.local to enable sign in.', [{ text: 'Got it' }]);
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
      {/* Floating Mumbai photos — 10 images distributed around edges */}
      {photoProps.map((p, i) => <FloatingPhoto key={i} {...p} />)}

      {/* Gradient overlay — subtle saffron hint at top, deep navy at bottom */}
      <LinearGradient
        colors={['rgba(249,115,22,0.18)', 'rgba(11,18,41,0.50)', 'rgba(11,18,41,0.60)', 'rgba(11,18,41,0.96)']}
        locations={[0, 0.30, 0.60, 1]}
        start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 48 }}
          keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
        >
          <View style={{ width: '100%', maxWidth: 420 }}>
            {/* Logo */}
            <View style={{ alignItems: 'center', marginBottom: 32 }}>
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
              padding: 28, backgroundColor: 'rgba(8,28,32,0.78)',
              shadowColor: '#000', shadowOffset: { width: 0, height: 24 }, shadowOpacity: 0.55, shadowRadius: 40, elevation: 30,
              ...(Platform.OS === 'web' ? { backdropFilter: 'blur(40px) saturate(180%)', WebkitBackdropFilter: 'blur(40px) saturate(180%)' } as any : {}),
            }, cardStyle]}>

              {!isSupabaseConfigured && (
                <View style={{ backgroundColor: 'rgba(245,158,11,0.16)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.35)', borderRadius: 12, padding: 12, marginBottom: 22 }}>
                  <Text style={{ fontSize: 12, color: '#F59E0B', fontWeight: '700' }}>⚙️ Setup required</Text>
                  <Text style={{ fontSize: 12, color: 'rgba(245,158,11,0.85)', marginTop: 3, lineHeight: 18 }}>Copy .env.local.example → .env.local and add your Supabase keys.</Text>
                </View>
              )}

              {bootstrapBanner && (
                <View style={{ backgroundColor: 'rgba(239,68,68,0.16)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.40)', borderRadius: 12, padding: 12, marginBottom: 22 }}>
                  <Text style={{ fontSize: 12, color: '#EF4444', fontWeight: '700' }}>⚠️ Session notice</Text>
                  <Text style={{ fontSize: 12, color: 'rgba(239,68,68,0.85)', marginTop: 3, lineHeight: 18 }}>{bootstrapBanner}</Text>
                </View>
              )}

              <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '700', letterSpacing: -0.3, marginBottom: 4 }}>Welcome back</Text>
              <Text style={{ color: 'rgba(255,255,255,0.40)', fontSize: 13, marginBottom: 26 }}>Sign in to your Detour account</Text>
              <Text style={{ color: 'rgba(255,255,255,0.30)', fontSize: 12, marginBottom: 18, lineHeight: 18 }}>
                Guides and travelers use the same login. New account? Choose a role below.
              </Text>

              {/* Email */}
              <View style={{ marginBottom: 14 }}>
                <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>Email</Text>
                <TextInput value={email} onChangeText={(v) => { setEmail(v); setBootstrapBanner(null); }} placeholder="you@example.com" placeholderTextColor="rgba(255,255,255,0.28)"
                  keyboardType="email-address" autoCapitalize="none" autoComplete="email"
                  style={inputStyle('email')} onFocus={() => setFocused('email')} onBlur={() => setFocused(null)} />
              </View>

              {/* Password */}
              <View style={{ marginBottom: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' }}>Password</Text>
                  <Link href="/(auth)/forgot-password" asChild>
                    <TouchableOpacity>
                      <Text style={{ color: '#F97316', fontSize: 12, fontWeight: '600' }}>Forgot?</Text>
                    </TouchableOpacity>
                  </Link>
                </View>
                <TextInput value={password} onChangeText={(v) => { setPassword(v); setBootstrapBanner(null); }} placeholder="••••••••" placeholderTextColor="rgba(255,255,255,0.28)"
                  secureTextEntry autoComplete="password"
                  style={inputStyle('password')} onFocus={() => setFocused('password')} onBlur={() => setFocused(null)} />
              </View>

              {/* Sign In CTA */}
              <TouchableOpacity onPress={handleLogin} disabled={loading} activeOpacity={0.85} style={{ marginTop: 24 }}>
                <LinearGradient colors={['#F97316', '#EC4899']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={{ borderRadius: 14, paddingVertical: 16, alignItems: 'center', shadowColor: '#F97316', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.45, shadowRadius: 22, elevation: 14 }}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Sign In</Text>}
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

              {/* Signup links by role */}
              <View style={{ marginTop: 22 }}>
                <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, textAlign: 'center', marginBottom: 10 }}>New here? Join as:</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Link href="/(auth)/signup?role=traveler" asChild>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={{
                        flex: 1,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.14)',
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        paddingVertical: 12,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>Traveler</Text>
                    </TouchableOpacity>
                  </Link>
                  <Link href="/(auth)/signup?role=guide" asChild>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={{
                        flex: 1,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: 'rgba(249,115,22,0.70)',
                        backgroundColor: 'rgba(249,115,22,0.14)',
                        paddingVertical: 12,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: '#F97316', fontSize: 13, fontWeight: '700' }}>Guide</Text>
                    </TouchableOpacity>
                  </Link>
                </View>
              </View>
            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
