// CORS headers shared by every Phase 2 Edge Function.
// Mobile + web clients hit these endpoints from arbitrary origins (Expo dev
// server, expo-go tunnel, deployed Vercel preview, native shells), so we keep
// the policy permissive — auth is enforced via the Authorization JWT, not Origin.

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-razorpay-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const jsonHeaders = {
  ...corsHeaders,
  'Content-Type': 'application/json',
};

/** Build a JSON Response with CORS + structured body. */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

/** Standard error envelope. Logs nothing sensitive; safe to surface to clients. */
export function errorResponse(error: string, status = 400, extra?: Record<string, unknown>): Response {
  return jsonResponse({ error, ...extra }, status);
}
