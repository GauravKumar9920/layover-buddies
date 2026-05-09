// ============================================================================
// TOP-UP APPROVAL MODAL — Traveler (Phase 4)
// ============================================================================
// Shown when the traveler's live screen detects an active top-up request
// (useTopUpRequest returns a non-null row). The buddy waits while this is
// visible.
//
// Approve → decideTopUp → createTopUpOrder → openTopUpCheckout.
// Decline → decideTopUp({ decision: 'decline' }) → modal dismisses.
// ============================================================================

import { useState, useEffect } from 'react';
import {
  Modal, View, Text, StyleSheet, ActivityIndicator, Alert, TouchableOpacity,
} from 'react-native';
import { decideTopUp, createTopUpOrder, openTopUpCheckout } from '@/lib/api/topUp';
import { formatPaise } from '@/lib/booking/money';
import { financialCopy } from '@/lib/copy/financial';
import { theme } from '@/config/theme';
import type { TopUpRequest } from '@/lib/hooks/useTrip';

interface Props {
  visible:       boolean;
  request:       TopUpRequest | null;
  bookingId:     string;
  buddyName:     string;
  travelerName?: string;
  travelerEmail?: string;
  onDismiss:     () => void;
}

export function TopUpApprovalModal({
  visible,
  request,
  bookingId,
  buddyName,
  travelerName,
  travelerEmail,
  onDismiss,
}: Props) {
  const [deciding, setDeciding] = useState(false);
  const copy = financialCopy.topUpRequest.traveler;

  // Reset state when a new request comes in.
  useEffect(() => {
    if (visible) setDeciding(false);
  }, [visible, request?.id]);

  if (!request) return null;

  const minutesLeft = Math.max(
    0,
    Math.round((new Date(request.expires_at).getTime() - Date.now()) / 60_000),
  );

  async function handleDecide(decision: 'approve' | 'decline') {
    if (!request) return;
    setDeciding(true);
    try {
      const result = await decideTopUp({ topUpRequestId: request.id, decision });

      if (decision === 'decline' || !result.proceed) {
        onDismiss();
        return;
      }

      // Approved → open checkout.
      const order = await createTopUpOrder({
        bookingId,
        topUpRequestId: request.id,
      });

      await openTopUpCheckout({
        order,
        travelerName,
        travelerEmail,
        purpose: request.purpose,
      });

      // Webhook handles capture → realtime clears the modal automatically.
      onDismiss();
    } catch (err) {
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Something went wrong. Try again.',
      );
    } finally {
      setDeciding(false);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {/* Header */}
          <Text style={styles.heading}>{copy.heading(buddyName)}</Text>
          <Text style={styles.expiry}>{copy.expiresIn(minutesLeft)}</Text>

          {/* Request details */}
          <View style={styles.detailBox}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Category</Text>
              <Text style={styles.detailValue}>{request.category}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>What for?</Text>
              <Text style={styles.detailValue}>{request.purpose}</Text>
            </View>
            <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.detailLabel}>Amount</Text>
              <Text style={[styles.detailValue, styles.amount]}>
                {formatPaise(request.requested_paise)}
              </Text>
            </View>
          </View>

          <Text style={styles.approveNote}>{copy.approveNote}</Text>

          {/* Action buttons */}
          {deciding ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={styles.loadingText}>Processing…</Text>
            </View>
          ) : (
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.btn, styles.declineBtn]}
                onPress={() => handleDecide('decline')}
              >
                <Text style={styles.declineBtnText}>
                  {financialCopy.buttons.declineTopUp}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.approveBtn]}
                onPress={() => handleDecide('approve')}
              >
                <Text style={styles.approveBtnText}>
                  {financialCopy.buttons.approveTopUp}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:        { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  heading:      { fontSize: 20, fontWeight: '800', color: theme.colors.text, marginBottom: 4 },
  expiry:       { fontSize: 13, color: '#D97706', fontWeight: '600', marginBottom: 20 },
  detailBox:    { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 16, marginBottom: 16 },
  detailRow:    { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.divider },
  detailLabel:  { fontSize: 13, color: theme.colors.textSecondary },
  detailValue:  { fontSize: 13, color: theme.colors.text, fontWeight: '600', textAlign: 'right', flex: 1, marginLeft: 12 },
  amount:       { fontSize: 18, fontWeight: '800', color: theme.colors.primary },
  approveNote:  { fontSize: 13, color: theme.colors.textSecondary, marginBottom: 20, lineHeight: 18 },
  loadingRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  loadingText:  { fontSize: 14, color: theme.colors.textSecondary },
  buttonRow:    { flexDirection: 'row', gap: 12 },
  btn:          { flex: 1, paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  declineBtn:   { backgroundColor: '#F1F5F9', borderWidth: 1.5, borderColor: theme.colors.divider },
  declineBtnText:{ fontSize: 15, fontWeight: '700', color: theme.colors.textSecondary },
  approveBtn:   { backgroundColor: theme.colors.primary },
  approveBtnText:{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
