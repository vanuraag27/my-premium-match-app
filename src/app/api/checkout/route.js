import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16', // Reliable API structural build version
});

export async function POST(request) {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    // Generate a secure, hosted checkout window
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'inr',
            product_data: {
              name: 'Bandhan AI Premium Membership Unlock',
              description: 'Get deep instant compatibility values breakdowns and direct connection access.',
            },
            unit_amount: 99900, // ₹999.00 fixed pricing configuration point
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${appUrl}?session_id={CHECKOUT_SESSION_ID}&premium=true`,
      cancel_url: `${appUrl}?premium=false`,
    });

    return NextResponse.json({ success: true, url: session.url });
  } catch (error) {
    console.error("Stripe Checkout error pipeline failure:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}