import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';
import { theme } from '@/config/theme';

function TabIcon({ emoji, label, focused }: { emoji: string; label: string; focused: boolean }) {
  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      <Text style={{ fontSize: 22 }}>{emoji}</Text>
      <Text
        style={{
          fontSize: 10,
          fontWeight: focused ? '700' : '400',
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
          backgroundColor: '#FFFFFF',
          borderTopColor: theme.colors.divider,
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
          tabBarIcon: ({ focused }) => <TabIcon emoji="📊" label="Dashboard" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="📬" label="Requests" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="itineraries/index"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="🗺️" label="Tours" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="messages/index"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="💬" label="Inbox" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" label="Profile" focused={focused} />,
        }}
      />
      <Tabs.Screen name="itineraries/create" options={{ href: null }} />
      <Tabs.Screen name="itineraries/[id]" options={{ href: null }} />
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
