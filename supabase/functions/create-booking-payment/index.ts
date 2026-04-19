// Supabase Edge Function — creates a Razorpay order for a booking.
// The Razorpay secret key NEVER leaves this function.
// Deploy secret: supabase secrets set RAZORPAY_KEY_SECRET=<secret>
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const RAZORPAY_API = 'https://api.razorpay.com/v1/orders';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const keyId = Deno.env.get('RAZORPAY_KEY_ID');
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');

    if (!keyId || !keySecret) {
      return new Response(
        JSON.stringify({ error: 'Razorpay credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { booking_id, amount_inr } = await req.json() as {
      booking_id: string;
      amount_inr: number;
    };

    if (!booking_id || !amount_inr || amount_inr <= 0) {
      return new Response(
        JSON.stringify({ error: 'booking_id and amount_inr are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Razorpay amounts are in paise (smallest unit of INR: 1 INR = 100 paise)
    const amountPaise = Math.round(amount_inr * 100);
    const credentials = btoa(`${keyId}:${keySecret}`);

    const razorpayRes = await fetch(RAZORPAY_API, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: 'INR',
        receipt: `booking_${booking_id.slice(0, 20)}`,
        notes: { booking_id },
      }),
    });

    if (!razorpayRes.ok) {
      const err = await razorpayRes.text();
      return new Response(
        JSON.stringify({ error: `Razorpay error: ${err}` }),
        { status: razorpayRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const order = await razorpayRes.json() as {
      id: string;
      amount: number;
      currency: string;
      status: string;
    };

    return new Response(
      JSON.stringify({
        order_id: order.id,
        amount_paise: order.amount,
        currency: order.currency,
        key_id: keyId,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
