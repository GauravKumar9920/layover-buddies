// ============================================================================
// AGREEMENT DRAFTING SCREEN — Phase 2 (buddy only)
// ============================================================================
// The buddy fills in:
//   - Buddy fee (₹)
//   - Itinerary fund (₹)
//   - Buffer (₹) — auto-computed at 20% of itinerary, read-only
//   - Trip start datetime (validated > now + MIN_BOOKING_NOTICE_HOURS)
//   - Trip end datetime (optional)
//   - Cost line items (dynamic list)
//
// Live preview at the bottom shows the canonical pricing breakdown using
// `computeAgreementSnapshot` + `formatPaise`. This is the spec-mandated
// single rendering path; the Phase 1 fixture asserts the math reproduces
// `₹6,642.50` from canonical inputs.
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { notify, confirmAsync } from '@/lib/ui/alert';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Loading } from '@/components/ui/Loading';
import { theme } from '@/config/theme';
import { BUFFER_PERCENT, MIN_BOOKING_NOTICE_HOURS } from '@/config/constants';
import {
  paiseToRupees,
  rupeesToPaise,
  formatPaise,
} from '@/lib/booking/money';
import {
  computeAgreementSnapshot,
  InvalidBufferError,
} from '@/lib/booking/agreementSnapshot';
import {
  fetchAgreementByBooking,
  fetchLineItemsByAgreement,
  createAgreementDraft,
  saveAgreementDraft,
  upsertCostLineItems,
  sendAgreement,
  SendAgreementError,
  type Agreement,
  type CostCategory,
  type DraftLineItem,
} from '@/lib/api/agreements';
import { fetchBookingById } from '@/lib/api/bookings';

const CATEGORIES: CostCategory[] = ['food', 'transport', 'entry', 'activity', 'misc'];

export default function AgreementDraftScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [sending, setSending]   = useState(false);
  const [agreement, setAgreement] = useState<Agreement | null>(null);

  // Form state — kept in rupees for the input; converted to paise on save.
  const [buddyFeeRupees, setBuddyFeeRupees] = useState('');
  const [itineraryRupees, setItineraryRupees] = useState('');
  const [tripStart, setTripStart] = useState('');
  const [tripEnd, setTripEnd] = useState('');
  const [items, setItems] = useState<DraftLineItem[]>([]);

  // Derived
  const buddyFeePaise      = rupeesToPaise(parseFloat(buddyFeeRupees) || 0);
  const itineraryFundPaise = rupeesToPaise(parseFloat(itineraryRupees) || 0);
  const bufferPaise        = Math.floor(itineraryFundPaise * BUFFER_PERCENT);

  // ── Load existing draft (or default trip start to +1 day) ────────────────
  useEffect(() => {
    if (!bookingId) return;
    (async () => {
      try {
        const existing = await fetchAgreementByBooking(bookingId);
        if (existing) {
          setAgreement(existing);
          setBuddyFeeRupees(existing.buddy_fee_paise > 0 ? String(paiseToRupees(existing.buddy_fee_paise)) : '');
          setItineraryRupees(existing.itinerary_fund_paise > 100 ? String(paiseToRupees(existing.itinerary_fund_paise)) : '');
          setTripStart(existing.trip_starts_at);
          setTripEnd(existing.trip_ends_at ?? '');
          const li = await fetchLineItemsByAgreement(existing.id);
          setItems(li.map((row, i) => ({
            id:              row.id,
            category:        row.category,
            description:     row.description,
            estimated_paise: row.estimated_paise,
            position:        row.position ?? i,
          })));
        } else {
          // Seed trip start = +24h
          const seed = new Date(Date.now() + 24 * 60 * 60 * 1000);
          setTripStart(seed.toISOString());
        }
      } catch (err) {
        notify('Failed to load draft', err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    })();
  }, [bookingId]);

  // ── Live preview snapshot ────────────────────────────────────────────────
  const preview = useMemo(() => {
    if (buddyFeePaise <= 0 || itineraryFundPaise <= 0) return null;
    try {
      return computeAgreementSnapshot({
        buddyFeePaise, itineraryFundPaise, bufferPaise, gstRate: 0.05,
      });
    } catch (err) {
      if (err instanceof InvalidBufferError) return null;
      return null;
    }
  }, [buddyFeePaise, itineraryFundPaise, bufferPaise]);

  // ── Line items management ───────────────────────────────────────────────
  function addLineItem() {
    setItems((prev) => [
      ...prev,
      { category: 'food', description: '', estimated_paise: 0, position: prev.length },
    ]);
  }

  function updateItem(idx: number, patch: Partial<DraftLineItem>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx).map((it, i) => ({ ...it, position: i })));
  }

  // ── Save draft ──────────────────────────────────────────────────────────
  async function handleSave() {
    if (!bookingId || saving) return;

    if (itineraryFundPaise > 0 && bufferPaise !== Math.floor(itineraryFundPaise * BUFFER_PERCENT)) {
      notify('Buffer mismatch', 'Buffer must equal 20% of the itinerary fund.');
      return;
    }

    setSaving(true);
    try {
      // First save: ensure agreement row exists.
      let current = agreement;
      if (!current) {
        const booking = await fetchBookingById(bookingId);
        if (!booking) throw new Error('Booking not found');
        current = await createAgreementDraft({
          booking_id:     bookingId,
          trip_starts_at: tripStart || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          trip_ends_at:   tripEnd || null,
        });
        setAgreement(current);
      }

      // Patch fields (only money + dates).
      await saveAgreementDraft(current.id, {
        buddy_fee_paise:      buddyFeePaise,
        itinerary_fund_paise: itineraryFundPaise > 0 ? itineraryFundPaise : undefined,
        buffer_paise:         itineraryFundPaise > 0 ? bufferPaise : undefined,
        trip_starts_at:       tripStart || undefined,
        trip_ends_at:         tripEnd || null,
      });

      // Replace line items.
      await upsertCostLineItems(current.id, items);

      notify('Saved', 'Draft saved.');
    } catch (err) {
      notify('Save failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }

  // ── Send to traveler ────────────────────────────────────────────────────
  async function handleSend() {
    if (!agreement) {
      notify('Save first', 'Save the draft before sending.');
      return;
    }
    if (sending) return;

    if (!preview) {
      notify('Incomplete', 'Set a buddy fee and itinerary fund first.');
      return;
    }
    if (items.length === 0) {
      notify('Add line items', 'Add at least one cost line item before sending.');
      return;
    }
    const tripStartMs = new Date(tripStart).getTime();
    if (tripStartMs < Date.now() + MIN_BOOKING_NOTICE_HOURS * 60 * 60 * 1000) {
      notify('Trip too soon', `Trip must start at least ${MIN_BOOKING_NOTICE_HOURS}h from now.`);
      return;
    }

    const confirmed = await confirmAsync(
      'Send to traveler?',
      `They'll see a total of ${formatPaise(preview.travelerTotalPaise)} and need to sign and pay a ₹500 deposit to confirm.`,
      { confirmLabel: 'Send' },
    );
    if (!confirmed) return;

    setSending(true);
    try {
      // Save first to ensure server state matches form.
      await saveAgreementDraft(agreement.id, {
        buddy_fee_paise:      buddyFeePaise,
        itinerary_fund_paise: itineraryFundPaise,
        buffer_paise:         bufferPaise,
        trip_starts_at:       tripStart,
        trip_ends_at:         tripEnd || null,
      });
      await upsertCostLineItems(agreement.id, items);
      await sendAgreement(agreement.id);
      notify('Sent!', 'Traveler can now review and sign.');
      router.back();
    } catch (err) {
      const msg = err instanceof SendAgreementError
        ? err.message
        : err instanceof Error
          ? err.message
          : 'Unknown error';
      notify('Send failed', msg);
    } finally {
      setSending(false);
    }
  }

  if (loading) return <Loading fullScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top }}>
      <Header title="Draft agreement" showBack />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 80 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Money fields ───────────────────────────────────────────── */}
          <Card style={{ marginBottom: 16, padding: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: theme.colors.text, marginBottom: 12 }}>
              The numbers
            </Text>
            <Input
              label="Buddy fee (₹)"
              keyboardType="decimal-pad"
              value={buddyFeeRupees}
              onChangeText={setBuddyFeeRupees}
              placeholder="e.g. 2000"
              hint="Your fee for the day, before platform deductions."
              style={{ marginBottom: 12 }}
            />
            <Input
              label="Day's expenses fund (₹)"
              keyboardType="decimal-pad"
              value={itineraryRupees}
              onChangeText={setItineraryRupees}
              placeholder="e.g. 3000"
              hint="Food, transport, entries — for both of you."
              style={{ marginBottom: 12 }}
            />
            <View style={{
              backgroundColor: theme.colors.surfaceMuted ?? '#FAFAFA',
              borderRadius: theme.borderRadius.md,
              padding: 12,
              marginBottom: 4,
            }}>
              <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginBottom: 2 }}>
                Buffer (auto, 20%)
              </Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: theme.colors.text }}>
                {formatPaise(bufferPaise)}
              </Text>
              <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 4 }}>
                Refunded to traveler if unused.
              </Text>
            </View>
          </Card>

          {/* ── Trip times ────────────────────────────────────────────── */}
          <Card style={{ marginBottom: 16, padding: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: theme.colors.text, marginBottom: 12 }}>
              When
            </Text>
            <Input
              label="Trip start (ISO)"
              value={tripStart}
              onChangeText={setTripStart}
              placeholder="2026-05-04T09:00:00.000Z"
              hint={`At least ${MIN_BOOKING_NOTICE_HOURS}h from now.`}
              autoCapitalize="none"
              style={{ marginBottom: 12 }}
            />
            <Input
              label="Trip end (ISO, optional)"
              value={tripEnd}
              onChangeText={setTripEnd}
              placeholder="2026-05-04T17:00:00.000Z"
              autoCapitalize="none"
            />
          </Card>

          {/* ── Line items ─────────────────────────────────────────────── */}
          <Card style={{ marginBottom: 16, padding: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: theme.colors.text, marginBottom: 12 }}>
              Cost line items
            </Text>
            {items.length === 0 && (
              <Text style={{ color: theme.colors.textSecondary, fontSize: 13, marginBottom: 8 }}>
                Add at least one item describing what the day's expenses cover.
              </Text>
            )}
            {items.map((item, idx) => (
              <View key={idx} style={{
                borderWidth: 1, borderColor: theme.colors.divider,
                borderRadius: theme.borderRadius.md,
                padding: 10, marginBottom: 10,
              }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                  {CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => updateItem(idx, { category: cat })}
                      style={{
                        paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
                        backgroundColor: item.category === cat ? theme.colors.primary : theme.colors.surfaceMuted ?? '#F5F5F5',
                      }}
                    >
                      <Text style={{
                        color: item.category === cat ? '#FFFFFF' : theme.colors.textSecondary,
                        fontSize: 12, fontWeight: '600',
                      }}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  value={item.description}
                  onChangeText={(t) => updateItem(idx, { description: t })}
                  placeholder="What is this for?"
                  style={{
                    borderWidth: 1, borderColor: theme.colors.divider, borderRadius: 8,
                    paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, marginBottom: 6,
                  }}
                />
                <TextInput
                  value={item.estimated_paise > 0 ? String(paiseToRupees(item.estimated_paise)) : ''}
                  onChangeText={(t) =>
                    updateItem(idx, { estimated_paise: rupeesToPaise(parseFloat(t) || 0) })
                  }
                  placeholder="Estimated ₹"
                  keyboardType="decimal-pad"
                  style={{
                    borderWidth: 1, borderColor: theme.colors.divider, borderRadius: 8,
                    paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, marginBottom: 6,
                  }}
                />
                <TouchableOpacity onPress={() => removeItem(idx)}>
                  <Text style={{ color: theme.colors.error, fontSize: 12, fontWeight: '600' }}>
                    Remove
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
            <Button title="+ Add line item" variant="ghost" size="sm" onPress={addLineItem} />
          </Card>

          {/* ── Live preview ───────────────────────────────────────────── */}
          {preview && (
            <Card style={{ marginBottom: 16, padding: 16, backgroundColor: theme.colors.surfaceMuted }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 8, letterSpacing: 0.4 }}>
                TRAVELER WILL SEE
              </Text>
              <PreviewRow label="Buddy fee"      value={formatPaise(preview.buddyFeeTravelerViewPaise)} />
              <PreviewRow label="Day's expenses" value={formatPaise(itineraryFundPaise)} />
              <PreviewRow label="Buffer (20%)"   value={formatPaise(bufferPaise)} />
              <PreviewRow label="GST (5%)"       value={formatPaise(preview.travelerGstPaise)} />
              <PreviewRow label="Refundable deposit" value="₹500.00" />
              <View style={{ height: 1, backgroundColor: theme.colors.divider, marginVertical: 8 }} />
              <PreviewRow
                label="Total"
                value={formatPaise(preview.travelerTotalPaise)}
                bold
              />
            </Card>
          )}

          {/* ── Actions ────────────────────────────────────────────────── */}
          <View style={{ gap: 8 }}>
            <Button
              title={saving ? 'Saving…' : 'Save draft'}
              variant="secondary"
              onPress={handleSave}
              loading={saving}
              disabled={saving || sending}
            />
            <Button
              title={sending ? 'Sending…' : 'Send to traveler'}
              onPress={handleSend}
              loading={sending}
              disabled={saving || sending || !preview || items.length === 0}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function PreviewRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
      <Text style={{
        fontSize: bold ? 16 : 14,
        fontWeight: bold ? '700' : '500',
        color: theme.colors.text,
      }}>{label}</Text>
      <Text style={{
        fontSize: bold ? 16 : 14,
        fontWeight: bold ? '700' : '500',
        color: bold ? theme.colors.primary : theme.colors.text,
      }}>{value}</Text>
    </View>
  );
}
