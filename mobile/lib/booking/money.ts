// ============================================================================
// MONEY HELPERS — integer paise utilities
// ============================================================================
// All financial math in Phase 1+ uses paise (integer) internally.
// `formatPaise` is the single display path for all monetary amounts.
// ============================================================================

/**
 * Convert integer paise to decimal rupees.
 * e.g. 664_250 → 6642.50
 */
export const paiseToRupees = (paise: number): number => paise / 100;

/**
 * Convert decimal rupees to integer paise (rounded).
 * e.g. 6642.50 → 664_250
 */
export const rupeesToPaise = (rupees: number): number => Math.round(rupees * 100);

/**
 * Format integer paise as an INR currency string.
 * e.g. 664_250 → '₹6,642.50'
 */
export const formatPaise = (paise: number): string =>
  `₹${(paise / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
