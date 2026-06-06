/**
 * Celebratory boarding-pass reveal shown the moment a booking is confirmed.
 * A paper ticket springs up and a "REQUEST SENT" stamp thumps down over it,
 * then it auto-advances to the trip screen (or on tap). Pure presentational —
 * the caller owns the booking data and the onDone navigation.
 */
import { useEffect } from 'react';
import { Modal, View, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  withSequence,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { theme } from '@/config/theme';
import { hapticSuccess } from '@/lib/haptics';

const C = theme.colors;
const F = theme.fonts;

export interface BoardingPassRevealProps {
  visible: boolean;
  itineraryName: string;
  guideName: string;
  guideAvatar?: string | null;
  dateLabel: string;
  timeLabel?: string;
  flightNumber?: string;
  totalLabel: string;
  onDone: () => void;
}

function Stub({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={{ fontFamily: F.mono, fontSize: 9.5, letterSpacing: 0.6, textTransform: 'uppercase', color: C.textMuted }}>{label}</Text>
      <Text style={{ fontFamily: F.monoMed, fontSize: 15, color: C.text, marginTop: 2 }}>{value}</Text>
    </View>
  );
}

export function BoardingPassReveal({
  visible, itineraryName, guideName, guideAvatar,
  dateLabel, timeLabel, flightNumber, totalLabel, onDone,
}: BoardingPassRevealProps) {
  const scrim = useSharedValue(0);
  const ticketY = useSharedValue(48);
  const ticketScale = useSharedValue(0.86);
  const ticketOp = useSharedValue(0);
  const stampScale = useSharedValue(1.6);
  const stampOp = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    scrim.value = withTiming(1, { duration: 220 });
    ticketOp.value = withTiming(1, { duration: 260 });
    ticketY.value = withSpring(0, { damping: 16, stiffness: 130 });
    ticketScale.value = withSpring(1, { damping: 15, stiffness: 130 });
    // Stamp thumps down after the ticket settles
    stampOp.value = withDelay(520, withTiming(1, { duration: 120 }));
    stampScale.value = withDelay(
      520,
      withSequence(
        withTiming(0.92, { duration: 140, easing: Easing.out(Easing.quad) }, (f) => { if (f) runOnJS(hapticSuccess)(); }),
        withSpring(1, { damping: 9, stiffness: 160 }),
      ),
    );
    // Auto-advance
    const t = setTimeout(() => runOnJS(onDone)(), 2100);
    return () => clearTimeout(t);
  }, [visible]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.value }));
  const ticketStyle = useAnimatedStyle(() => ({
    opacity: ticketOp.value,
    transform: [{ translateY: ticketY.value }, { scale: ticketScale.value }],
  }));
  const stampStyle = useAnimatedStyle(() => ({
    opacity: stampOp.value,
    transform: [{ rotate: '-9deg' }, { scale: stampScale.value }],
  }));

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDone}>
      <Pressable onPress={onDone} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
        <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(14,25,41,0.82)' }, scrimStyle]} />

        <Animated.View style={[{ width: '100%', maxWidth: 360 }, ticketStyle]}>
          {/* eyebrow */}
          <Text style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: 'rgba(252,247,234,0.7)', textAlign: 'center', marginBottom: 14 }}>
            Boarding pass · Detour
          </Text>

          <View style={{ backgroundColor: C.surface, borderRadius: 16, borderWidth: 1.5, borderColor: C.inkLine, overflow: 'hidden' }}>
            {/* Top: route + guide */}
            <View style={{ padding: 18, position: 'relative' }}>
              <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase', color: C.primary }}>Request sent · {dateLabel}</Text>
              <Text style={{ fontFamily: F.display, fontSize: 22, color: C.text, letterSpacing: -0.4, marginTop: 6 }} numberOfLines={2}>{itineraryName}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
                {guideAvatar ? (
                  <Image source={{ uri: guideAvatar }} style={{ width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(14,25,41,0.2)' }} contentFit="cover" />
                ) : (
                  <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: C.surfaceMuted, borderWidth: 1, borderColor: 'rgba(14,25,41,0.15)' }} />
                )}
                <Text style={{ fontFamily: F.bodySemi, fontSize: 14, color: C.text }}>with {guideName}</Text>
              </View>

              {/* Stamp */}
              <Animated.View style={[{ position: 'absolute', right: 12, top: 14 }, stampStyle]}>
                <View style={{ borderWidth: 2, borderColor: C.success, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                  <Text style={{ fontFamily: F.monoMed, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: C.success }}>Booked</Text>
                </View>
              </Animated.View>
            </View>

            {/* Perforation */}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(14,25,41,0.82)', marginLeft: -9 }} />
              <View style={{ flex: 1, height: 1, borderBottomWidth: 1.5, borderColor: C.inkLine, borderStyle: 'dashed' }} />
              <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(14,25,41,0.82)', marginRight: -9 }} />
            </View>

            {/* Bottom: details */}
            <View style={{ padding: 18, flexDirection: 'row', justifyContent: 'space-between' }}>
              <Stub label="Date" value={dateLabel} />
              {timeLabel ? <Stub label="Time" value={timeLabel} /> : null}
              {flightNumber ? <Stub label="Flight" value={flightNumber} /> : null}
              <Stub label="Total" value={totalLabel} />
            </View>
          </View>

          <Text style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(252,247,234,0.55)', textAlign: 'center', marginTop: 16 }}>
            Opening your trip…
          </Text>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
