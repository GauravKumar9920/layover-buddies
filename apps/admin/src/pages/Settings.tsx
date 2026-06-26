import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import PageHeader from '@/components/PageHeader';

// ============================================================================
// PLATFORM SETTINGS — pricing controls (early-access switch + fee rates)
// ============================================================================
// Edits the single `platform_settings` row. While "Early access" is ON every
// platform charge is zero — travelers pay only the buddy fee + itinerary fund
// and buddies keep their full fee. The individual rates below are stored but
// inert until the switch is flipped.
//
// IMPORTANT: rates are snapshotted onto each agreement at draft time, so
// changes here only affect NEW agreements. Signed trips keep their economics.
// ============================================================================

interface SettingsRow {
  early_access_mode: boolean;
  platform_fee_up_rate: number;
  platform_fee_down_rate: number;
  commission_rate: number;
  gst_rate: number;
  tds_rate: number;
  late_fee_paise: number;
  updated_at: string;
}

// Worked example inputs — the canonical ₹2,000 buddy fee / ₹3,000 itinerary
// trip from the financial-model handoff §2.
const EX_BUDDY_FEE = 200_000;   // paise
const EX_ITINERARY = 300_000;
const EX_BUFFER = 60_000;       // 20% of itinerary
const DEPOSIT = 50_000;

function paiseToINR(paise: number): string {
  return '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

/** Decimal rate (0.125) ⇄ display percent string ("12.5"). */
function rateToPercent(rate: number): string {
  const pct = rate * 100;
  return Number.isInteger(pct) ? String(pct) : pct.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

export default function SettingsPage() {
  const [row, setRow] = useState<SettingsRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Form state (percent strings for rates, rupee string for late fee)
  const [earlyAccess, setEarlyAccess] = useState(true);
  const [upPct, setUpPct] = useState('12.5');
  const [downPct, setDownPct] = useState('12.5');
  const [commissionPct, setCommissionPct] = useState('25');
  const [gstPct, setGstPct] = useState('5');
  const [tdsPct, setTdsPct] = useState('1');
  const [lateFeeRupees, setLateFeeRupees] = useState('1000');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('*')
        .eq('id', 1)
        .single();
      if (cancelled) return;
      if (error) {
        setError(
          error.message.includes('does not exist') || error.code === '42P01'
            ? 'The platform_settings table is missing — apply migration 20260611100000_platform_settings.sql first.'
            : error.message,
        );
      } else if (data) {
        const r = data as SettingsRow;
        setRow(r);
        setEarlyAccess(r.early_access_mode);
        setUpPct(rateToPercent(Number(r.platform_fee_up_rate)));
        setDownPct(rateToPercent(Number(r.platform_fee_down_rate)));
        setCommissionPct(rateToPercent(Number(r.commission_rate)));
        setGstPct(rateToPercent(Number(r.gst_rate)));
        setTdsPct(rateToPercent(Number(r.tds_rate)));
        setLateFeeRupees(String(r.late_fee_paise / 100));
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  function parsePct(s: string): number | null {
    const n = Number(s);
    if (!Number.isFinite(n) || n < 0 || n > 100) return null;
    return n / 100;
  }

  const parsed = useMemo(() => {
    const up = parsePct(upPct);
    const down = parsePct(downPct);
    const commission = parsePct(commissionPct);
    const gst = parsePct(gstPct);
    const tds = parsePct(tdsPct);
    const lateFeeNum = Number(lateFeeRupees);
    const lateFee = Number.isFinite(lateFeeNum) && lateFeeNum >= 0 ? Math.round(lateFeeNum * 100) : null;
    const valid = up !== null && down !== null && commission !== null && gst !== null && tds !== null && lateFee !== null;
    return { up, down, commission, gst, tds, lateFee, valid };
  }, [upPct, downPct, commissionPct, gstPct, tdsPct, lateFeeRupees]);

  // Worked example with the EFFECTIVE rates the current form implies.
  // Mirrors computeAgreementSnapshot / computeReconciliationSnapshot exactly.
  const example = useMemo(() => {
    if (!parsed.valid) return null;
    const up   = earlyAccess ? 0 : (parsed.up as number);
    const down = earlyAccess ? 0 : (parsed.down as number);
    const gst  = earlyAccess ? 0 : (parsed.gst as number);
    const tds  = earlyAccess ? 0 : (parsed.tds as number);

    const buddyView = Math.round(EX_BUDDY_FEE * (1 + up));
    const subtotal = buddyView + EX_ITINERARY + EX_BUFFER;
    const gstPaise = Math.round(subtotal * gst);
    const travelerTotal = subtotal + gstPaise + DEPOSIT;

    const afterPlatform = Math.floor(EX_BUDDY_FEE * (1 - down));
    const tdsPaise = Math.round(afterPlatform * tds);
    // Assume the full pot is spent → no buffer clawback; deposit refunded.
    const buddyNet = afterPlatform - tdsPaise + DEPOSIT;

    const detourTake = (buddyView - EX_BUDDY_FEE) + (EX_BUDDY_FEE - afterPlatform);

    return { buddyView, subtotal, gstPaise, travelerTotal, afterPlatform, tdsPaise, buddyNet, detourTake };
  }, [earlyAccess, parsed]);

  async function handleSave() {
    if (!parsed.valid || saving) return;

    if (row?.early_access_mode && !earlyAccess) {
      const ok = window.confirm(
        'Turn OFF early access?\n\nNew agreements will start charging platform fees, GST, TDS and the late fee at the rates below. ' +
        'Existing signed agreements are unaffected.\n\nMake sure the marketing site copy ("completely free") is updated first.',
      );
      if (!ok) return;
    }

    setSaving(true);
    setError(null);
    const { error } = await supabase
      .from('platform_settings')
      .update({
        early_access_mode: earlyAccess,
        platform_fee_up_rate: parsed.up,
        platform_fee_down_rate: parsed.down,
        commission_rate: parsed.commission,
        gst_rate: parsed.gst,
        tds_rate: parsed.tds,
        late_fee_paise: parsed.lateFee,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);
    setSaving(false);
    if (error) {
      setError(error.message);
    } else {
      setRow((r) => r ? {
        ...r,
        early_access_mode: earlyAccess,
        platform_fee_up_rate: parsed.up as number,
        platform_fee_down_rate: parsed.down as number,
        commission_rate: parsed.commission as number,
        gst_rate: parsed.gst as number,
        tds_rate: parsed.tds as number,
        late_fee_paise: parsed.lateFee as number,
      } : r);
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 3000);
    }
  }

  const dirty = row && parsed.valid && (
    earlyAccess !== row.early_access_mode ||
    parsed.up !== Number(row.platform_fee_up_rate) ||
    parsed.down !== Number(row.platform_fee_down_rate) ||
    parsed.commission !== Number(row.commission_rate) ||
    parsed.gst !== Number(row.gst_rate) ||
    parsed.tds !== Number(row.tds_rate) ||
    parsed.lateFee !== row.late_fee_paise
  );

  return (
    <div className="pb-10">
      <PageHeader
        title="Pricing settings"
        subtitle="Early-access switch and the platform's fee rates"
        actions={
          <button
            onClick={handleSave}
            disabled={!dirty || !parsed.valid || saving}
            className={[
              'px-5 h-10 rounded-lg text-sm font-semibold transition',
              dirty && parsed.valid
                ? 'bg-primary text-white hover:bg-primary-dark'
                : 'bg-divider text-muted cursor-not-allowed',
            ].join(' ')}
          >
            {saving ? 'Saving…' : savedAt ? 'Saved ✓' : 'Save changes'}
          </button>
        }
      />

      {error && (
        <div className="mx-8 mb-4 p-3 rounded-lg bg-danger/10 text-danger text-sm border border-danger/30">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mx-8 p-10 text-center text-muted">Loading…</div>
      ) : !row && !error ? (
        <div className="mx-8 p-10 text-center text-muted">No settings row found.</div>
      ) : row && (
        <div className="px-8 grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* ── Left: controls ─────────────────────────────────────────── */}
          <div className="lg:col-span-3 space-y-6">
            {/* Early access master switch */}
            <div className={[
              'rounded-2xl border p-6 shadow-card transition',
              earlyAccess ? 'bg-success/5 border-success/40' : 'bg-white border-divider',
            ].join(' ')}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-heading text-lg font-bold">Early access — Detour is free</h2>
                    <span className={[
                      'px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide',
                      earlyAccess ? 'bg-success/15 text-success' : 'bg-divider text-muted',
                    ].join(' ')}>
                      {earlyAccess ? 'On' : 'Off'}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted leading-relaxed max-w-md">
                    While this is on, travelers pay <strong className="text-ink">only the buddy fee and the
                    itinerary fund</strong> (plus the refundable ₹500 deposit), and buddies keep their full
                    fee. Every rate below is stored but charged at <strong className="text-ink">zero</strong>.
                  </p>
                </div>
                {/* Toggle */}
                <button
                  role="switch"
                  aria-checked={earlyAccess}
                  onClick={() => setEarlyAccess((v) => !v)}
                  className={[
                    'relative shrink-0 w-14 h-8 rounded-full transition-colors duration-200',
                    earlyAccess ? 'bg-success' : 'bg-divider',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-all duration-200',
                      earlyAccess ? 'left-7' : 'left-1',
                    ].join(' ')}
                  />
                </button>
              </div>
              {!earlyAccess && (
                <div className="mt-4 p-3 rounded-lg bg-warn/10 border border-warn/30 text-xs text-ink">
                  ⚠️ Monetisation is <strong>live</strong> — new agreements charge the rates below.
                  Update the marketing site's "completely free" copy if you haven't.
                </div>
              )}
            </div>

            {/* Rates */}
            <div className={[
              'bg-white rounded-2xl border border-divider shadow-card p-6 transition-opacity',
              earlyAccess ? 'opacity-60' : '',
            ].join(' ')}>
              <div className="flex items-baseline justify-between">
                <h2 className="font-heading text-lg font-bold">Fee rates</h2>
                {earlyAccess && (
                  <span className="text-[11px] text-muted">stored for later — not charged while early access is on</span>
                )}
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <RateField
                  label="Platform fee — traveler side"
                  hint="Added on top of the buddy fee the traveler sees"
                  value={upPct} onChange={setUpPct} suffix="%"
                />
                <RateField
                  label="Platform fee — buddy side"
                  hint="Deducted from the buddy fee at payout"
                  value={downPct} onChange={setDownPct} suffix="%"
                />
                <RateField
                  label="Commission (estimate card)"
                  hint="Used only in the pre-chat booking estimate"
                  value={commissionPct} onChange={setCommissionPct} suffix="%"
                />
                <RateField
                  label="GST"
                  hint="On the traveler subtotal"
                  value={gstPct} onChange={setGstPct} suffix="%"
                />
                <RateField
                  label="TDS (Section 194C)"
                  hint="Withheld from buddy payout — confirm with your CA"
                  value={tdsPct} onChange={setTdsPct} suffix="%"
                />
                <RateField
                  label="Late fee"
                  hint="Flat fee when balance is unpaid at T-72h"
                  value={lateFeeRupees} onChange={setLateFeeRupees} suffix="₹" prefix
                />
              </div>
              {!parsed.valid && (
                <div className="mt-3 text-xs text-danger">
                  Rates must be between 0 and 100%; the late fee must be a non-negative amount.
                </div>
              )}
            </div>

            <div className="p-4 rounded-xl bg-white border border-divider text-xs text-muted leading-relaxed">
              <strong className="text-ink">How changes apply.</strong> Rates are snapshotted onto each
              agreement when the buddy drafts it — changing them here affects{' '}
              <strong className="text-ink">new agreements only</strong>. Trips that are already drafted,
              signed or paid keep the rates they were agreed under. The app caches rates for up to
              5 minutes.
            </div>
          </div>

          {/* ── Right: live worked example ─────────────────────────────── */}
          <div className="lg:col-span-2">
            <div className="bg-navy rounded-2xl shadow-card p-6 text-white sticky top-6">
              <div className="text-[11px] uppercase tracking-wider text-white/60">Live preview</div>
              <h3 className="mt-1 font-heading text-lg font-bold">
                Sample trip — ₹2,000 buddy fee, ₹3,000 day fund
              </h3>

              {example && (
                <>
                  <div className="mt-5 space-y-2 text-sm">
                    <ExampleRow label="Buddy fee (traveler view)" value={paiseToINR(example.buddyView)} />
                    <ExampleRow label="Itinerary fund + 20% buffer" value={paiseToINR(EX_ITINERARY + EX_BUFFER)} />
                    {example.gstPaise > 0 && <ExampleRow label="GST" value={paiseToINR(example.gstPaise)} />}
                    <ExampleRow label="Refundable deposit" value={paiseToINR(DEPOSIT)} />
                    <div className="border-t border-white/15 pt-2">
                      <ExampleRow label="Traveler pays" value={paiseToINR(example.travelerTotal)} bold />
                    </div>
                  </div>

                  <div className="mt-5 space-y-2 text-sm">
                    <div className="text-[11px] uppercase tracking-wider text-white/60">Buddy payout (full pot spent)</div>
                    <ExampleRow label="Fee after platform cut" value={paiseToINR(example.afterPlatform)} />
                    {example.tdsPaise > 0 && <ExampleRow label="TDS withheld" value={'−' + paiseToINR(example.tdsPaise)} />}
                    <ExampleRow label="Deposit refunded" value={'+' + paiseToINR(DEPOSIT)} />
                    <div className="border-t border-white/15 pt-2">
                      <ExampleRow label="Buddy receives" value={paiseToINR(example.buddyNet)} bold />
                    </div>
                  </div>

                  <div className={[
                    'mt-5 rounded-xl p-4',
                    example.detourTake === 0 ? 'bg-success/20' : 'bg-primary/20',
                  ].join(' ')}>
                    <div className="text-[11px] uppercase tracking-wider text-white/70">Detour earns</div>
                    <div className="num text-2xl font-extrabold mt-0.5">
                      {paiseToINR(example.detourTake)}
                    </div>
                    <div className="text-xs text-white/70 mt-1">
                      {example.detourTake === 0
                        ? 'Free for everyone — that’s the early-access promise.'
                        : 'Traveler-side + buddy-side platform fees (GST & TDS go to the government).'}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RateField({
  label, hint, value, onChange, suffix, prefix,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  suffix: string;
  prefix?: boolean;
}) {
  return (
    <label className="block">
      <div className="text-sm font-semibold text-ink">{label}</div>
      <div className="text-[11px] text-muted mt-0.5">{hint}</div>
      <div className="mt-2 flex items-center gap-2">
        {prefix && <span className="text-sm text-muted">{suffix}</span>}
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-28 h-10 px-3 rounded-lg border border-divider bg-white text-sm num focus:outline-none focus:border-primary"
        />
        {!prefix && <span className="text-sm text-muted">{suffix}</span>}
      </div>
    </label>
  );
}

function ExampleRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={bold ? 'font-semibold' : 'text-white/80'}>{label}</span>
      <span className={['num', bold ? 'text-lg font-extrabold' : 'text-white/90'].join(' ')}>{value}</span>
    </div>
  );
}
