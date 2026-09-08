import { useState } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { adminRequest, idempotencyKey } from '@/lib/api';
import { useAdminQuery } from '@/lib/useAdminQuery';
import type { SupportCase } from '@/types/admin';
import CommandDialog from './CommandDialog';
export default function SupportCases(props: { bookingId: string; status: string }) {
  const { admin } = useAuth();
  if (admin?.role !== 'owner' && admin?.role !== 'operations') return null;
  return <CasePanel {...props} />;
}
function CasePanel({ bookingId, status }: { bookingId: string; status: string }) {
  const cases = useAdminQuery<SupportCase[]>(() => adminRequest('lifecycle.list', { id: bookingId }), [bookingId]);
  const [open, setOpen] = useState(false);
  const [resolution, setResolution] = useState('dismiss');
  const [percent, setPercent] = useState(50);
  const [key, setKey] = useState('');
  const active = cases.data?.find(c => c.status === 'open');
  return <section className="card p-5"><h2 className="font-bold">Trip support</h2>
    {cases.error && <p role="alert" className="text-danger">{cases.error}</p>}
    {cases.data?.map(c => <article key={c.id} className="mt-3 text-sm"><strong>{c.kind === 'no_show' ? `${c.reported_party} no-show report` : 'Dispute'} · {c.status}</strong><p className="mt-1">{c.reason}</p>{c.resolution && <p className="mt-1 text-muted">{String(c.resolution.reason ?? c.resolution.resolution ?? 'Reviewed')}</p>}</article>)}
    {!cases.loading && !cases.error && !cases.data?.length && <p className="mt-2 text-sm text-muted">No support reports.</p>}
    {status === 'disputed' && <button className="primary-button mt-3" onClick={() => { setKey(idempotencyKey('support', bookingId)); setOpen(true); }}>Review outcome</button>}
    <CommandDialog open={open} title="Resolve trip support" description="Verify the report and supporting evidence. Refund/split applies only to the remaining unpaid settlement after the original deductions. It cannot reverse funds already sent." confirmLabel="Save outcome" onClose={() => setOpen(false)} onConfirm={async reason => { await adminRequest('lifecycle.resolve', { id: bookingId, resolution, refundPercent: percent, reason, idempotencyKey: key }); await cases.refresh(); window.location.reload(); }}>
      <label className="field-label mt-4 block">Outcome<select className="field-input mt-2" value={resolution} onChange={e => setResolution(e.target.value)}><option value="dismiss">Dismiss report and restore previous state</option>{active?.kind === 'no_show' && <option value="confirm_no_show">Confirm no-show and apply cancellation rules</option>}<option value="resume_reconciliation">Resume previous trip workflow</option><option value="cancel_force_majeure">Cancel before trip starts, no party at fault</option><option value="release">Release existing settlement</option><option value="refund">Refund remaining settlement</option><option value="split">Split remaining settlement</option></select></label>
      {resolution === 'split' && <label className="field-label mt-3 block">Traveler share (%)<input className="field-input" type="number" min="0" max="100" step="1" value={percent} onChange={e => setPercent(Number(e.target.value))} /></label>}
    </CommandDialog>
  </section>;
}
