// ============================================================================
// SAFETY BAR — SOS / Help / Contact (shared by web + native live screens)
// ============================================================================
// SOS is REAL: it writes a row to `sos_alerts`, which lands on the admin
// console's SOS page (Acknowledge/Resolve + maps link). Location comes from
// the device via expo-location (works on web through navigator.geolocation);
// when no fix is available within the timeout we fall back to the other
// party's last shared position or central Mumbai — an approximate SOS still
// beats no SOS. Repeated triggers while an alert is open won't create
// duplicates.
//
// Pointer/touch users can press-and-HOLD (~1.2s with a visible progress fill)
// for a fast one-handed trigger. A normal activation opens a confirmation so
// keyboard and screen-reader users have an equivalent, safe path. Used by BOTH
// roles — traveler live screens pass the guide's name, the guide in-trip screen
// passes the traveler's.
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import Feather from '@expo/vector-icons/Feather';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { confirmAsync, notify } from '@/lib/ui/alert';
import { triggerSos, fetchMyOpenSos } from '@/lib/api/sos';
import { hapticWarning } from '@/lib/haptics';
import { theme } from '@/config/theme';

export interface SafetyBarProps {
  bookingId: string;
  /** The other party on this trip — guide's name for travelers, traveler's
   *  name for guides. Used in help copy only. */
  contactName: string;
  insets: { bottom: number };
  /** Best-known coordinates if the device can't produce a fix (e.g. the
   *  other party's last shared location). Defaults to central Mumbai. */
  fallbackCoords?: { latitude: number; longitude: number };
}

const MUMBAI = { latitude: 19.076, longitude: 72.8777 };
/** How long the SOS button must be held before the alert fires. */
const HOLD_TO_SEND_MS = 1200;

/** Device position with a hard timeout; null if denied/unavailable. */
async function getPositionOrNull(timeoutMs = 6000): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const pos = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
    if (!pos) return null;
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  } catch {
    return null;
  }
}

export function SafetyBar({ bookingId, contactName, insets, fallbackCoords }: SafetyBarProps) {
  const [sending, setSending] = useState(false);
  const [sentAt, setSentAt] = useState<string | null>(null);
  const activationInFlight = useRef(false);
  const confirmationInFlight = useRef(false);
  const suppressNextPress = useRef(false);

  // 0 → 1 while the button is held; drives the fill bar behind the label.
  const holdProgress = useSharedValue(0);
  // Gentle repeating pulse once an alert is live, so "SOS active" stays felt.
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (sentAt) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.04, { duration: 600 }),
          withTiming(1, { duration: 600 }),
        ),
        -1,
        false,
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = withSpring(1, { damping: 15, stiffness: 150 });
    }
    return () => cancelAnimation(pulse);
  }, [sentAt, pulse]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${holdProgress.value * 100}%` }));
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  async function sendSos() {
    if (activationInFlight.current) return;
    activationInFlight.current = true;
    setSending(true);
    try {
      // Don't double-fire if this user already has an open alert.
      const existing = await fetchMyOpenSos(bookingId);
      if (existing) {
        setSentAt(existing.triggered_at);
        notify(
          'SOS already active',
          'Your alert is recorded. Call 112 for a life-threatening emergency, and stay where you are if it is safe to do so.',
        );
        return;
      }

      const coords = (await getPositionOrNull()) ?? fallbackCoords ?? MUMBAI;
      const alert = await triggerSos({ bookingId, ...coords });
      setSentAt(alert.triggered_at);
      notify(
        'SOS recorded',
        `Your alert and location were recorded, and Detour is attempting to page the ops team. If you can, also message or call ${contactName}. For a life-threatening emergency call 112.`,
      );
    } catch (err) {
      notify(
        'SOS could not be sent',
        `${err instanceof Error ? err.message : 'Network error.'}\n\nPlease call 112 (national emergency) or contact ${contactName} directly.`,
      );
    } finally {
      activationInFlight.current = false;
      setSending(false);
      holdProgress.value = withTiming(0, { duration: 250 });
    }
  }

  async function confirmAndSendSos() {
    if (activationInFlight.current || confirmationInFlight.current) return;
    confirmationInFlight.current = true;

    try {
      const ok = await confirmAsync(
        'Send SOS alert?',
        `This records an emergency alert with your location and immediately attempts to page the Detour ops team.\n\nFor a life-threatening emergency also call 112 (India national emergency).`,
        { confirmLabel: 'Send SOS', destructive: true },
      );
      if (ok) await sendSos();
    } finally {
      confirmationInFlight.current = false;
    }
  }

  function triggerHeldSos() {
    suppressNextPress.current = true;
    void sendSos();
  }

  function handleHoldStart() {
    if (sending || confirmationInFlight.current) return;
    suppressNextPress.current = false;
    if (sentAt) {
      suppressNextPress.current = true;
      notify(
        'SOS already active',
        'Your alert is recorded. Call 112 for a life-threatening emergency, and stay where you are if it is safe to do so.',
      );
      return;
    }
    hapticWarning();
    holdProgress.value = withTiming(1, { duration: HOLD_TO_SEND_MS }, (finished) => {
      if (finished) runOnJS(triggerHeldSos)();
    });
  }

  function handleHoldEnd() {
    // Released early → cancel and spring the fill back to zero. (If the hold
    // completed, `sos()` owns the reset.)
    if (holdProgress.value < 1) {
      cancelAnimation(holdProgress);
      holdProgress.value = withSpring(0, { damping: 15, stiffness: 150 });
    }
  }

  function handleAccessiblePress() {
    // TouchableOpacity emits onPress after a completed hold. Suppress that
    // second activation; a short click/keyboard/screen-reader activation uses
    // a confirmation instead.
    if (suppressNextPress.current) {
      suppressNextPress.current = false;
      return;
    }
    if (sentAt) {
      notify(
        'SOS already active',
        'Your alert is recorded. Call 112 for a life-threatening emergency, and stay where you are if it is safe to do so.',
      );
      return;
    }
    void confirmAndSendSos();
  }

  function help() {
    notify('Help', `Questions mid-trip? Message ${contactName} from the chat, or reach Detour at hello@detourtrips.com.`);
  }

  function contact() {
    notify('Contact us', 'Detour support: hello@detourtrips.com');
  }

  return (
    <View style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      flexDirection: 'row', gap: 8,
      paddingHorizontal: 12,
      paddingTop: 10, paddingBottom: insets.bottom + 10,
      backgroundColor: theme.colors.surface,
      borderTopWidth: 1, borderTopColor: theme.colors.divider,
    }}>
      <Animated.View style={[{ flex: 1.4 }, pulseStyle]}>
        <TouchableOpacity
          onPressIn={handleHoldStart}
          onPressOut={handleHoldEnd}
          onPress={handleAccessiblePress}
          disabled={sending}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel="Send SOS alert"
          accessibilityHint="Hold for one second, or activate once to open a confirmation. This records your location and attempts to page Detour operations. For a life-threatening emergency call 112."
          accessibilityActions={[{ name: 'activate', label: 'Send SOS alert' }]}
          onAccessibilityAction={({ nativeEvent }) => {
            if (nativeEvent.actionName === 'activate') handleAccessiblePress();
          }}
          style={{
            paddingVertical: 10, borderRadius: 12,
            backgroundColor: theme.colors.error,
            opacity: sending ? 0.7 : 1,
            alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {/* hold-progress fill */}
          <Animated.View
            style={[
              {
                position: 'absolute',
                left: 0, top: 0, bottom: 0,
                backgroundColor: 'rgba(14,25,41,0.35)',
              },
              fillStyle,
            ]}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {sending
              ? <ActivityIndicator size="small" color="#FCF7EA" />
              : <Feather name="alert-triangle" size={14} color="#FCF7EA" />}
            <Text style={{ fontFamily: theme.fonts.bodyBold, color: '#FCF7EA', fontSize: 13 }}>
              {sentAt ? 'SOS active' : 'SOS'}
            </Text>
          </View>
          <Text style={{ fontFamily: theme.fonts.mono, color: 'rgba(252,247,234,0.85)', fontSize: 8.5, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 2 }}>
            {sentAt ? 'SOS recorded' : 'Hold to send'}
          </Text>
        </TouchableOpacity>
      </Animated.View>
      <TouchableOpacity
        onPress={help}
        style={{
          flex: 1, paddingVertical: 12, borderRadius: 12,
          backgroundColor: theme.colors.primaryLight,
          alignItems: 'center', justifyContent: 'center',
          flexDirection: 'row', gap: 6,
        }}
      >
        <Feather name="help-circle" size={14} color={theme.colors.primary} />
        <Text style={{ fontFamily: theme.fonts.bodyBold, color: theme.colors.primary, fontSize: 13 }}>Help</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={contact}
        style={{
          flex: 1, paddingVertical: 12, borderRadius: 12,
          backgroundColor: theme.colors.background,
          borderWidth: 1, borderColor: theme.colors.divider,
          alignItems: 'center', justifyContent: 'center',
          flexDirection: 'row', gap: 6,
        }}
      >
        <Feather name="phone" size={14} color={theme.colors.text} />
        <Text style={{ fontFamily: theme.fonts.bodyBold, color: theme.colors.text, fontSize: 13 }}>Contact</Text>
      </TouchableOpacity>
    </View>
  );
}
