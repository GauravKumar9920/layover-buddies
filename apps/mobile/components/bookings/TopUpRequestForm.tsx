// ============================================================================
// TOP-UP REQUEST FORM — Buddy (Phase 4)
// ============================================================================
// Modal body for the buddy to send a top-up request. Used inside the
// in-trip screen (Stage E wire-up). Calls requestTopUp on submit.
// Shows pending state while awaiting traveler decision via Realtime.
// ============================================================================

import { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, Alert, ScrollView,
  Modal, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { requestTopUp, cancelTopUpRequest } from '@/lib/api/topUp';
import { formatPaise } from '@/lib/booking/money';
import { financialCopy } from '@/lib/copy/financial';
import { theme } from '@/config/theme';
import type { TopUpRequest } from '@/lib/hooks/useTrip';

const EXPENSE_CATEGORIES = ['Food', 'Transport', 'Entry', 'Shopping', 'Other'] as const;
type Category = (typeof EXPENSE_CATEGORIES)[number];

interface Props {
  visible:          boolean;
  bookingId:        string;
  pendingRequest:   TopUpRequest | null; // existing pending/approved row (if any)
  onRequestSent:    () => void;          // called after successful requestTopUp
  onCancel:         () => void;          // close the modal without submitting
}

export function TopUpRequestForm({
  visible, bookingId, pendingRequest, onRequestSent, onCancel,
}: Props) {
  const [category,  setCategory]  = useState<Category>('Food');
  const [purpose,   setPurpose]   = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const copy = financialCopy.topUpRequest.buddy;

  async function handleSubmit() {
    const amountPaise = Math.round(parseFloat(amountStr) * 100);
    if (!amountStr || isNaN(amountPaise) || amountPaise <= 0) {
      Alert.alert('Required', 'Please enter a valid amount.');
      return;
    }
    if (!purpose.trim()) {
      Alert.alert('Required', 'Please describe what the funds are for.');
      return;
    }
    setSubmitting(true);
    try {
      await requestTopUp({
        bookingId,
        requestedPaise: amountPaise,
        category,
        purpose: purpose.trim(),
      });
      onRequestSent();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Request failed. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel() {
    if (!pendingRequest) { onCancel(); return; }
    setCancelling(true);
    try {
      await cancelTopUpRequest(pendingRequest.id);
      onCancel();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not cancel.');
    } finally {
      setCancelling(false);
    }
  }

  // If there's already a pending/approved request, show the pending state.
  if (pendingRequest && (pendingRequest.status === 'pending' || pendingRequest.status === 'approved')) {
    return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.heading}>{copy.pendingNote}</Text>
            <View style={styles.pendingBox}>
              <Text style={styles.pendingLabel}>{pendingRequest.category} — {pendingRequest.purpose}</Text>
              <Text style={styles.pendingAmount}>{formatPaise(pendingRequest.requested_paise)}</Text>
            </View>
            {cancelling ? (
              <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 16 }} />
            ) : (
              <TouchableOpacity style={styles.cancelRequestBtn} onPress={handleCancel}>
                <Text style={styles.cancelRequestText}>{financialCopy.buttons.cancelTopUp}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.heading}>{copy.heading}</Text>
          <Text style={styles.sub}>{copy.sub}</Text>

          {/* Category */}
          <Text style={styles.label}>{copy.categoryLabel}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chips}
            contentContainerStyle={{ gap: 8 }}
          >
            {EXPENSE_CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[styles.chip, category === cat && styles.chipActive]}
                onPress={() => setCategory(cat)}
              >
                <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Amount */}
          <Text style={styles.label}>{copy.amountLabel} (₹)</Text>
          <TextInput
            style={styles.input}
            placeholder="0.00"
            placeholderTextColor={theme.colors.textMuted}
            keyboardType="decimal-pad"
            value={amountStr}
            onChangeText={setAmountStr}
          />

          {/* Purpose */}
          <Text style={styles.label}>{copy.purposeLabel}</Text>
          <TextInput
            style={[styles.input, styles.purposeInput]}
            placeholder={copy.purposePlaceholder}
            placeholderTextColor={theme.colors.textMuted}
            value={purpose}
            onChangeText={setPurpose}
            multiline
            numberOfLines={2}
          />

          {/* Actions */}
          <View style={styles.buttonRow}>
            <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={onCancel}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.submitBtn, (submitting) && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>{copy.submit}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop:          { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:             { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  heading:           { fontSize: 20, fontWeight: '800', color: theme.colors.text, marginBottom: 6 },
  sub:               { fontSize: 14, color: theme.colors.textSecondary, marginBottom: 20, lineHeight: 20 },
  label:             { fontSize: 13, fontWeight: '600', color: theme.colors.text, marginBottom: 8, marginTop: 12 },
  chips:             { marginBottom: 4 },
  chip:              { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: theme.colors.divider },
  chipActive:        { borderColor: theme.colors.primary, backgroundColor: '#FFF7ED' },
  chipText:          { fontSize: 13, color: theme.colors.textSecondary, fontWeight: '600' },
  chipTextActive:    { color: theme.colors.primary },
  input:             { borderWidth: 1.5, borderColor: theme.colors.divider, borderRadius: 12, padding: 12, fontSize: 15, color: theme.colors.text },
  purposeInput:      { height: 72, textAlignVertical: 'top' },
  buttonRow:         { flexDirection: 'row', gap: 12, marginTop: 20 },
  btn:               { flex: 1, paddingVertical: 16, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cancelBtn:         { backgroundColor: '#F1F5F9', borderWidth: 1.5, borderColor: theme.colors.divider },
  cancelBtnText:     { fontSize: 15, fontWeight: '700', color: theme.colors.textSecondary },
  submitBtn:         { backgroundColor: theme.colors.primary },
  submitBtnText:     { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  btnDisabled:       { opacity: 0.6 },
  pendingBox:        { backgroundColor: '#FFF7ED', borderRadius: 12, padding: 16, marginTop: 12, marginBottom: 20 },
  pendingLabel:      { fontSize: 14, color: theme.colors.text, marginBottom: 4 },
  pendingAmount:     { fontSize: 22, fontWeight: '800', color: theme.colors.primary },
  cancelRequestBtn:  { borderWidth: 1.5, borderColor: theme.colors.divider, borderRadius: 12, padding: 14, alignItems: 'center' },
  cancelRequestText: { fontSize: 15, fontWeight: '600', color: theme.colors.textSecondary },
});
