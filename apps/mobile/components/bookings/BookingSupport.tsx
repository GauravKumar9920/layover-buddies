import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { supabase } from '@/lib/supabase';
import { formatPaise } from '@/lib/booking/money';
import { theme } from '@/config/theme';
import { POST_COMPLETION_DISPUTE_DAYS } from '@/config/constants';
const reportErrors: Record<string, string> = {
  no_show_grace_period: 'No-show reports open two hours after the agreed start.',
  dispute_window_closed: 'The reporting window for this trip has closed. Please contact support.',
  dispute_not_available: 'This trip is not currently eligible for a dispute.',
  payment_in_progress: 'A payment is being processed. Please retry shortly or contact support.',
};
interface SupportCase { id: string; kind: string; status: string; reason: string; resolution?: { reason?: string; traveler_refund_paise?: number; buddy_net_paise?: number } }
export function BookingSupport({ bookingId, status }: { bookingId: string; status: string }) {
  const [cases, setCases] = useState<SupportCase[]>([]);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => { let active = true; void supabase.functions.invoke('booking-support', { body: { action: 'list', booking_id: bookingId } }).then(({ data, error }) => { if (active) { if (error) setMessage('Support history is unavailable. Please retry.'); else setCases(data?.cases ?? []); } }); return () => { active = false; }; }, [bookingId]);
  const kind = status === 'trip_ready' ? 'no_show' : 'dispute';
  const canReport = ['trip_ready','in_progress','awaiting_proofs','reconciling','completed','rated'].includes(status) && !cases.some(c => c.status === 'open');
  async function submit() {
    if (busy || reason.trim().length < 4) return;
    setBusy(true); setMessage('');
    try {
      const { data, error } = await supabase.functions.invoke('booking-support', { body: { booking_id: bookingId, kind, reason: reason.trim() } });
      if (error) { const detail = await error.context?.json?.().catch(() => null); throw new Error(reportErrors[detail?.error] ?? 'The report could not be submitted. Please retry or contact support.'); }
      setCases(previous => [data.case, ...previous.filter(c => c.id !== data.case.id)]); setReason(''); setMessage('Report received. Operations will review it before deciding the outcome.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Support is unavailable.'); } finally { setBusy(false); }
  }
  return <View style={{ marginVertical: 16, padding: 16, borderWidth: 1, borderColor: theme.colors.divider, borderRadius: 12 }}>
    <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 16 }}>Trip support</Text>
    {cases.map(c => <View key={c.id} style={{ marginTop: 10 }}><Text style={{ color: theme.colors.text }}>{c.kind === 'no_show' ? 'No-show report' : 'Dispute'} · {c.status}</Text><Text style={{ color: theme.colors.text }}>{c.resolution?.reason ?? c.reason}</Text>{typeof c.resolution?.traveler_refund_paise === 'number' && <Text style={{ color: theme.colors.text }}>Reviewed settlement: traveler refund {formatPaise(c.resolution.traveler_refund_paise)} · buddy payment {formatPaise(c.resolution.buddy_net_paise ?? 0)}. Payment processing is separate.</Text>}</View>)}
    {canReport && <><Text style={{ color: theme.colors.text, marginVertical: 10 }}>{kind === 'no_show' ? 'If the other person has not arrived two hours after the agreed start, report it for review.' : `Tell us what went wrong. Reports are accepted during the trip and for ${POST_COMPLETION_DISPUTE_DAYS} days after completion.`}</Text><TextInput accessibilityLabel="Reason for support report" placeholder="What happened?" placeholderTextColor={theme.colors.textSecondary} multiline maxLength={2000} value={reason} onChangeText={setReason} style={{ color: theme.colors.text, padding: 12, borderWidth: 1, borderColor: theme.colors.divider, borderRadius: 8, minHeight: 80 }} /><TouchableOpacity accessibilityRole="button" disabled={busy || reason.trim().length < 4} onPress={() => void submit()} style={{ paddingVertical: 14, opacity: busy || reason.trim().length < 4 ? 0.5 : 1 }}><Text style={{ color: theme.colors.primary, fontWeight: '700' }}>{busy ? 'Submitting…' : kind === 'no_show' ? 'Report a no-show' : 'Raise a dispute'}</Text></TouchableOpacity></>}
    {!!message && <Text accessibilityRole="alert" style={{ color: theme.colors.text, marginTop: 8 }}>{message}</Text>}
  </View>;
}
