// Cross-platform alert helpers.
// react-native's `Alert.alert` is a no-op on web — callers that relied on it
// for one-button toasts or confirm dialogs silently broke. These shims use
// window.alert / window.confirm on web and Alert.alert on native so the same
// callsite works everywhere.

import { Alert, Platform } from 'react-native';

export function notify(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    const text = message ? `${title}\n\n${message}` : title;
    window.alert(text);
    return;
  }
  Alert.alert(title, message);
}

/**
 * Two-button confirm dialog. Resolves true if the user picked the confirm
 * button, false on cancel. Use it instead of Alert.alert(..., [...buttons])
 * so the same code path works on web.
 */
export function confirmAsync(
  title: string,
  message: string,
  opts: { confirmLabel?: string; cancelLabel?: string; destructive?: boolean } = {},
): Promise<boolean> {
  const confirmLabel = opts.confirmLabel ?? 'OK';
  const cancelLabel  = opts.cancelLabel  ?? 'Cancel';

  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }

  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
        {
          text: confirmLabel,
          style: opts.destructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
