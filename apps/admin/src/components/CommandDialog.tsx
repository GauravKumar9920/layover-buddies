import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import { errorMessage } from '@/lib/api';

interface Props {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  tone?: 'primary' | 'danger';
  children?: ReactNode;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}

export default function CommandDialog({ open, title, description, confirmLabel, tone = 'primary', children, onClose, onConfirm }: Props) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (open) { setReason(''); setError(null); } }, [open]);
  if (!open) return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(null);
    try { await onConfirm(reason.trim()); onClose(); }
    catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(false); }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target && !busy) onClose(); }}>
      <form className="dialog-panel" role="dialog" aria-modal="true" aria-labelledby="command-title" onSubmit={submit}>
        <div className="flex items-start justify-between gap-4">
          <div><p className="eyebrow">Audited command</p><h2 id="command-title" className="mt-1 font-heading text-xl font-bold text-navy">{title}</h2></div>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose} disabled={busy}><Icon name="close" className="h-5 w-5" /></button>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted">{description}</p>
        {children}
        <label className="field-label mt-5 block">Reason for the audit log
          <textarea className="field-input mt-2 min-h-24 resize-y py-3" required minLength={4} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="What did you verify, and why is this action needed?" />
        </label>
        {error && <p className="form-error mt-3" role="alert">{error}</p>}
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" className="secondary-button" disabled={busy} onClick={onClose}>Cancel</button>
          <button type="submit" className={tone === 'danger' ? 'danger-button' : 'primary-button'} disabled={busy || reason.trim().length < 4}>{busy ? 'Working…' : confirmLabel}</button>
        </div>
      </form>
    </div>
  );
}
