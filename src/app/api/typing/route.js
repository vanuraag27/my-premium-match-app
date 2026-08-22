import { NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb';
import { getSessionUserId, isSessionAuthorized, unauthorizedResponse } from '../../../services/sessionHelpers';

const TYPING_WINDOW_MS = 7000;
const globalForTyping = globalThis;
if (!globalForTyping.__vibekeyTypingState) globalForTyping.__vibekeyTypingState = new Map();
const typingState = globalForTyping.__vibekeyTypingState;

export async function POST(req) {
  try {
    const { userId, otherUserId, isTyping } = await req.json();
    const sessionUserId = getSessionUserId(req);
    if (!userId || !otherUserId || !sessionUserId || !isSessionAuthorized(req, userId)) {
      const { body, status } = unauthorizedResponse();
      return NextResponse.json(body, { status });
    }

    // Always use the authenticated session identity as the sender. This avoids
    // casing/identity mismatches between the profile object and session cookie.
    const sender = String(sessionUserId).trim().toLowerCase();
    const recipient = String(otherUserId).trim();
    const key = `${sender}::${recipient}`;

    if (isTyping) {
      const now = Date.now();
      typingState.set(key, now);
      const client = await clientPromise;
      const db = client.db('bandhan-engine');
      await db.collection('typing').updateOne(
        { userId: sender, otherUserId: recipient },
        { $set: { userId: sender, otherUserId: recipient, updatedAt: new Date(now) } },
        { upsert: true }
      );
    } else {
      typingState.delete(key);
      const client = await clientPromise;
      const db = client.db('bandhan-engine');
      await db.collection('typing').deleteOne({ userId: sender, otherUserId: recipient });
    }

    return NextResponse.json(
      { success: true, isTyping: Boolean(isTyping) },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    );
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const otherUserId = searchParams.get('otherUserId');
    const sessionUserId = getSessionUserId(req);

    if (!userId || !otherUserId || !sessionUserId || !isSessionAuthorized(req, userId)) {
      const { body, status } = unauthorizedResponse();
      return NextResponse.json(body, { status });
    }

    // GET is from the recipient's perspective: find whether the other user is
    // currently typing to this authenticated session user.
    const sender = String(otherUserId).trim();
    const recipient = String(sessionUserId).trim().toLowerCase();
    const key = `${sender}::${recipient}`;
    const memoryUpdatedAt = typingState.get(key) || 0;
    const memoryIsTyping = memoryUpdatedAt >= Date.now() - TYPING_WINDOW_MS;

    const client = await clientPromise;
    const db = client.db('bandhan-engine');
    const row = await db.collection('typing').findOne({
      userId: sender,
      otherUserId: recipient,
      updatedAt: { $gte: new Date(Date.now() - TYPING_WINDOW_MS) },
    });

    return NextResponse.json(
      { success: true, isTyping: memoryIsTyping || Boolean(row) },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    );
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
