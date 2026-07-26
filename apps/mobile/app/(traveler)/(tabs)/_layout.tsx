import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withSpring,
  withRepeat,
  withTiming,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { theme } from '@/config/theme';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

function TabIcon({
  icon, label, focused, bouncyOnFocus,
}: { icon: FeatherName; label: string; focused: boolean; bouncyOnFocus?: boolean }) {
  // When the heart is focused, jump it once and then keep a gentle pulse
  // running so the tab bar feels alive. We cancel + reset on blur so other
  // tabs aren't paying the animation cost.
  const scale = useSharedValue(1);

  useEffect(() => {
    if (focused && bouncyOnFocus) {
      // Big initial bounce, then a soft repeating pulse.
      scale.value = withSequence(
        withSpring(1.35, { damping: 6, stiffness: 220 }),
        withSpring(1, { damping: 8, stiffness: 180 }),
        withRepeat(
          withSequence(
            withTiming(1.12, { duration: 700, easing: Easing.inOut(Easing.quad) }),
            withTiming(1,    { duration: 700, easing: Easing.inOut(Easing.quad) }),
          ),
          -1, // infinite
          false,
        ),
      );
    } else {
      cancelAnimation(scale);
      scale.value = withSpring(1, { damping: 10, stiffness: 150 });
    }
    return () => cancelAnimation(scale);
  }, [focused, bouncyOnFocus]);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <View style={{ alignItems: 'center', gap: 4, width: 64 }}>
      <Animated.View style={animStyle}>
        <Feather name={icon} size={21} color={focused ? theme.colors.primary : theme.colors.textMuted} />
      </Animated.View>
      <Text
        style={{
          fontFamily: focused ? theme.fonts.monoMed : theme.fonts.mono,
          fontSize: 9,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          color: focused ? theme.colors.primary : theme.colors.textMuted,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

/**
 * (tabs) — the bottom-tab navigator. By isolating tabs in their own group
 * and putting the detail screens (guide profile, booking form, trip detail
 * etc.) one level up at (traveler)/ — managed by a parent Stack — we get
 * two things for free:
 *
 *   1. Detail screens push *over* the tab bar instead of replacing one of
 *      its tabs. The tab bar is no longer rendered on those screens.
 *   2. Web stops accumulating stale tab content in the DOM, because the
 *      parent Stack handles unmounting prior screens.
 *
 * Before this restructure, every previously-visited tab stayed in the
 * DOM on web (a known react-navigation web limitation), so switching tabs
 * felt like everything was stacking on top of each other.
 */
export default function TabsLayout() {
  return (
    <Tabs
      // detachInactiveScreens removes prior tab DOM nodes on web (and the
      // equivalent via react-native-screens on native) so switching between
      // Explore/Saved/Inbox/etc no longer accumulates content vertically.
      detachInactiveScreens
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: 'rgba(14,25,41,0.12)',
          borderTopWidth: 1,
          height: 72,
          paddingBottom: 12,
          paddingTop: 8,
        },
        tabBarShowLabel: false,
        // Drop a tab's mounted content as soon as we leave it.  Combined with
        // detachInactiveScreens at the navigator level, this guarantees a
        // single tab is in the DOM at any time on web — which fixes the
        // "tap Saved, see Saved + Explore + previous-screens-stacked" bug
        // the user hit.
        freezeOnBlur: true,
        lazy: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon icon="compass" label="Explore" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="messages/index"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon icon="message-circle" label="Chats" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          tabBarIcon: ({ focused }) => (
            // bouncyOnFocus → the heart jumps then pulses while this tab is
            // active. The other tabs stay static so the heart stands out.
            <TabIcon icon="heart" label="Saved" focused={focused} bouncyOnFocus />
          ),
        }}
      />
      <Tabs.Screen
        name="trips/index"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon icon="briefcase" label="Trips" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon icon="user" label="Profile" focused={focused} />,
        }}
      />
      {/* Inline Explore search is the fast path; keep the richer dedicated
          search route available for existing links without adding a sixth tab. */}
      <Tabs.Screen name="search" options={{ href: null }} />
    </Tabs>
  );
}
