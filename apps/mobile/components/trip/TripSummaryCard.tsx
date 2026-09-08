/**
 * The traveler's trip, shown rather than asked for.
 *
 * This replaces the "Preferred Dates" / "Number of Travelers" / "Your Flight
 * Details" sections on the booking screen. Those re-collected six values the
 * traveler had already given at onboarding, wrote them to a different table,
 * and never synced either direction — so a correction made while booking never
 * reached the profile, and the next booking pre-filled the stale values again.
 *
 * One card, one "Edit" affordance, one source of truth.
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/config/theme';
import { formatMumbaiShortDate, formatMumbaiTime } from '@/lib/dateTime';
import { PARTY_TYPE_OPTIONS } from '@/config/profileOptions';
import type { PartyType } from '@/lib/api/travelerProfile';

interface TripSummaryCardProps {
  arrivalAt: string | null;
  departureAt: string | null;
  flightIn?: string | null;
  flightOut?: string | null;
  groupSize?: number;
  partyType?: PartyType | null;
  onEdit: () => void;
}

function partyLabel(partyType: PartyType | null | undefined): string | null {
  return PARTY_TYPE_OPTIONS.find((p) => p.key === partyType)?.label ?? null;
}

function formatWindow(arrivalAt: string, departureAt: string): string | null {
  const minutes = Math.round(
    (Date.parse(departureAt) - Date.parse(arrivalAt)) / 60_000,
  );
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h in Mumbai` : `${h}h ${m}m in Mumbai`;
}

function Leg({
  label,
  at,
  flight,
}: {
  label: string;
  at: string;
  flight?: string | null;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
      <Text
        style={{
          width: 54,
          fontFamily: theme.fonts.mono,
          fontSize: 10.5,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          color: theme.colors.textMuted,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          flex: 1,
          fontFamily: theme.fonts.bodySemi,
          fontSize: 14.5,
          color: theme.colors.text,
        }}
      >
        {formatMumbaiShortDate(at)} · {formatMumbaiTime(at)}
      </Text>
      {flight ? (
        <Text
          style={{
            fontFamily: theme.fonts.monoMed,
            fontSize: 12,
            color: theme.colors.textSecondary,
          }}
        >
          {flight}
        </Text>
      ) : null}
    </View>
  );
}

export function TripSummaryCard({
  arrivalAt,
  departureAt,
  flightIn,
  flightOut,
  groupSize = 1,
  partyType,
  onEdit,
}: TripSummaryCardProps) {
  const hasTrip = Boolean(arrivalAt && departureAt);

  // No layover on file — the traveler can't send an inquiry without one, so
  // make adding it the obvious next tap rather than a validation error later.
  if (!hasTrip) {
    return (
      <TouchableOpacity
        onPress={onEdit}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel="Add your Mumbai layover"
        style={{
          borderRadius: theme.borderRadius.lg,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: theme.colors.primary,
          backgroundColor: theme.colors.primaryLight,
          padding: 16,
          marginBottom: 24,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Feather name="plus-circle" size={20} color={theme.colors.primaryDark} />
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: theme.fonts.displaySemi,
              fontSize: 15,
              color: theme.colors.text,
            }}
          >
            Add your Mumbai layover
          </Text>
          <Text
            style={{
              fontFamily: theme.fonts.body,
              fontSize: 12.5,
              lineHeight: 18,
              color: theme.colors.textSecondary,
              marginTop: 2,
            }}
          >
            We need your arrival and departure to check a tour fits.
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  const window = formatWindow(arrivalAt!, departureAt!);
  const party = partyLabel(partyType);
  const travellers = `${groupSize} ${groupSize === 1 ? 'traveller' : 'travellers'}`;

  return (
    <View
      style={{
        borderRadius: theme.borderRadius.lg,
        borderWidth: 1,
        borderColor: theme.colors.divider,
        backgroundColor: theme.colors.surface,
        padding: 16,
        marginBottom: 24,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <Text
          style={{
            ...theme.typography.eyebrow,
            color: theme.colors.textSecondary,
          }}
        >
          Your trip
        </Text>
        <TouchableOpacity
          onPress={onEdit}
          accessibilityRole="button"
          accessibilityLabel="Edit trip details"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
        >
          <Text
            style={{
              fontFamily: theme.fonts.bodySemi,
              fontSize: 13,
              color: theme.colors.primary,
            }}
          >
            Edit
          </Text>
          <Feather name="chevron-right" size={15} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={{ gap: 8 }}>
        <Leg label="Lands" at={arrivalAt!} flight={flightIn} />
        <Leg label="Leaves" at={departureAt!} flight={flightOut} />
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 6,
          marginTop: 12,
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: theme.colors.divider,
        }}
      >
        <Text
          style={{
            fontFamily: theme.fonts.monoMed,
            fontSize: 11,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
            color: theme.colors.textSecondary,
          }}
        >
          {[window, travellers, party].filter(Boolean).join('  ·  ')}
        </Text>
      </View>
    </View>
  );
}
