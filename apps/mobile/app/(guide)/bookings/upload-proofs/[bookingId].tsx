// ============================================================================
// UPLOAD PROOFS — Guide (Phase 4)
// ============================================================================
// Buddy uploads one expense proof per spend during the trip.
// Each proof: category, description (optional), amount, payment screenshot
// (required), bill photo (optional).
//
// Flow:
//   1. Buddy adds proofs one by one.
//   2. Each proof is uploaded to Storage immediately on add (multi-step form).
//   3. "Submit proofs" calls submit-proofs Edge fn → reconciliation → completed.
//   4. On success, navigate to buddy receipt screen.
//
// Route: /(guide)/bookings/upload-proofs/[bookingId]
// ============================================================================

import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Alert, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Header } from '@/components/ui/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useTrip } from '@/lib/hooks/useTrip';
import { uploadExpenseProof, deleteExpenseProof } from '@/lib/api/expenseProofs';
import type { ProofFile } from '@/lib/api/expenseProofs';
import { submitProofs } from '@/lib/api/tripLifecycle';
import { formatPaise } from '@/lib/booking/money';
import { financialCopy } from '@/lib/copy/financial';
import { theme } from '@/config/theme';
import { GUIDE_CATEGORIES } from '@/config/constants';
import type { ExpenseProof } from '@/lib/api/expenseProofs';

// ── Inline category selector ─────────────────────────────────────────────────
const EXPENSE_CATEGORIES = ['Food', 'Transport', 'Entry', 'Shopping', 'Other'] as const;
type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

// ── Add-proof modal state ────────────────────────────────────────────────────
interface DraftProof {
  category:         ExpenseCategory;
  description:      string;
  amountRupees:     string;
  paymentProofUri:  string | null;
  paymentProofMime: string | null;
  billUri:          string | null;
  billMime:         string | null;
}

const EMPTY_DRAFT: DraftProof = {
  category:         'Food',
  description:      '',
  amountRupees:     '',
  paymentProofUri:  null,
  paymentProofMime: null,
  billUri:          null,
  billMime:         null,
};

export default function UploadProofsScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { booking, loading, error, expenseProofs, reload } = useTrip(bookingId ?? null);

  const [showForm,    setShowForm]    = useState(false);
  const [draft,       setDraft]       = useState<DraftProof>({ ...EMPTY_DRAFT });
  const [uploading,   setUploading]   = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [deletingId,  setDeletingId]  = useState<string | null>(null);

  const copy = financialCopy.tripEndProofs;

  // Navigate on status change.
  useEffect(() => {
    if (booking?.status === 'completed' || booking?.status === 'reconciling') {
      router.replace({
        pathname: '/(guide)/bookings/receipt/[bookingId]',
        params:   { bookingId },
      } as never);
    }
  }, [booking?.status, bookingId, router]);

  // ── Image picker helpers ────────────────────────────────────────────────────
  async function pickImage(kind: 'payment' | 'bill') {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality:    0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    setPickedAsset(kind, result.assets[0]);
  }

  async function takePhoto(kind: 'payment' | 'bill') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission denied', 'Camera permission is needed to take photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    setPickedAsset(kind, result.assets[0]);
  }

  // Store the picked/captured asset's URI + mimeType so the upload can send the
  // correct content type (the ArrayBuffer we upload has no `.type`).
  function setPickedAsset(kind: 'payment' | 'bill', asset: ImagePicker.ImagePickerAsset) {
    const mime = asset.mimeType ?? null;
    if (kind === 'payment') {
      setDraft(d => ({ ...d, paymentProofUri: asset.uri, paymentProofMime: mime }));
    } else {
      setDraft(d => ({ ...d, billUri: asset.uri, billMime: mime }));
    }
  }

  function handlePickImage(kind: 'payment' | 'bill') {
    Alert.alert(
      'Add photo',
      undefined,
      [
        { text: 'Take photo',       onPress: () => takePhoto(kind) },
        { text: 'Choose from library', onPress: () => pickImage(kind) },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }

  // ── URI → upload-ready file ──────────────────────────────────────────────────
  // Reads the file as an ArrayBuffer, not a Blob: RN Blobs upload an empty body
  // to Supabase Storage and fail with "Network request failed".
  async function uriToProofFile(uri: string, mime: string | null): Promise<ProofFile> {
    const resp = await fetch(uri);
    const data = await resp.arrayBuffer();
    const ext = (uri.split('?')[0].split('.').pop() ?? '').toLowerCase();
    const contentType =
      mime ??
      (ext === 'png'  ? 'image/png'  :
       ext === 'webp' ? 'image/webp' :
       ext === 'pdf'  ? 'application/pdf' :
       'image/jpeg');
    return { data, contentType };
  }

  // ── Submit single proof ─────────────────────────────────────────────────────
  async function handleAddProof() {
    if (!bookingId) return;
    if (!draft.paymentProofUri) {
      Alert.alert('Required', 'Please add a payment screenshot.');
      return;
    }
    const amountPaise = Math.round(parseFloat(draft.amountRupees) * 100);
    if (!draft.amountRupees || isNaN(amountPaise) || amountPaise <= 0) {
      Alert.alert('Required', 'Please enter a valid amount.');
      return;
    }

    setUploading(true);
    try {
      const paymentProof = await uriToProofFile(draft.paymentProofUri, draft.paymentProofMime);
      const bill         = draft.billUri
        ? await uriToProofFile(draft.billUri, draft.billMime)
        : undefined;

      await uploadExpenseProof({
        bookingId,
        category:    draft.category,
        description: draft.description || undefined,
        amountPaise,
        paymentProof,
        bill,
      });

      setDraft({ ...EMPTY_DRAFT });
      setShowForm(false);
      await reload();
    } catch (err) {
      Alert.alert('Upload failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setUploading(false);
    }
  }

  // ── Delete proof ────────────────────────────────────────────────────────────
  async function handleDeleteProof(proofId: string) {
    Alert.alert(
      copy.deleteConfirm,
      undefined,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            setDeletingId(proofId);
            try {
              await deleteExpenseProof(proofId);
              await reload();
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Could not remove.');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ],
    );
  }

  // ── Submit all proofs ───────────────────────────────────────────────────────
  async function handleSubmitProofs() {
    if (!bookingId) return;
    if (expenseProofs.length === 0) {
      Alert.alert('No proofs', 'Add at least one expense proof before submitting.');
      return;
    }
    Alert.alert(
      copy.submitCta,
      copy.submitSub(expenseProofs.length),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: copy.submitCta,
          onPress: async () => {
            setSubmitting(true);
            try {
              await submitProofs(bookingId);
              // Realtime will flip status; useEffect handles navigation.
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Submit failed. Try again.');
              setSubmitting(false);
            }
          },
        },
      ],
    );
  }

  // ── Total declared spend ────────────────────────────────────────────────────
  const totalDeclaredPaise = expenseProofs.reduce((s, p) => s + p.amount_paise, 0);

  // ── Loading / error ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }
  if (error || !booking) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? 'Booking not found'}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header title="Expense proofs" showBack={false} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header copy */}
        <Text style={styles.heading}>{copy.heading}</Text>
        <Text style={styles.sub}>{copy.sub}</Text>

        {/* Proofs deadline note */}
        {booking.proofs_due_at && (
          <View style={styles.deadlineBanner}>
            <Text style={styles.deadlineText}>
              ⏰ Upload by{' '}
              {new Date(booking.proofs_due_at).toLocaleString('en-IN', {
                dateStyle: 'medium', timeStyle: 'short',
              })}
            </Text>
          </View>
        )}

        {/* Uploaded proofs list */}
        {expenseProofs.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyHeading}>{copy.emptyState.heading}</Text>
            <Text style={styles.emptySub}>{copy.emptyState.sub}</Text>
          </Card>
        ) : (
          <>
            {expenseProofs.map((proof) => (
              <ProofRow
                key={proof.id}
                proof={proof}
                deleting={deletingId === proof.id}
                onDelete={() => handleDeleteProof(proof.id)}
              />
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total declared</Text>
              <Text style={styles.totalAmount}>{formatPaise(totalDeclaredPaise)}</Text>
            </View>
          </>
        )}

        {/* Add proof button */}
        {!showForm && (
          <Button
            title={financialCopy.buttons.addProof}
            variant="secondary"
            onPress={() => setShowForm(true)}
            style={styles.addBtn}
          />
        )}

        {/* Inline add-proof form */}
        {showForm && (
          <Card style={styles.formCard}>
            <Text style={styles.formHeading}>New expense</Text>

            {/* Category */}
            <Text style={styles.fieldLabel}>{copy.fields.category}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.categoryRow}
              contentContainerStyle={{ gap: 8 }}
            >
              {EXPENSE_CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryChip, draft.category === cat && styles.categoryChipActive]}
                  onPress={() => setDraft(d => ({ ...d, category: cat }))}
                >
                  <Text style={[styles.categoryChipText, draft.category === cat && styles.categoryChipTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Description */}
            <Text style={styles.fieldLabel}>{copy.fields.description}</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Lunch at Olympia Coffee"
              placeholderTextColor={theme.colors.textMuted}
              value={draft.description}
              onChangeText={t => setDraft(d => ({ ...d, description: t }))}
            />

            {/* Amount */}
            <Text style={styles.fieldLabel}>{copy.fields.amount} *</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              placeholderTextColor={theme.colors.textMuted}
              value={draft.amountRupees}
              onChangeText={t => setDraft(d => ({ ...d, amountRupees: t }))}
              keyboardType="decimal-pad"
            />

            {/* Payment proof */}
            <Text style={styles.fieldLabel}>{copy.fields.paymentProof} *</Text>
            {draft.paymentProofUri ? (
              <View style={styles.imagePreview}>
                <Image source={{ uri: draft.paymentProofUri }} style={styles.previewImage} contentFit="cover" />
                <TouchableOpacity
                  style={styles.removeImageBtn}
                  onPress={() => setDraft(d => ({ ...d, paymentProofUri: null }))}
                >
                  <Text style={styles.removeImageText}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.uploadBtn}
                onPress={() => handlePickImage('payment')}
              >
                <Text style={styles.uploadBtnText}>Add payment screenshot</Text>
              </TouchableOpacity>
            )}

            {/* Bill (optional) */}
            <Text style={styles.fieldLabel}>{copy.fields.bill}</Text>
            {draft.billUri ? (
              <View style={styles.imagePreview}>
                <Image source={{ uri: draft.billUri }} style={styles.previewImage} contentFit="cover" />
                <TouchableOpacity
                  style={styles.removeImageBtn}
                  onPress={() => setDraft(d => ({ ...d, billUri: null }))}
                >
                  <Text style={styles.removeImageText}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.uploadBtn}
                onPress={() => handlePickImage('bill')}
              >
                <Text style={styles.uploadBtnText}>Add bill / receipt</Text>
              </TouchableOpacity>
            )}

            {/* Form actions */}
            <View style={styles.formActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { setShowForm(false); setDraft({ ...EMPTY_DRAFT }); }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <Button
                title={uploading ? 'Uploading…' : 'Add expense'}
                onPress={handleAddProof}
                disabled={uploading}
                style={styles.saveBtn}
              />
            </View>
          </Card>
        )}

        {/* Submit all proofs */}
        {expenseProofs.length > 0 && !showForm && (
          <Card style={styles.submitCard}>
            <Text style={styles.submitHeading}>{copy.submitHeading}</Text>
            <Text style={styles.submitSub}>{copy.submitSub(expenseProofs.length)}</Text>
            <Button
              title={submitting ? 'Submitting…' : copy.submitCta}
              onPress={handleSubmitProofs}
              disabled={submitting}
            />
          </Card>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Proof row component ───────────────────────────────────────────────────────
function ProofRow({
  proof,
  deleting,
  onDelete,
}: {
  proof: ExpenseProof;
  deleting: boolean;
  onDelete: () => void;
}) {
  return (
    <View style={rowStyles.row}>
      <View style={rowStyles.rowLeft}>
        <View style={rowStyles.rowMeta}>
          <Text style={rowStyles.category}>{proof.category}</Text>
          {proof.description && (
            <Text style={rowStyles.description} numberOfLines={1}>{proof.description}</Text>
          )}
        </View>
        <Text style={rowStyles.amount}>{formatPaise(proof.amount_paise)}</Text>
      </View>
      <TouchableOpacity
        style={rowStyles.deleteBtn}
        onPress={onDelete}
        disabled={deleting}
      >
        {deleting ? (
          <ActivityIndicator size="small" color="#991B1B" />
        ) : (
          <Text style={rowStyles.deleteBtnText}>✕</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row:           { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 12, padding: 14, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  rowLeft:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowMeta:       { flex: 1 },
  category:      { fontSize: 13, fontWeight: '700', color: theme.colors.primary },
  description:   { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  amount:        { fontSize: 15, fontWeight: '700', color: theme.colors.text, marginLeft: 12 },
  deleteBtn:     { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center', marginLeft: 12 },
  deleteBtnText: { color: '#991B1B', fontWeight: '700', fontSize: 13 },
});

const styles = StyleSheet.create({
  root:            { flex: 1, backgroundColor: theme.colors.background },
  centered:        { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText:       { color: '#991B1B', fontSize: 15 },
  scroll:          { flex: 1 },
  scrollContent:   { padding: 20 },
  heading:         { fontSize: 22, fontWeight: '800', color: theme.colors.text, marginBottom: 6 },
  sub:             { fontSize: 14, color: theme.colors.textSecondary, marginBottom: 16, lineHeight: 20 },

  deadlineBanner:  { backgroundColor: '#FEF9C3', borderRadius: 10, padding: 12, marginBottom: 16 },
  deadlineText:    { fontSize: 13, color: '#854D0E', fontWeight: '600' },

  emptyCard:       { padding: 32, alignItems: 'center', marginBottom: 16 },
  emptyHeading:    { fontSize: 16, fontWeight: '700', color: theme.colors.text, marginBottom: 6 },
  emptySub:        { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center' },

  totalRow:        { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 4, marginBottom: 16 },
  totalLabel:      { fontSize: 14, fontWeight: '700', color: theme.colors.textSecondary },
  totalAmount:     { fontSize: 16, fontWeight: '800', color: theme.colors.text },

  addBtn:          { marginBottom: 24 },

  formCard:        { padding: 16, marginBottom: 24 },
  formHeading:     { fontSize: 16, fontWeight: '700', color: theme.colors.text, marginBottom: 16 },
  fieldLabel:      { fontSize: 13, fontWeight: '600', color: theme.colors.text, marginBottom: 6, marginTop: 12 },
  input:           { borderWidth: 1, borderColor: theme.colors.divider, borderRadius: 10, padding: 12, fontSize: 15, color: theme.colors.text, backgroundColor: '#FFF' },
  categoryRow:     { marginBottom: 4 },
  categoryChip:    { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: theme.colors.divider, backgroundColor: '#FFF' },
  categoryChipActive: { borderColor: theme.colors.primary, backgroundColor: '#FFF7ED' },
  categoryChipText: { fontSize: 13, color: theme.colors.textSecondary, fontWeight: '600' },
  categoryChipTextActive: { color: theme.colors.primary },
  uploadBtn:       { borderWidth: 1.5, borderColor: theme.colors.divider, borderStyle: 'dashed', borderRadius: 10, padding: 16, alignItems: 'center', backgroundColor: '#FAFAFA' },
  uploadBtnText:   { fontSize: 14, color: theme.colors.textSecondary, fontWeight: '600' },
  imagePreview:    { position: 'relative', marginBottom: 4 },
  previewImage:    { width: '100%', height: 120, borderRadius: 10 },
  removeImageBtn:  { position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  removeImageText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  formActions:     { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn:       { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: theme.colors.divider, alignItems: 'center' },
  cancelBtnText:   { fontSize: 15, fontWeight: '600', color: theme.colors.textSecondary },
  saveBtn:         { flex: 1 },

  submitCard:      { padding: 16, marginTop: 8 },
  submitHeading:   { fontSize: 16, fontWeight: '700', color: theme.colors.text, marginBottom: 6 },
  submitSub:       { fontSize: 14, color: theme.colors.textSecondary, marginBottom: 16, lineHeight: 20 },
});
