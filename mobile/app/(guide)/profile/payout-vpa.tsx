// ============================================================================
// PAYOUT VPA ENTRY — Guide (Phase 4)
// ============================================================================
// Collects the buddy's UPI VPA (e.g. name@upi) so the trip pot and final
// payout can be dispatched. Reached from qr-scan when error='vpa_missing'.
//
// After saving, navigates back to the qr-scan screen so the buddy can retry.
//
// Route: /(guide)/profile/payout-vpa
// ============================================================================

import { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { Header } from '@/components/ui/Header';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { theme } from '@/config/theme';
import { notify, confirmAsync } from '@/lib/ui/alert';

// Basic VPA validation: must contain @
function isValidVpa(vpa: string): boolean {
  return /^[a-zA-Z0-9._\-+]+@[a-zA-Z0-9]+$/.test(vpa.trim());
}

export default function PayoutVpaScreen() {
  const { returnBookingId } = useLocalSearchParams<{ returnBookingId?: string }>();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const [vpa,    setVpa]    = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const trimmed = vpa.trim();
    if (!isValidVpa(trimmed)) {
      notify('Invalid UPI ID', 'Enter a valid UPI VPA, e.g. yourname@upi or yourname@okaxis.');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');

      const { error } = await supabase
        .from('users')
        .update({ payout_vpa: trimmed })
        .eq('id', user.id);

      if (error) throw error;

      // Notify the user, then auto-navigate. We don't gate navigation on a
      // button tap here (the previous Alert.alert([{onPress}]) pattern was
      // silent on web — the button callback never fired, so saved VPAs
      // never made it back to the scanner).
      notify('UPI ID saved', 'Your UPI ID has been saved.');
      if (returnBookingId) {
        router.replace({
          pathname: '/(guide)/bookings/qr-scan/[bookingId]',
          params:   { bookingId: returnBookingId },
        } as never);
      } else {
        router.back();
      }
    } catch (err) {
      notify('Error', err instanceof Error ? err.message : 'Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header title="Add UPI ID" />
      <View style={[styles.body, { paddingBottom: insets.bottom }]}>
        {/* Icon */}
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: theme.colors.primaryLight, borderWidth: 1, borderColor: 'rgba(200,84,42,0.25)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
          <Feather name="credit-card" size={28} color={theme.colors.primary} />
        </View>

        <Text style={styles.heading}>Your UPI ID</Text>
        <Text style={styles.sub}>
          We need your UPI VPA to release the trip fund when a traveler scans their QR code.
          You'll also receive your final payout here after the trip.
        </Text>

        <Text style={styles.label}>UPI ID (VPA)</Text>
        <TextInput
          style={styles.input}
          placeholder="yourname@upi"
          placeholderTextColor={theme.colors.textMuted}
          value={vpa}
          onChangeText={setVpa}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          returnKeyType="done"
          onSubmitEditing={handleSave}
        />
        <Text style={styles.hint}>
          Examples: yourname@okaxis · yourname@oksbi · yourname@upi
        </Text>

        <Button
          title={saving ? 'Saving…' : 'Save UPI ID'}
          onPress={handleSave}
          disabled={saving || !vpa.trim()}
          style={styles.btn}
        />

        <Text style={styles.privacy}>
          Your UPI ID is stored securely and used only to send your payouts.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: theme.colors.background },
  body:    { flex: 1, padding: 24 },
  icon:    { fontSize: 48, textAlign: 'center', marginBottom: 16, marginTop: 8 },
  heading: { fontSize: 22, fontWeight: '800', color: theme.colors.text, textAlign: 'center', marginBottom: 8 },
  sub:     { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  label:   { fontSize: 13, fontWeight: '600', color: theme.colors.text, marginBottom: 8 },
  input:   {
    borderWidth:      1.5,
    borderColor:      theme.colors.divider,
    borderRadius:     12,
    padding:          14,
    fontSize:         16,
    color:            theme.colors.text,
    backgroundColor:  '#FFFFFF',
    marginBottom:     6,
  },
  hint:    { fontSize: 12, color: theme.colors.textMuted, marginBottom: 24 },
  btn:     { marginBottom: 16 },
  privacy: { fontSize: 12, color: theme.colors.textMuted, textAlign: 'center', lineHeight: 18 },
});
