import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/config/theme';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

function TabIcon({ icon, label, focused }: { icon: FeatherName; label: string; focused: boolean }) {
  return (
    <View style={{ alignItems: 'center', gap: 4, width: 64 }}>
      <Feather name={icon} size={21} color={focused ? theme.colors.primary : theme.colors.textMuted} />
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

export default function GuideLayout() {
  return (
    <Tabs
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
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon icon="grid" label="Dashboard" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon icon="inbox" label="Requests" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="itineraries/index"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon icon="map" label="Tours" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="messages/index"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon icon="message-circle" label="Chats" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon icon="user" label="Profile" focused={focused} />,
        }}
      />
      <Tabs.Screen name="itineraries/create" options={{ href: null }} />
      <Tabs.Screen name="itineraries/[id]" options={{ href: null }} />
      {/* Earnings — reached from the dashboard "Earned" stat card */}
      <Tabs.Screen name="earnings" options={{ href: null }} />
      <Tabs.Screen name="bookings/[id]" options={{ href: null }} />
      {/* Phase 2 — buddy-side agreement drafting screen, reachable via router.push */}
      <Tabs.Screen name="bookings/agreement-draft/[bookingId]" options={{ href: null }} />
      {/* Phase 3 */}
      <Tabs.Screen name="bookings/cancellation-receipt/[bookingId]" options={{ href: null }} />
      {/* Phase 4 */}
      <Tabs.Screen name="bookings/qr-scan/[bookingId]" options={{ href: null }} />
      <Tabs.Screen name="bookings/in-trip/[bookingId]" options={{ href: null }} />
      <Tabs.Screen name="bookings/upload-proofs/[bookingId]" options={{ href: null }} />
      <Tabs.Screen name="bookings/receipt/[bookingId]" options={{ href: null }} />
      <Tabs.Screen name="profile/payout-vpa" options={{ href: null }} />
    </Tabs>
  );
}
