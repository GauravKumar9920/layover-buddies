import { Stack } from "expo-router";

export default function GuideProfileLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="edit" />
      <Stack.Screen name="payout-vpa" />
    </Stack>
  );
}
