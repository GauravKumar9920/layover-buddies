// ============================================================================
// FINANCIAL COPY — Phase 2 strings (single source of truth)
// ============================================================================
// Every UI surface that renders pricing, signing, deposit, or trip-end copy
// MUST import from here. Per the financial-model handoff §10/§11 ("canonical
// strings"). Keeping copy in code (not Lokalise) for v1 — i18n can wrap this
// module later.
//
// Phase 2 only ships the strings used by the agreement viewer, sign modal,
// and deposit CTA. Phase 3 adds late-fee + balance copy; Phase 4 adds trip
// lifecycle copy. The structure is in place so later phases just add keys.
// ============================================================================

import { formatPaise } from '../booking/money';

export const financialCopy = {
  // ── Pricing breakdown (traveler view) — handoff §10 ──────────────────────
  travelerPricing: {
    sectionHeading: 'What this includes',
    buddyFee: {
      label: 'Buddy fee',
      sub: (firstName: string) => `Your thank-you to ${firstName} for the day.`,
    },
    itineraryFund: {
      label: "Day's expenses",
      sub: (firstName: string) =>
        `Food, transport, entries — for both of you. ${firstName} handles the cash on the ground.`,
    },
    buffer: {
      label: 'Buffer (20% cushion)',
      sub: "Refunded if unused. We'll never surprise you with extra charges.",
    },
    gst: {
      label: 'GST (Tour Operator, 5%)',
    },
    deposit: {
      label: 'Refundable deposit',
      sub: 'Returned after the trip.',
    },
    total: 'Total',
    payToday: (depositPaise: number) => `Today: ${formatPaise(depositPaise)} (deposit only)`,
    payByDeadline: (whenHuman: string, balancePaise: number) =>
      `By ${whenHuman}: ${formatPaise(balancePaise)}`,
  },

  // ── Buddy "your take-home estimate" card — handoff §11 ───────────────────
  buddyTakeHome: {
    heading: 'Your take-home (estimate)',
    breakdownNote: 'Net of platform fee, TDS, and any unused buffer at trip end.',
    line: (label: string, paise: number, prefix: '+' | '-' | '=' = '-') =>
      `${prefix} ${label}: ${formatPaise(paise)}`,
    plusDeposit: 'Plus: ₹500 deposit returned after the trip.',
  },

  // ── Day's expenses explainer (info bubble) — handoff §10 ─────────────────
  dayExpensesExplainer: {
    heading: 'Why "for both of you"?',
    body: (firstName: string) =>
      `Mumbai Buddies isn't a tour. ${firstName} is your local for the day — you'll share lunch, autos, entry tickets, the works. The day's expenses cover all of that for the two of you, the way you'd cover a friend showing you their city. Whatever isn't spent comes back to you.`,
  },

  bufferExplainer: {
    heading: 'About the buffer',
    body: (bufferPaise: number) =>
      `The buffer is a 20% cushion on top of the day's expenses. If the day runs short, you get the full ${formatPaise(bufferPaise)} back. If it runs long, your buddy taps you in-app to top up — always with your approval, never a surprise.`,
  },

  depositExplainer: {
    heading: 'About the deposit',
    body: '₹500 from each of you, held by Mumbai Buddies until the trip wraps. Both refunded after a successful day. The deposit exists so neither side flakes.',
  },

  // ── Sign modal ───────────────────────────────────────────────────────────
  signModal: {
    heading: 'Type your full name to sign',
    placeholder: 'Your full legal name',
    submit: 'Sign',
    cancel: 'Cancel',
    fineprint:
      'By signing, you agree to the cancellation, conduct, and safety terms above. This is a binding agreement under IT Act 2000.',
  },

  // ── Status / info chips ─────────────────────────────────────────────────
  statusChips: {
    travelerSigned:    (atIso: string) => `You signed · ${formatTimeShort(atIso)}`,
    buddySigned:       (atIso: string) => `Guide signed · ${formatTimeShort(atIso)}`,
    travelerPending:   'Awaiting your signature',
    buddyPending:      'Awaiting guide signature',
    depositHeld:       'Deposit secured',
    depositPending:    'Deposit not yet posted',
    depositConfirming: 'Confirming with payment processor…',
  },

  // ── Buttons ──────────────────────────────────────────────────────────────
  buttons: {
    sign:                  'Sign agreement',
    payDeposit:            'Pay ₹500 deposit',
    saveDraft:             'Save draft',
    sendToTraveler:        'Send to traveler',
    addLineItem:           '+ Add line item',
    removeLineItem:        'Remove',
    viewAgreement:         'View agreement',
    draftAgreement:        'Draft agreement',
    continueDrafting:      'Continue drafting',
  },
};

function formatTimeShort(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-IN', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
