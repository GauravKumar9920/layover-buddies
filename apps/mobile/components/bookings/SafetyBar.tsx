// ============================================================================
// SAFETY BAR — SOS / Help / Contact (shared by web + native live screens)
// ============================================================================
// SOS is REAL: it writes a row to `sos_alerts`, which lands on the admin
// console's SOS page (Acknowledge/Resolve + maps link). Location comes from
// the device via expo-location (works on web through navigator.geolocation);
// when no fix is available within the timeout we fall back to the guide's
// last shared position or central Mumbai — an approximate SOS still beats
// no SOS. Repeated taps while an alert is open won't create duplicates.
// ============================================================================

import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import Feather from '@expo/vector-icons/Feather';
import { notify, confirmAsync } from '@/lib/ui/alert';
import { triggerSos, fetchMyOpenSos } from '@/lib/api/sos';
import { theme } from '@/config/theme';

export interface SafetyBarProps {
  bookingId: string;
  guideName: string;
  insets: { bottom: number };
  /** Best-known coordinates if the device can't produce a fix (e.g. the
   *  guide's last shared location). Defaults to central Mumbai. */
  fallbackCoords?: { latitude: number; longitude: number };
}

const MUMBAI = { latitude: 19.076, longitude: 72.8777 };

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

export function SafetyBar({ bookingId, guideName, insets, fallbackCoords }: SafetyBarProps) {
  const [sending, setSending] = useState(false);
  const [sentAt, setSentAt] = useState<string | null>(null);

  async function sos() {
    if (sending) return;

    const ok = await confirmAsync(
      'Send SOS alert?',
      `This records an emergency alert with your location and immediately attempts to page the Detour ops team.\n\nFor a life-threatening emergency also call 112 (India national emergency).`,
      { confirmLabel: 'Send SOS', destructive: true },
    );
    if (!ok) return;

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
        `Your alert and location were recorded, and Detour is attempting to page the ops team. If you can, also message or call ${guideName}. For a life-threatening emergency call 112.`,
      );
    } catch (err) {
      notify(
        'SOS could not be sent',
        `${err instanceof Error ? err.message : 'Network error.'}\n\nPlease call 112 (national emergency) or contact ${guideName} directly.`,
      );
    } finally {
      setSending(false);
    }
  }

  function help() {
    notify('Help', `Questions mid-trip? Message ${guideName} from the chat, or reach Detour at hello@detourtrips.com.`);
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
      backgroundColor: '#FFFFFF',
      borderTopWidth: 1, borderTopColor: theme.colors.divider,
    }}>
      <TouchableOpacity
        onPress={sos}
        disabled={sending}
        accessibilityRole="button"
        accessibilityLabel="Send SOS alert"
        accessibilityHint="Records an alert and attempts to page Detour operations with your location. For a life-threatening emergency call 112."
        style={{
          flex: 1.4, paddingVertical: 12, borderRadius: 12,
          backgroundColor: theme.colors.error,
          opacity: sending ? 0.7 : 1,
          alignItems: 'center', justifyContent: 'center',
          flexDirection: 'row', gap: 6,
        }}
      >
        {sending
          ? <ActivityIndicator size="small" color="#FCF7EA" />
          : <Feather name="alert-triangle" size={14} color="#FCF7EA" />}
        <Text style={{ fontFamily: theme.fonts.bodyBold, color: '#FCF7EA', fontSize: 13 }}>
          {sentAt ? 'SOS active' : 'SOS'}
        </Text>
      </TouchableOpacity>
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
