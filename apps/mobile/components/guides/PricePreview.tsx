/**
 * What a party of each size actually pays.
 *
 * A Buddy setting two numbers instead of one needs to see the shape they add
 * up to — otherwise "base ₹500 + ₹1,200 each" is arithmetic they have to do in
 * their head for every group size before they can tell whether it's fair.
 */

import React from 'react';
import { View, Text } from 'react-native';
import { theme } from '@/config/theme';
import { partyPriceLadder } from '@/lib/booking/tourPricing';

interface PricePreviewProps {
  baseInr: number | null | undefined;
  perPersonInr: number | null | undefined;
}

export function PricePreview({ baseInr, perPersonInr }: PricePreviewProps) {
  const ladder = partyPriceLadder(baseInr, perPersonInr);
  const priced = ladder.some((row) => row.total > 0);

  return (
    <View
      style={{
        marginTop: 12,
        padding: 12,
        borderRadius: theme.borderRadius.md,
        backgroundColor: theme.colors.surfaceMuted,
        borderWidth: 1,
        borderColor: theme.colors.divider,
      }}
    >
      <Text
        style={{
          ...theme.typography.eyebrow,
          color: theme.colors.textSecondary,
          marginBottom: 10,
        }}
      >
        What a group pays
      </Text>

      {priced ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {ladder.map((row) => (
            <View
              key={row.size}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: 8,
                borderRadius: theme.borderRadius.sm,
                backgroundColor: theme.colors.surface,
                borderWidth: 1,
                borderColor: theme.colors.divider,
              }}
            >
              <Text
                style={{
                  fontFamily: theme.fonts.mono,
                  fontSize: 10,
                  letterSpacing: 0.4,
                  color: theme.colors.textMuted,
                }}
              >
                {row.size === 1 ? '1 PERSON' : `${row.size} PEOPLE`}
              </Text>
              <Text
                style={{
                  fontFamily: theme.fonts.monoMed,
                  fontSize: 14,
                  color: theme.colors.text,
                  marginTop: 3,
                }}
              >
                {row.label}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text
          style={{
            fontFamily: theme.fonts.body,
            fontSize: 12.5,
            lineHeight: 18,
            color: theme.colors.textMuted,
          }}
        >
          Set a base charge, a per-person charge, or both — travellers pay the
          base once, plus the per-person charge for everyone in their group.
        </Text>
      )}
    </View>
  );
}
