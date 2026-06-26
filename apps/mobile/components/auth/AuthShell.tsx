/**
 * Shared light-paper scaffold for the auth screens (login / signup / forgot).
 * Matches the rest of the Warm Editorial app: paper canvas, a postcard cluster
 * of Mumbai photos, the Instrument Serif wordmark, and a framed form card.
 *
 * The brand header (postcards + wordmark) is intentionally identical across
 * all three auth screens so navigating login ↔ signup ↔ forgot feels like the
 * same surface with only the card content changing — not a whole new screen.
 * Content is always rendered at full opacity (no entrance animation gating)
 * so a screen can never get "stuck" invisible.
 */
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { theme } from '@/config/theme';

const POSTCARDS = [
  { uri: 'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?w=240&h=300&fit=crop&q=75', rot: -7 },
  { uri: 'https://images.unsplash.com/photo-1567157577867-05ccb1388e66?w=240&h=300&fit=crop&q=75', rot: 3 },
  { uri: 'https://images.unsplash.com/photo-1586500036706-41963de24d8b?w=240&h=300&fit=crop&q=75', rot: 8 },
];

function Postcard({ uri, rot }: { uri: string; rot: number }) {
  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        padding: 5,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(14,25,41,0.18)',
        marginHorizontal: -10,
        transform: [{ rotate: `${rot}deg` }],
        ...theme.shadows.md,
      }}
    >
      <Image source={{ uri }} style={{ width: 86, height: 108, borderRadius: 6 }} contentFit="cover" transition={300} />
    </View>
  );
}

export function AuthShell({ children, tagline = 'Your local guide awaits' }: { children: React.ReactNode; tagline?: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 22, paddingVertical: 44 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ width: '100%', maxWidth: 420 }}>
            {/* Brand header — identical on every auth screen */}
            <View style={{ alignItems: 'center', marginBottom: 28 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 20, paddingTop: 6 }}>
                {POSTCARDS.map((p, i) => <Postcard key={i} {...p} />)}
              </View>
              <Text style={{ fontFamily: theme.fonts.serif, fontSize: 44, color: theme.colors.text, letterSpacing: -0.5 }}>Detour</Text>
              <Text style={{ ...theme.typography.eyebrow, color: theme.colors.textMuted, marginTop: 4 }}>{tagline}</Text>
            </View>

            {/* Form card */}
            <View
              style={{
                backgroundColor: theme.colors.surface,
                borderRadius: theme.borderRadius.xl,
                borderWidth: 1.5,
                borderColor: theme.colors.inkLine,
                padding: 24,
                ...theme.shadows.lg,
              }}
            >
              {children}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
