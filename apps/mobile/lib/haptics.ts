import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

function runSafely(action: () => Promise<unknown>) {
  if (Platform.OS === 'web') return;

  try {
    void action();
  } catch {
    // Ignore haptics failures so feedback never crashes user interactions.
  }
}

export function hapticWarning() {
  runSafely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}

export function hapticSuccess() {
  runSafely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

export function hapticError() {
  runSafely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
}

export function hapticImpactLight() {
  runSafely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

export function hapticImpactMedium() {
  runSafely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}