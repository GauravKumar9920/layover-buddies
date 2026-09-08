/**
 * "Does this trip fit my layover?" — the three-stage verdict, one component.
 *
 * This is the single place where the semantic tone from `timeFitLabel` becomes
 * a colour. Before this existed the same idea was drawn with three different
 * palettes: raw hexes in timeFit.ts, theme tokens in the booking screen's day
 * timeline, and a third set of text colours inline next to it — so the same
 * tour could read amber in a list and gold on the booking screen.
 *
 * Renders nothing when either input is unknown. That matters: a missing tour
 * duration must hide the chip, never fall back to an assumed length. The old
 * guide card defaulted to "3 hours" and presented the result as a verdict.
 */

import React from 'react';
import { View, Text, type StyleProp, type ViewStyle } from 'react-native';
import { theme } from '@/config/theme';
import {
  computeTimeFit,
  timeFitLabel,
  type TimeFitTone,
} from '@/lib/booking/timeFit';

type Variant = 'full' | 'compact' | 'overlay';

interface TimeFitChipProps {
  /** Traveler's layover length. Null hides the chip. */
  layoverHours: number | null | undefined;
  /** This tour's length. Null hides the chip — never guess it. */
  tourHours: number | null | undefined;
  variant?: Variant;
  style?: StyleProp<ViewStyle>;
}

/** Semantic tone → palette. The only mapping in the app. */
const TONE_COLORS: Record<TimeFitTone, string> = {
  success: theme.colors.success,
  warning: theme.colors.gold,
  danger: theme.colors.error,
};

/** Darkened text colours, matching the house Badge treatment. */
const TONE_TEXT: Record<TimeFitTone, string> = {
  success: '#2F6E45',
  warning: '#946312',
  danger: '#8E2C20',
};

export function TimeFitChip({
  layoverHours,
  tourHours,
  variant = 'full',
  style,
}: TimeFitChipProps) {
  const label = timeFitLabel(computeTimeFit(layoverHours, tourHours));
  if (!label) return null;

  const dot = TONE_COLORS[label.tone];
  const overlay = variant === 'overlay';
  const text = overlay ? '#FCF7EA' : TONE_TEXT[label.tone];

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={label.text}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          alignSelf: 'flex-start',
          borderRadius: theme.borderRadius.sm,
          borderWidth: 1,
          paddingHorizontal: variant === 'compact' ? 7 : 8,
          paddingVertical: 3,
          // On a photo, sit on the same ink slab the other stamps use so the
          // label stays readable whatever the image underneath is doing.
          backgroundColor: overlay ? 'rgba(14,25,41,0.62)' : `${dot}1A`,
          borderColor: overlay ? 'rgba(255,255,255,0.18)' : `${dot}40`,
        },
        style,
      ]}
    >
      <View
        style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dot }}
      />
      <Text
        numberOfLines={1}
        style={{
          fontFamily: theme.fonts.monoMed,
          fontSize: variant === 'full' ? 10 : 9.5,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          color: text,
        }}
      >
        {variant === 'full' ? label.text : label.short}
      </Text>
    </View>
  );
}
