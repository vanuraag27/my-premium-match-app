import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

// Capture incoming events dispatched directly by Stripe's transaction gateway
export async function POST(request) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    );
  } catch (err) {
    console.error(`❌ Webhook Signature Verification Failed:`, err.message);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  // Handle automatic account cleanup logic depending on event types
  switch (event.type) {
    case 'customer.subscription.deleted':
    case 'invoice.payment_failed': {
      const session = event.data.object;
      const customerEmail = session.customer_email;
      
      console.log(`⚠️ Subscription ended or payment failed for user: ${customerEmail}`);
      
      // PRODUCTION INTEGRATION POINT: 
      // db.users.updateOne({ email: customerEmail }, { $set: { status: 'expired', tier: 'free' } });
      
      break;
    }
    
    case 'checkout.session.completed': {
      const session = event.data.object;
      console.log(`✅ Payment received! Premium unlocked for: ${session.customer_details.email}`);
      
      // PRODUCTION INTEGRATION POINT:
      // db.users.updateOne({ email: session.customer_details.email }, { $set: { status: 'active', tier: 'premium' } });
      
      break;
    }

    default:
      console.log(`Unhandled event payload signature type: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}