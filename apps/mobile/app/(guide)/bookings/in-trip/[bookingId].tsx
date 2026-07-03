// ============================================================================
// BUDDY IN-TRIP SCREEN — Guide (Phase 4)
// ============================================================================
// Shown to the buddy while status = in_progress.
// Displays: trip pot remaining, elapsed time, trip details.
// "End trip" CTA → calls end-trip Edge fn → awaiting_proofs → upload-proofs.
// "Request extra funds" → Stage E top-up modal (stub alert for now).
//
// Route: /(guide)/bookings/in-trip/[bookingId]
// ============================================================================

import { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, Alert, ActivityIndicator, ScrollView,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header } from '@/components/ui/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TopUpRequestForm } from '@/components/bookings/TopUpRequestForm';
import { SafetyBar } from '@/components/bookings/SafetyBar';
import { useTrip } from '@/lib/hooks/useTrip';
import { endTrip } from '@/lib/api/tripLifecycle';
import { financialCopy } from '@/lib/copy/financial';
import { formatPaise } from '@/lib/booking/money';
import { supabase } from '@/lib/supabase';
import { theme } from '@/config/theme';

export default function GuideInTripScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { booking, agreement, topUpRequests, loading, error, reload } = useTrip(bookingId ?? null);
  const [ending, setEnding] = useState(false);
  const [elapsed, setElapsed] = useState('');
  const [topUpFormVisible, setTopUpFormVisible] = useState(false);
  const [travelerName, setTravelerName] = useState('the traveler');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Traveler name for the safety bar copy — useTrip's slim booking row
  // doesn't join users, so fetch it once here.
  useEffect(() => {
    if (!booking?.traveler_id) return;
    supabase
      .from('users')
      .select('full_name')
      .eq('id', booking.traveler_id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.full_name) setTravelerName(data.full_name.split(' ')[0]);
      });
  }, [booking?.traveler_id]);

  // Navigate away when trip ends.
  useEffect(() => {
    if (booking?.status === 'awaiting_proofs') {
      router.replace({
        pathname: '/(guide)/bookings/upload-proofs/[bookingId]',
        params:   { bookingId },
      } as never);
    }
  }, [booking?.status, bookingId, router]);

  // Elapsed timer — counts up from when status became in_progress.
  // We approximate using agreement.trip_starts_at as the anchor.
  useEffect(() => {
    function tick() {
      if (!agreement) return;
      const started = new Date(agreement.trip_starts_at).getTime();
      const now     = Date.now();
      const diffMs  = Math.max(0, now - started);
      const h       = Math.floor(diffMs / 3_600_000);
      const m       = Math.floor((diffMs % 3_600_000) / 60_000);
      const s       = Math.floor((diffMs % 60_000) / 1_000);
      if (h > 0) {
        setElapsed(`${h}h ${m.toString().padStart(2, '0')}m`);
      } else {
        setElapsed(`${m}m ${s.toString().padStart(2, '0')}s`);
      }
    }
    tick();
    intervalRef.current = setInterval(tick, 1_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [agreement]);

  // ── Trip pot calculation ───────────────────────────────────────────────────
  const tripPotPaise = agreement
    ? agreement.itinerary_fund_paise + agreement.buffer_paise
    : 0;

  // ── End trip ───────────────────────────────────────────────────────────────
  async function handleEndTrip() {
    if (!bookingId) return;
    Alert.alert(
      'End trip?',
      financialCopy.tripEndProofs.heading +
        '\n\nYou\'ll be asked to upload expense proofs. The traveler will see a "Trip complete" screen.',
      [
        { text: 'Not yet', style: 'cancel' },
        {
          text: financialCopy.buttons.endTrip,
          style: 'destructive',
          onPress: async () => {
            setEnding(true);
            try {
              await endTrip(bookingId);
              // Realtime will flip status → awaiting_proofs → useEffect navigates.
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Could not end trip. Try again.');
              setEnding(false);
            }
          },
        },
      ],
    );
  }

  // ── Top-up ─────────────────────────────────────────────────────────────────
  function handleRequestTopUp() {
    setTopUpFormVisible(true);
  }

  // ── Loading / error ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (error || !booking || !agreement) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? 'Booking not found'}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <Header title="Trip in progress" showBack={false} />

      {/* Top-up request form */}
      <TopUpRequestForm
        visible={topUpFormVisible}
        bookingId={bookingId ?? ''}
        pendingRequest={topUpRequests[0] ?? null}
        onRequestSent={() => setTopUpFormVisible(false)}
        onCancel={() => setTopUpFormVisible(false)}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />}
      >
        {/* Live badge */}
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
          {elapsed ? <Text style={styles.elapsedText}> · {elapsed}</Text> : null}
        </View>

        {/* Trip pot card */}
        <Card style={styles.potCard}>
          <Text style={styles.potLabel}>Trip fund</Text>
          <Text style={styles.potAmount}>{formatPaise(tripPotPaise)}</Text>
          <Text style={styles.potSub}>
            Itinerary {formatPaise(agreement.itinerary_fund_paise)} + buffer {formatPaise(agreement.buffer_paise)}
          </Text>
          <Text style={styles.potNote}>
            This was released to your UPI when the trip started. Unused buffer refunds to the traveler on reconciliation.
          </Text>
        </Card>

        {/* Top-up CTA */}
        <Button
          title={financialCopy.buttons.requestTopUp}
          variant="secondary"
          onPress={handleRequestTopUp}
          style={styles.topUpBtn}
        />

        {/* Trip details */}
        <Card style={styles.detailsCard}>
          <Text style={styles.detailsHeading}>Trip details</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Starts</Text>
            <Text style={styles.detailValue}>
              {new Date(agreement.trip_starts_at).toLocaleString('en-IN', {
                dateStyle: 'medium', timeStyle: 'short',
              })}
            </Text>
          </View>
          {agreement.trip_ends_at && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Ends</Text>
              <Text style={styles.detailValue}>
                {new Date(agreement.trip_ends_at).toLocaleString('en-IN', {
                  dateStyle: 'medium', timeStyle: 'short',
                })}
              </Text>
            </View>
          )}
        </Card>

        {/* End trip */}
        <Button
          title={ending ? 'Ending trip…' : financialCopy.buttons.endTrip}
          onPress={handleEndTrip}
          disabled={ending}
          style={styles.endBtn}
        />

        <Text style={styles.endNote}>
          End the trip when you've said goodbye. You'll then upload payment proofs for all expenses.
        </Text>
      </ScrollView>

      {/* SOS / Help / Contact — guides need the emergency path too */}
      <SafetyBar
        bookingId={bookingId ?? ''}
        contactName={travelerName}
        insets={insets}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root:            { flex: 1, backgroundColor: theme.colors.background },
  centered:        { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText:       { color: '#991B1B', fontSize: 15 },
  scroll:          { flex: 1 },
  // Extra bottom padding so the fixed SafetyBar never covers "End trip".
  scrollContent:   { padding: 20, paddingBottom: 120 },

  liveBadge: {
    flexDirection:    'row',
    alignItems:       'center',
    alignSelf:        'flex-start',
    backgroundColor:  '#DCFCE7',
    borderRadius:     20,
    paddingHorizontal: 12,
    paddingVertical:  6,
    marginBottom:     20,
    gap:              6,
  },
  liveDot:         { width: 8, height: 8, borderRadius: 4, backgroundColor: '#16A34A' },
  liveText:        { fontSize: 12, fontWeight: '800', color: '#16A34A', letterSpacing: 1 },
  elapsedText:     { fontSize: 12, color: '#16A34A', fontWeight: '600' },

  potCard:         { marginBottom: 12, padding: 20, alignItems: 'center' },
  potLabel:        { fontSize: 13, color: theme.colors.textSecondary, marginBottom: 4 },
  potAmount:       { fontSize: 36, fontWeight: '800', color: theme.colors.text, marginBottom: 4 },
  potSub:          { fontSize: 12, color: theme.colors.textMuted, marginBottom: 12 },
  potNote:         { fontSize: 12, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 18 },

  topUpBtn:        { marginBottom: 16 },

  detailsCard:     { marginBottom: 24, padding: 16 },
  detailsHeading:  { fontSize: 14, fontWeight: '700', color: theme.colors.text, marginBottom: 12 },
  detailRow:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: theme.colors.divider },
  detailLabel:     { fontSize: 13, color: theme.colors.textSecondary },
  detailValue:     { fontSize: 13, fontWeight: '600', color: theme.colors.text, textAlign: 'right', flex: 1, marginLeft: 12 },

  endBtn:          { marginBottom: 12 },
  endNote:         { fontSize: 12, color: theme.colors.textMuted, textAlign: 'center', lineHeight: 18 },
});
