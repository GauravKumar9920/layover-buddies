import '../global.css';
import { useEffect } from 'react';
import { LogBox } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '@/lib/hooks/useAuth';
import { Loading } from '@/components/ui/Loading';
import { useFavoritesStore } from '@/lib/stores/favorites';
import { setupAndroidNotificationChannels } from '@/lib/push/notificationChannels';
import { setupNotificationTapRouting } from '@/lib/push/notificationHandler';

// expo-system-ui cannot set color scheme on web in dev mode — suppress the toast
LogBox.ignoreLogs(['Cannot manually set color scheme']);

function RootLayoutNav() {
  const { session, role, loading } = useAuth();
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
      // Traveler → traveler area
      if (!inTravelerGroup && !segments.includes('(shared)' as never)) {
        router.replace('/(traveler)');
      }
    }
  }, [session, role, loading, segments]);

  if (loading) {
    return <Loading fullScreen message="Loading your account..." />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: '#FFFAF5' },
      }}
    />
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="auto" />
      <RootLayoutNav />
    </GestureHandlerRootView>
  );
}
