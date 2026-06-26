// ============================================================================
// NOTIFICATION HANDLER — Phase 5
// ============================================================================
// Two responsibilities:
//   1. Configure how notifications appear when the app is in the foreground.
//      Without this, an incoming push delivered to an open app shows nothing.
//   2. Wire the tap-to-deep-link router so tapping a notification jumps the
//      user to the relevant trip screen.
//
// Both setups happen once in app/_layout.tsx on mount.
// ============================================================================

import * as Notifications from 'expo-notifications';
import type { Router } from 'expo-router';

// ── Foreground display ──────────────────────────────────────────────────────

// Show a banner + play the default sound even when the app is in the
// foreground.  This mirrors the OS behaviour for backgrounded apps so the
// experience is consistent regardless of where the user happens to be.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // shouldShowAlert is the legacy field expected by the older
    // NotificationBehavior type; shouldShowBanner/shouldShowList are the
    // newer iOS-15+ replacements.  Set both to maximise compatibility.
    shouldShowAlert:  true,
    shouldShowBanner: true,
    shouldShowList:   true,
    shouldPlaySound:  true,
    shouldSetBadge:   false,
  }),
});

// ── Tap routing ─────────────────────────────────────────────────────────────

interface NotificationData {
  deep_link?: string;
  booking_id?: string;
  kind?: string;
  notification_id?: string;
}

/**
 * Set up the listener that routes the user when they tap an incoming push.
 * Returns the subscription so the caller can unsubscribe on unmount.
 *
 * Reads `data.deep_link` from the notification payload (set by the send-push
 * Edge fn).  Bails silently if the payload is malformed — better to do
 * nothing than crash on a bad push.
 */
export function setupNotificationTapRouting(router: Router): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as NotificationData | undefined;
    const link = data?.deep_link;
    if (typeof link === 'string' && link.length > 0 && link.startsWith('/')) {
      // Cast through unknown — expo-router's typed routes don't accept arbitrary strings,
      // but our deep_link values are always validated server-side in pushCopy.ts.
      router.push(link as unknown as Parameters<Router['push']>[0]);
    }
  });
}
