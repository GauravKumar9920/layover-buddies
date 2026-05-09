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
    // Phase 3+4 buttons:
    payBalance:            'Pay trip balance',
    payBalanceWithLateFee: (lateFeePaise: number) =>
      `Pay balance + ${formatPaise(lateFeePaise)} late fee`,
    confirmCancel:         'Yes, cancel my trip',
    keepTrip:              'Keep my booking',
    endTrip:               'End trip',
    submitProofs:          'Submit expense proofs',
    addProof:              '+ Add expense',
    removeProof:           'Remove',
    requestTopUp:          'Request extra funds',
    approveTopUp:          'Approve',
    declineTopUp:          'Decline',
    cancelTopUp:           'Cancel request',
    showQr:                'Show my QR code',
    scanQr:                'Scan traveler QR',
    rateTrip:              'Rate this trip',
    viewReceipt:           'View receipt',
    viewCancellation:      'View cancellation',
  },

  // ── Phase 3: Late fee + balance payment ──────────────────────────────────
  lateFeeBanner: {
    heading: 'Late fee applied',
    body: (lateFeePaise: number) =>
      `Because you haven't paid the balance yet and your trip is in less than 72 hours, a ${formatPaise(lateFeePaise)} late fee has been added. If payment isn't received by 12 hours before the trip, your booking will be automatically cancelled and your deposit will be forfeited.`,
    cta: (totalPaise: number) => `Pay ${formatPaise(totalPaise)} now`,
  },

  balancePricing: {
    sectionHeading: 'Trip balance',
    lineItems: {
      tripFund: {
        label: "Trip fund",
        sub: 'Day\'s expenses + buffer. Unused buffer is refunded after the trip.',
      },
      gst: {
        label: 'GST (5%)',
      },
      lateFee: {
        label: 'Late fee',
        sub: 'Applied because payment is within 72 hours of trip start.',
      },
    },
    total: (paise: number) => `Total: ${formatPaise(paise)}`,
    depositNote: '₹500 deposit already paid — not charged again.',
    refundNote: (bufferPaise: number) =>
      `Up to ${formatPaise(bufferPaise)} buffer refunded after trip if unused.`,
  },

  // ── Phase 4: Trip QR instructions ────────────────────────────────────────
  tripQrInstructions: {
    travelerHeading: 'Your trip QR',
    travelerSub:
      'Show this to your buddy when you meet. They\'ll scan it to start the trip.',
    buddyHeading: 'Scan to start the trip',
    buddySub:
      'Point your camera at the traveler\'s QR code. This releases the trip fund to you.',
    scanSuccess: 'Trip started!',
    scanError:   'QR didn\'t match — ask the traveler to refresh their screen.',
    vpaMissing: {
      heading: 'Add your UPI VPA first',
      body: 'We need your UPI ID (e.g. name@upi) to release the trip fund to you. Add it in your profile and then scan the QR.',
      cta: 'Add UPI ID',
    },
  },

  // ── Phase 4: Top-up request (buddy view) ─────────────────────────────────
  topUpRequest: {
    buddy: {
      heading: 'Request extra funds',
      sub: 'The traveler will see this on their screen and approve or decline. Funds are only charged on approval.',
      amountLabel: 'Amount needed',
      categoryLabel: 'Category',
      purposeLabel: 'What\'s it for?',
      purposePlaceholder: 'e.g. extra entry tickets for Gateway of India',
      submit: 'Send request',
      pendingNote: 'Waiting for traveler to respond…',
      expiredNote: 'Request expired. Send a new one if you still need it.',
      declinedNote: 'Traveler declined. Ask verbally if urgent.',
    },
    traveler: {
      heading: (buddyName: string) => `${buddyName} needs more funds`,
      approveNote: 'Only approve if you\'ve agreed to this verbally.',
      expiresIn:   (minutesLeft: number) => `Expires in ${minutesLeft} min`,
      approvedNote: 'Approved. Razorpay checkout will open.',
    },
  },

  // ── Phase 4: Trip end + proofs ────────────────────────────────────────────
  tripEndProofs: {
    heading: 'Upload expense proofs',
    sub: 'Add one entry per expense — a payment screenshot is required for each.',
    emptyState: {
      heading: 'No expenses yet',
      sub: 'Tap "+ Add expense" for each spend during the day.',
    },
    fields: {
      category:    'Category',
      description: 'Description',
      amount:      'Amount (₹)',
      paymentProof:'Payment screenshot (required)',
      bill:        'Bill / receipt photo (optional)',
    },
    submitHeading: 'Ready to submit?',
    submitSub: (total: number) =>
      `${total} expense${total === 1 ? '' : 's'} added. Once submitted, the reconciliation runs automatically.`,
    submitCta: 'Submit and reconcile',
    deleteConfirm: 'Remove this expense?',
  },

  // ── Phase 4: Reconciliation receipt (traveler) ───────────────────────────
  reconciliationReceipt: {
    traveler: {
      heading: 'Day complete',
      refundHeading: 'Your refund',
      refundBreakdown: {
        unusedBuffer: (paise: number) => `Unused buffer: +${formatPaise(paise)}`,
        deposit:      (paise: number) => `Deposit returned: +${formatPaise(paise)}`,
        total:        (paise: number) => `Total refund: ${formatPaise(paise)}`,
      },
      processingNote: 'Refund takes 5–7 business days to appear in your account.',
      ratingCta: 'Rate your buddy',
    },
    buddy: {
      heading: 'Trip payout',
      payoutHeading: 'Your take-home',
      payoutBreakdown: {
        buddyFee:       (paise: number) => `Buddy fee: ${formatPaise(paise)}`,
        platformDown:   (paise: number) => `Platform fee (12.5%): −${formatPaise(paise)}`,
        tds:            (paise: number) => `TDS (1%): −${formatPaise(paise)}`,
        deposit:        (paise: number) => `Deposit returned: +${formatPaise(paise)}`,
        unusedBuffer:   (paise: number) => `Unused buffer clawback: −${formatPaise(paise)}`,
        total:          (paise: number) => `Net payout: ${formatPaise(paise)}`,
      },
      processingNote: 'Payout dispatched to your UPI ID.',
      stubNote: 'Payout will be issued when our payment infrastructure is live. Sit tight!',
    },
  },

  // ── Phase 3: Cancellation copy (per tier) ─────────────────────────────────
  cancellationConfirm: {
    gt_72h: {
      heading: 'Cancel your trip?',
      body: 'You\'re cancelling more than 72 hours before the trip. Both deposits will be fully refunded.',
      refundSummary: (depositPaise: number) => `You\'ll get back: ${formatPaise(depositPaise)} deposit`,
    },
    '24_to_72h': {
      heading: 'Cancel your trip?',
      body: 'You\'re cancelling 24–72 hours before the trip. You\'ll get a 50% refund on your deposit and the trip fund.',
      refundSummary: (halfDepositPaise: number) => `You\'ll get back: ${formatPaise(halfDepositPaise)} (50% of deposit)`,
    },
    lt_24h: {
      heading: 'Late cancellation',
      body: 'You\'re cancelling less than 24 hours before the trip. Your deposit and any trip fund paid will be issued as a 30-day platform voucher — not a cash refund.',
      refundSummary: 'You\'ll receive: a platform voucher for your deposit',
    },
    late_no_pay: {
      // System-initiated; shown on the cancelled status screen, not a confirm modal.
      heading: 'Booking cancelled',
      body: 'Your trip was cancelled automatically because the balance wasn\'t paid before the 12-hour deadline. Your deposit has been forfeited.',
    },
    buddy_cancel: {
      // Traveler-facing — buddy cancelled.
      heading: 'Your buddy cancelled',
      body: 'We\'re sorry your buddy cancelled. You\'ve received a full refund plus a ₹500 platform credit for the inconvenience.',
    },
    force_majeure: {
      heading: 'Trip cancelled — force majeure',
      body: 'A verified force-majeure event has been declared. Both sides have been fully refunded with no penalties.',
    },
  },

  cancellationReceipt: {
    heading: 'Cancellation summary',
    tierLabel: {
      gt_72h:               'Cancelled >72h before trip',
      '24_to_72h':          'Cancelled 24–72h before trip',
      lt_24h:               'Cancelled <24h before trip',
      late_no_pay:          'Auto-cancelled (balance not paid)',
      buddy_cancel:         'Buddy cancelled',
      force_majeure:        'Force majeure',
      pre_signing:          'Booking expired before deposits',
    },
    fateLabels: {
      refunded:  'Refunded',
      forfeited: 'Forfeited',
      voucher:   'Platform voucher (30 days)',
      waived:    'Waived',
      not_paid:  'Not charged',
    },
    pgFeeNote: 'Payment gateway fee (2%) borne by Mumbai Buddies.',
    processingNote: 'Cash refunds take 5–7 business days.',
  },

  // ── Phase 4: Dispute banner ────────────────────────────────────────────────
  disputeBanner: {
    heading: 'Under review',
    body: 'Our support team is reviewing this booking. We\'ll reach out within 24 hours.',
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
