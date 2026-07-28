import { Stack } from 'expo-router';

/**
 * (traveler) — root Stack for the traveler side of the app.
 *
 * The first child is `(tabs)` which renders the 5-tab bottom navigator.
 * Every other entry is a detail screen that pushes on top of the tab
 * navigator: guide profile, booking form, trip details, cancel,
 * etc. Because they live in a Stack (not nested inside Tabs), they
 * unmount cleanly when the user navigates away — fixing the web bug
 * where previously-visited screens accumulated in the DOM and made tab
 * switches feel "stuck".
 *
 * URLs are unchanged: groups (parens) are transparent in the URL.
 * `/` still maps to the Explore tab, `/guide/[id]` still works, etc.
 */
export default function TravelerLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="profile/edit" />
      <Stack.Screen name="guide/[id]" />
      <Stack.Screen name="itinerary/[id]" />
      <Stack.Screen name="book/[guideId]" />
      {/* Compatibility redirect for pre-agreement payment deep links. */}
      <Stack.Screen name="book/payment/[bookingId]" />
      <Stack.Screen name="trips/[id]" />
      <Stack.Screen name="trips/live/[id]" />
      <Stack.Screen name="trips/review/[id]" />
      {/* Phase 3 */}
      <Stack.Screen name="trips/balance/[bookingId]" />
      <Stack.Screen name="trips/cancel/[bookingId]" />
      <Stack.Screen name="trips/cancellation-receipt/[bookingId]" />
      {/* Phase 4 */}
      <Stack.Screen name="trips/qr/[bookingId]" />
      <Stack.Screen name="trips/receipt/[bookingId]" />
    </Stack>
  );
}
