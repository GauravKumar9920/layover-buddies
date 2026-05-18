import { Stack } from 'expo-router';

/**
 * (shared) group — screens that both travelers and guides can land on, like
 * the conversation thread and the agreement viewer. Until this layout
 * existed, navigating into `(shared)/messages/[id]` from inside a tabbed
 * group dropped the user out of every parent navigator, which felt like
 * being "teleported into a dead end" with no back affordance.
 *
 * A plain Stack here keeps the route hierarchy intact: each screen pushes
 * onto the stack, the conversation header's custom back arrow uses
 * `safeBack(router, fallback)` to land somewhere reasonable when there's
 * no history (direct URL / refresh).
 */
export default function SharedLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
