// ============================================================================
// ANDROID NOTIFICATION CHANNELS — Phase 5
// ============================================================================
// Android requires every notification to be tied to a channel.  Without
// explicitly creating one, expo-notifications uses a "Miscellaneous" channel
// with default importance, which can mute heads-up display.
//
// We create a single 'default' channel with high importance so balance
// reminders, late-fee alerts, and top-up requests all interrupt with a
// heads-up display — matching their time-sensitive nature.
//
// Called once on app mount from _layout.tsx.  No-op on iOS/web.
// ============================================================================

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

export async function setupAndroidNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('default', {
    name:             'General',
    importance:       Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor:       '#F97316', // Mumbai Saffron — matches splash + adaptive icon
  });
}
