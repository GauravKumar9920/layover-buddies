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
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" label="Profile" focused={focused} />,
        }}
      />
      <Tabs.Screen name="itineraries/create" options={{ href: null }} />
      <Tabs.Screen name="itineraries/[id]" options={{ href: null }} />
    </Tabs>
  );
}
