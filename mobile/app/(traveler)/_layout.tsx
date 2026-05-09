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

export default function TravelerLayout() {
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
          tabBarIcon: ({ focused }) => <TabIcon emoji="🗺️" label="Explore" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="🔍" label="Search" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="♥" label="Saved" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="messages/index"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="💬" label="Inbox" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="trips/index"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="🎒" label="My Trips" focused={focused} />,
        }}
      />
      {/* Hidden from tab bar but routable */}
      <Tabs.Screen name="guide/[id]" options={{ href: null }} />
      <Tabs.Screen name="book/[guideId]" options={{ href: null }} />
      <Tabs.Screen name="book/payment/[bookingId]" options={{ href: null }} />
      <Tabs.Screen name="itinerary/[id]" options={{ href: null }} />
      <Tabs.Screen name="trips/[id]" options={{ href: null }} />
      <Tabs.Screen name="trips/live/[id]" options={{ href: null }} />
      <Tabs.Screen name="trips/review/[id]" options={{ href: null }} />
      {/* Phase 3 */}
      <Tabs.Screen name="trips/balance/[bookingId]" options={{ href: null }} />
      <Tabs.Screen name="trips/cancel/[bookingId]" options={{ href: null }} />
      <Tabs.Screen name="trips/cancellation-receipt/[bookingId]" options={{ href: null }} />
      {/* Phase 4 */}
      <Tabs.Screen name="trips/qr/[bookingId]" options={{ href: null }} />
      <Tabs.Screen name="trips/receipt/[bookingId]" options={{ href: null }} />
    </Tabs>
  );
}
