// ============================================================================
// AGREEMENT VIEWER + SIGN + DEPOSIT — Phase 2 (both parties)
// ============================================================================
// Single screen that handles every Phase 2 lifecycle slice from the user's
// POV: review the agreement → sign → pay ₹500 deposit → see "deposit
// secured" once both sides post.
//
// The viewer is the authoritative renderer for the structured agreement —
// we deferred PDF rendering to Phase 2.5, so this screen IS the legal
// preview. All numbers use `formatPaise` so they exactly match the canonical
// fixture.
// ============================================================================

import { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { notify } from '@/lib/ui/alert';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';
import { theme } from '@/config/theme';
import { DEPOSIT_PAISE } from '@/config/constants';
import { formatPaise } from '@/lib/booking/money';
import { financialCopy } from '@/lib/copy/financial';
import { useAgreement } from '@/lib/hooks/useAgreement';
import { useAuth } from '@/lib/hooks/useAuth';
import { signAgreement, SignAgreementError } from '@/lib/api/agreementSign';
import {
  createDepositOrder,
  openDepositCheckout,
  fetchDeposits,
  type DepositSide,
} from '@/lib/api/deposits';
import {
  isRazorpayCheckoutUnavailableError,
} from '@/lib/api/razorpayCheckout';
import { confirmPayment } from '@/lib/api/confirmPayment';

export default function AgreementViewerScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const { booking, agreement, lineItems, deposits, loading, error, reload } = useAgreement(bookingId);

  const [signModalOpen, setSignModalOpen] = useState(false);
  const [signName,      setSignName]      = useState('');
  const [signing,       setSigning]       = useState(false);
  const [depositLoading, setDepositLoading] = useState(false);
  const [confirmingDeposit, setConfirmingDeposit] = useState(false);

  const viewerSide: DepositSide | null = useMemo(() => {
    if (!user || !booking) return null;
    if (booking.traveler_id === user.id) return 'traveler';
    if (booking.guide_id    === user.id) return 'buddy';
    return null;
  }, [user, booking]);

  // ── Computed signing state ───────────────────────────────────────────────
  const travelerSigned = !!agreement?.traveler_signed_at;
  const buddySigned    = !!agreement?.buddy_signed_at;

  const myDeposit = deposits.find((d) => d.side === viewerSide);

  const canSign = useMemo(() => {
    if (!viewerSide || !agreement) return false;
    if (agreement.status !== 'sent' && agreement.status !== 'signed_traveler' && agreement.status !== 'signed_guide') {
      return false;
    }
    if (viewerSide === 'traveler' && travelerSigned) return false;
    if (viewerSide === 'buddy'    && buddySigned)    return false;
    return true;
  }, [viewerSide, agreement, travelerSigned, buddySigned]);

  const canPayDeposit = useMemo(() => {
    if (!viewerSide || !booking || !agreement) return false;
    // `awaiting_deposits` = both sides still owe. `deposits_held` = one side
    // paid, the other still owes — that side must still see the Pay button.
    // The `myDeposit.status === 'pending'` check below guarantees we only
    // surface the button to the side that hasn't paid yet, so the booking
    // status gate just has to admit any pre-balance state.
    if (booking.status !== 'awaiting_deposits' && booking.status !== 'deposits_held') {
      return false;
    }
    return !myDeposit || myDeposit.status === 'pending';
  }, [viewerSide, booking, agreement, myDeposit]);

  // ── Handlers ────────────────────────────────────────────────────────────
  async function handleSubmitSignature() {
    if (!viewerSide || signing) return;
    if (!signName.trim()) {
      notify('Name required', 'Type your full name to sign.');
      return;
    }

    setSigning(true);
    try {
      await signAgreement(bookingId, viewerSide, signName);
      setSignModalOpen(false);
      setSignName('');
      await reload();
      notify('Signed!', 'Your signature has been recorded.');
    } catch (err) {
      const msg = err instanceof SignAgreementError ? err.message
        : err instanceof Error ? err.message
        : 'Sign failed';
      notify('Sign failed', msg);
    } finally {
      setSigning(false);
    }
  }

  async function handlePayDeposit() {
    if (!viewerSide || !booking || depositLoading) return;
    setDepositLoading(true);
    try {
      const order = await createDepositOrder(bookingId, viewerSide);
      // Open native checkout. The native SDK resolves with three signed
      // values (order_id, payment_id, signature). We POST those to
      // `confirm-payment` so the deposit settles on the spot even if
      // Razorpay's webhook never arrives (no webhook configured, KYC
      // pending, ngrok URL changed, etc.). When the webhook DOES arrive
      // later, the capture handler dedups on payment_id and no-ops.
      let result: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
      try {
        result = await openDepositCheckout({
          order,
          travelerName:  user?.user_metadata?.full_name as string | undefined,
          travelerEmail: user?.email,
        });
      } catch (checkoutErr) {
        if (isRazorpayCheckoutUnavailableError(checkoutErr)) {
          notify('Razorpay unavailable',
            'Razorpay checkout is unavailable in this build. Use the iOS or Android app to complete the deposit.');
          return;
        }
        // User cancellation also throws — quietly ignore.
        return;
      }

      setConfirmingDeposit(true);
      try {
        await confirmPayment({
          booking_id:          bookingId!,
          kind:                'deposit',
          side:                viewerSide,
          razorpay_order_id:   result.razorpay_order_id,
          razorpay_payment_id: result.razorpay_payment_id,
          razorpay_signature:  result.razorpay_signature,
        });
        // Webhook path stays in place as belt-and-braces; it's idempotent
        // against this confirm-payment call so calling both is safe.
        await reload();
      } catch (confirmErr) {
        // Even if confirm-payment fails (rare — network, signature mismatch),
        // the webhook is still in play. Fall back to the old poll-for-30s.
        const start      = Date.now();
        const TIMEOUT_MS = 30_000;
        let held = false;
        while (!held && Date.now() - start < TIMEOUT_MS) {
          await new Promise((r) => setTimeout(r, 1500));
          try {
            const fresh = await fetchDeposits(bookingId!);
            held = fresh.some((d) => d.side === viewerSide && d.status === 'held');
          } catch { /* transient read */ }
        }
        if (!held) {
          notify('Deposit confirmation pending',
            confirmErr instanceof Error ? confirmErr.message : 'The payment may have gone through. Please refresh in a moment.');
        }
      } finally {
        setConfirmingDeposit(false);
      }
    } catch (err) {
      notify('Deposit failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setDepositLoading(false);
    }
  }

  if (loading) return <Loading fullScreen />;

  if (error || !booking) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top }}>
        <Header title="Agreement" showBack />
        <View style={{ padding: 16 }}>
          <Text style={{ color: theme.colors.error }}>{error ?? 'Booking not found'}</Text>
        </View>
      </View>
    );
  }

  if (!agreement) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top }}>
        <Header title="Agreement" showBack />
        <View style={{ padding: 16 }}>
          <Text style={{ color: theme.colors.textSecondary }}>
            No agreement has been drafted yet for this booking.
          </Text>
        </View>
      </View>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────
  const cp = financialCopy.travelerPricing;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top }}>
      <Header title="Day agreement" showBack />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 80 }}>

        {/* ── The plan ─────────────────────────────────────────────────── */}
        <Card style={{ padding: 16, marginBottom: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary, letterSpacing: 0.4, marginBottom: 8 }}>
            THE PLAN
          </Text>
          <Text style={{ fontSize: 16, color: theme.colors.text, marginBottom: 4 }}>
            {new Date(agreement.trip_starts_at).toLocaleString('en-IN', {
              weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
            })}
          </Text>
          {agreement.trip_ends_at && (
            <Text style={{ fontSize: 14, color: theme.colors.textSecondary }}>
              Until {new Date(agreement.trip_ends_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          )}
        </Card>

        {/* ── Line items ──────────────────────────────────────────────── */}
        {lineItems.length > 0 && (
          <Card style={{ padding: 16, marginBottom: 16 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary, letterSpacing: 0.4, marginBottom: 8 }}>
              WHAT WE&apos;LL DO
            </Text>
            {lineItems.map((item) => (
              <View key={item.id} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={{ fontSize: 14, color: theme.colors.text }}>{item.description}</Text>
                  <Text style={{ fontSize: 11, color: theme.colors.textSecondary, textTransform: 'uppercase' }}>{item.category}</Text>
                </View>
                <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.text }}>
                  {formatPaise(item.estimated_paise)}
                </Text>
              </View>
            ))}
          </Card>
        )}

        {/* ── Pricing breakdown ──────────────────────────────────────── */}
        <Card style={{ padding: 16, marginBottom: 16, backgroundColor: theme.colors.surfaceMuted }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary, letterSpacing: 0.4, marginBottom: 12 }}>
            {cp.sectionHeading.toUpperCase()}
          </Text>
          <PricingRow
            label={cp.buddyFee.label}
            sub={cp.buddyFee.sub('your buddy')}
            value={formatPaise(agreement.traveler_subtotal_paise - agreement.itinerary_fund_paise - agreement.buffer_paise)}
          />
          <PricingRow
            label={cp.itineraryFund.label}
            sub={cp.itineraryFund.sub('your buddy')}
            value={formatPaise(agreement.itinerary_fund_paise)}
          />
          <PricingRow
            label={cp.buffer.label}
            sub={cp.buffer.sub}
            value={formatPaise(agreement.buffer_paise)}
          />
          {agreement.gst_rate > 0 && (
            <PricingRow label={cp.gst.label} value={formatPaise(agreement.traveler_gst_paise)} />
          )}
          <PricingRow
            label={cp.deposit.label}
            sub={cp.deposit.sub}
            value={formatPaise(DEPOSIT_PAISE)}
          />
          <View style={{ height: 1, backgroundColor: theme.colors.divider, marginVertical: 8 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: theme.colors.text }}>{cp.total}</Text>
            <Text style={{ fontSize: 17, fontWeight: '700', color: theme.colors.primary }}>
              {formatPaise(agreement.traveler_total_paise)}
            </Text>
          </View>
          {agreement.platform_fee_up_rate === 0 && agreement.gst_rate === 0 && (
            <Text style={{ fontSize: 12, color: theme.colors.success, fontWeight: '600', marginTop: 8 }}>
              Early access — Detour adds no platform fee or GST to this trip.
            </Text>
          )}
        </Card>

        {/* ── Signing status ───────────────────────────────────────────── */}
        <Card style={{ padding: 16, marginBottom: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary, letterSpacing: 0.4, marginBottom: 8 }}>
            SIGNATURES
          </Text>
          <SignatureRow
            who="Traveler"
            signedAtIso={agreement.traveler_signed_at}
          />
          <SignatureRow
            who="Buddy"
            signedAtIso={agreement.buddy_signed_at}
          />
        </Card>

        {/* ── Deposit status ───────────────────────────────────────────── */}
        {(booking.status === 'awaiting_deposits' || booking.status === 'deposits_held' || booking.status === 'awaiting_balance') && (
          <Card style={{ padding: 16, marginBottom: 16 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary, letterSpacing: 0.4, marginBottom: 8 }}>
              DEPOSITS (₹500 EACH SIDE)
            </Text>
            <DepositRow side="traveler" status={deposits.find((d) => d.side === 'traveler')?.status ?? 'pending'} />
            <DepositRow side="buddy"    status={deposits.find((d) => d.side === 'buddy')?.status    ?? 'pending'} />
            {confirmingDeposit && (
              <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginTop: 8 }}>
                {financialCopy.statusChips.depositConfirming}
              </Text>
            )}
          </Card>
        )}

        {/* ── Action buttons ───────────────────────────────────────────── */}
        <View style={{ gap: 8 }}>
          {canSign && (
            <Button
              title={financialCopy.buttons.sign}
              onPress={() => setSignModalOpen(true)}
              disabled={signing}
            />
          )}
          {canPayDeposit && (
            <Button
              title={financialCopy.buttons.payDeposit}
              onPress={handlePayDeposit}
              loading={depositLoading}
              disabled={depositLoading}
            />
          )}
        </View>
      </ScrollView>

      {/* ── Sign modal ───────────────────────────────────────────────── */}
      <Modal
        visible={signModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setSignModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}
        >
          <View style={{
            backgroundColor: theme.colors.background,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 20,
            paddingBottom: insets.bottom + 16,
          }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: theme.colors.text, marginBottom: 4 }}>
              {financialCopy.signModal.heading}
            </Text>
            <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginBottom: 12 }}>
              {financialCopy.signModal.fineprint}
            </Text>
            <TextInput
              value={signName}
              onChangeText={setSignName}
              placeholder={financialCopy.signModal.placeholder}
              autoFocus
              style={{
                borderWidth: 1.5, borderColor: theme.colors.divider,
                borderRadius: 10, padding: 12, fontSize: 16, marginBottom: 16,
              }}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button
                title={financialCopy.signModal.cancel}
                variant="ghost"
                onPress={() => { setSignModalOpen(false); setSignName(''); }}
                style={{ flex: 1 }}
              />
              <Button
                title={signing ? 'Signing…' : financialCopy.signModal.submit}
                onPress={handleSubmitSignature}
                loading={signing}
                disabled={signing || !signName.trim()}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function PricingRow({ label, sub, value }: { label: string; sub?: string; value: string }) {
  return (
    <View style={{ marginBottom: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: theme.colors.text }}>{label}</Text>
        <Text style={{ fontSize: 15, fontWeight: '600', color: theme.colors.text }}>{value}</Text>
      </View>
      {sub && (
        <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 }}>{sub}</Text>
      )}
    </View>
  );
}

function SignatureRow({ who, signedAtIso }: { who: string; signedAtIso: string | null }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
      <Text style={{ fontSize: 14, color: theme.colors.text }}>{who}</Text>
      <Text style={{
        fontSize: 13,
        color: signedAtIso ? theme.colors.success : theme.colors.textSecondary,
        fontWeight: signedAtIso ? '600' : '500',
      }}>
        {signedAtIso
          ? `✓ Signed ${new Date(signedAtIso).toLocaleString('en-IN', {
              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
            })}`
          : '◌ Pending'}
      </Text>
    </View>
  );
}

function DepositRow({ side, status }: { side: DepositSide; status: string }) {
  const isHeld = status === 'held';
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
      <Text style={{ fontSize: 14, color: theme.colors.text, textTransform: 'capitalize' }}>{side}</Text>
      <Text style={{
        fontSize: 13,
        color: isHeld ? theme.colors.success : theme.colors.textSecondary,
        fontWeight: isHeld ? '600' : '500',
      }}>
        {isHeld ? '✓ ₹500 secured' : '◌ Awaiting deposit'}
      </Text>
    </View>
  );
}
