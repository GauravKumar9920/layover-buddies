// Supabase Edge Function — DEPRECATED legacy single-shot booking payment.
//
// SECURITY: The previous version accepted unauthenticated requests with a
// client-supplied `amount_inr`, which let anyone mint Razorpay orders for
// arbitrary booking IDs at arbitrary amounts on the project's account.
// That was a real money-loss vector and is closed here.
//
// REPLACEMENT: Phase 2+ uses the agreement → deposit → balance lifecycle:
//   - supabase/functions/create-deposit-order   (per-side ₹500 deposit)
//   - supabase/functions/create-balance-order   (traveler balance)
//   - supabase/functions/create-topup-order     (in-trip top-up)
// Mobile clients should never call this endpoint again. It is kept as a
// stub that returns 410 Gone so any stragglers (older builds, scripts)
// crash loudly rather than silently bypassing the new flow.
//
// If you genuinely need a single-shot payment for a legacy flow, build a
// new function with: getUserFromRequest() auth, party-check against the
// booking row, and server-side amount lookup (do NOT trust the client).
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve((req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return new Response(
    JSON.stringify({
      error: 'gone',
      message:
        'create-booking-payment is deprecated. Use create-deposit-order, ' +
        'create-balance-order, or create-topup-order. Upgrade the mobile client.',
    }),
    { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
