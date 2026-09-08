/**
 * Make Alert.alert() actually say something on web.
 *
 * react-native-web ships `class Alert { static alert() {} }` — a literal
 * no-op. Twenty-nine files in this app report failures through Alert.alert,
 * so on web every one of them failed in total silence: an upload that was
 * rejected, a save that 400'd, a session that expired all looked exactly like
 * nothing happening. That is how a profile photo could vanish with no error.
 *
 * Multi-button alerts were worse than silent — they are how the app asks
 * "Discard changes?" or "Cancel this booking?", and with a no-op the
 * confirmation could never be given, so the action simply never ran.
 *
 * Imported for its side effect from app/_layout.tsx. Native is untouched.
 */

import { Alert, Platform } from "react-native";

type AlertButton = {
  text?: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
};

function joinMessage(title?: string, message?: string): string {
  return [title, message].filter(Boolean).join("\n\n");
}

if (Platform.OS === "web") {
  Alert.alert = (
    title?: string,
    message?: string,
    buttons?: AlertButton[],
  ): void => {
    const body = joinMessage(title, message);
    const actions = buttons ?? [];

    // One button (or none) is a notice, not a question.
    if (actions.length <= 1) {
      globalThis.alert?.(body);
      actions[0]?.onPress?.();
      return;
    }

    // Anything else is a decision. Map it onto confirm(): OK runs the
    // affirmative button, Cancel runs the dismissive one. `confirm` returns
    // false when a browser suppresses dialogs, which lands on the safe branch.
    const dismiss =
      actions.find((button) => button.style === "cancel") ?? actions[0];
    const confirmAction =
      actions.find((button) => button.style === "destructive") ??
      actions.filter((button) => button !== dismiss).pop() ??
      actions[actions.length - 1];

    const label = confirmAction?.text ? `\n\n[OK = ${confirmAction.text}]` : "";
    if (globalThis.confirm?.(`${body}${label}`)) confirmAction?.onPress?.();
    else dismiss?.onPress?.();
  };
}
