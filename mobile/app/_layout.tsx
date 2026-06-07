import '../global.css';
import '@/lib/setupTextFont';
import { useEffect } from 'react';
import { LogBox } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useRouter, useSegments } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import {
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { DMMono_400Regular, DMMono_500Medium } from '@expo-google-fonts/dm-mono';
import { InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif';
import { useAuth } from '@/lib/hooks/useAuth';
import { Loading } from '@/components/ui/Loading';
import { useFavoritesStore } from '@/lib/stores/favorites';
import { setupAndroidNotificationChannels } from '@/lib/push/notificationChannels';
import { setupNotificationTapRouting } from '@/lib/push/notificationHandler';

// Suppress benign dev-only noise:
//  - expo-system-ui cannot set color scheme on web in dev mode
//  - react-native-web deprecation notices for `shadow*` / `pointerEvents`
//    props (we use the shadow* API intentionally — it's correct on native;
//    only RNW flags it). Silencing keeps the dev console clean.
LogBox.ignoreLogs([
  'Cannot manually set color scheme',
  '"shadow*" style props are deprecated',
  'props.pointerEvents is deprecated',
]);

// Keep the native splash up until the Warm Editorial fonts are ready, so the
// first frame never flashes in a fallback system font.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Font keys are registered to match `theme.fonts` in config/theme.ts.
const FONT_MAP = {
  Bricolage_600SemiBold: BricolageGrotesque_600SemiBold,
  Bricolage_700Bold: BricolageGrotesque_700Bold,
  Bricolage_800ExtraBold: BricolageGrotesque_800ExtraBold,
  Jakarta_400Regular: PlusJakartaSans_400Regular,
  Jakarta_500Medium: PlusJakartaSans_500Medium,
  Jakarta_600SemiBold: PlusJakartaSans_600SemiBold,
  Jakarta_700Bold: PlusJakartaSans_700Bold,
  DMMono_400Regular: DMMono_400Regular,
  DMMono_500Medium: DMMono_500Medium,
  InstrumentSerif_400Regular: InstrumentSerif_400Regular,
};

function RootLayoutNav() {
  const { session, role, loading, needsOnboarding } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const hydrateFavorites = useFavoritesStore((s) => s.hydrate);
  const resetFavorites = useFavoritesStore((s) => s.reset);

  // Keep the favorites cache in sync with the signed-in user. We re-run on
  // sign-in (new user id) and reset on sign-out so a shared device can't
  // leak one user's hearts into the next session.
  useEffect(() => {
    if (loading) return;
    if (session?.user?.id) {
      void hydrateFavorites(session.user.id);
    } else {
      resetFavorites();
    }
  }, [session?.user?.id, loading, hydrateFavorites, resetFavorites]);

  // Push notification setup. Channels (Android) + tap-to-deep-link routing.
  // Runs once on mount; subscription cleaned up on unmount.
  useEffect(() => {
    void setupAndroidNotificationChannels();
    const subscription = setupNotificationTapRouting(router);
    return () => { subscription.remove(); };
  }, [router]);

  useEffect(() => {
    if (loading) return;

    // Design-preview gallery — bypass auth redirects so the Warm Editorial
    // screens render without a signed-in session. (Dev/review only.)
    if (segments[0] === 'design-preview') return;

    // Let a signed-in guide preview their own traveler-facing profile
    // (/(traveler)/guide/[id]) without the role guard bouncing them back to
    // the guide area. Unauth users still fall through to the login redirect.
    if (session && segments[0] === '(traveler)' && segments[1] === 'guide') return;

    const inAuthGroup = segments[0] === '(auth)';
    const inTravelerGroup = segments[0] === '(traveler)';
    const inGuideGroup = segments[0] === '(guide)';

    if (!session) {
      // Not signed in → go to auth
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
    } else if (role === 'guide') {
      // Guide → guide area
      if (!inGuideGroup && !segments.includes('(shared)' as never)) {
        router.replace('/(guide)');
      }
    } else {
      // Traveler → traveler area. Freshly-signed-up travelers haven't filled
      // in nationality / layover / interests yet; force them through the
      // onboarding flow before they can reach Explore.
      const onOnboardingScreen = segments.includes('onboarding' as never);
      if (needsOnboarding && !onOnboardingScreen) {
        router.replace('/(traveler)/onboarding' as never);
      } else if (!inTravelerGroup && !segments.includes('(shared)' as never)) {
        router.replace('/(traveler)/(tabs)' as never);
      }
    }
  }, [session, role, loading, needsOnboarding, segments]);

  if (loading) {
    return <Loading fullScreen message="Loading your account..." />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: '#F4EDDD' },
      }}
    />
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FONT_MAP);

  useEffect(() => {
    // Reveal the app once fonts are ready (or failed — we still render with
    // system-font fallback rather than hang on a blank splash forever).
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null; // native splash stays visible
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <RootLayoutNav />
    </GestureHandlerRootView>
  );
}
