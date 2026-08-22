import { NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb';
import { isSessionAuthorized, unauthorizedResponse } from '../../../services/sessionHelpers';

const ONLINE_WINDOW_MS = 30 * 1000;

export async function POST(req) {
  try {
    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ success: false, error: 'Missing userId.' }, { status: 400 });
    if (!isSessionAuthorized(req, userId)) {
      const { body, status } = unauthorizedResponse();
      return NextResponse.json(body, { status });
    }
    const client = await clientPromise;
    const db = client.db('bandhan-engine');
    await db.collection('presence').updateOne(
      { userId: String(userId) },
      { $set: { userId: String(userId), lastSeenAt: new Date() } },
      { upsert: true }
    );
    return NextResponse.json({ success: true, online: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userIds = (searchParams.get('userIds') || '').split(',').map((v) => v.trim()).filter(Boolean);
    if (!userIds.length) return NextResponse.json({ success: true, presence: {} });
    const client = await clientPromise;
    const db = client.db('bandhan-engine');
    const cutoff = new Date(Date.now() - ONLINE_WINDOW_MS);
    const rows = await db.collection('presence').find({ userId: { $in: userIds } }).toArray();
    const presence = {};
    rows.forEach((row) => {
      presence[String(row.userId)] = Boolean(row.lastSeenAt && new Date(row.lastSeenAt) >= cutoff);
    });
    return NextResponse.json({ success: true, presence });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ success: false, error: 'Missing userId.' }, { status: 400 });
    if (!isSessionAuthorized(req, userId)) {
      const { body, status } = unauthorizedResponse();
      return NextResponse.json(body, { status });
    }
    const client = await clientPromise;
    const db = client.db('bandhan-engine');
    await db.collection('presence').updateOne(
      { userId: String(userId) },
      { $set: { userId: String(userId), lastSeenAt: new Date(0) } },
      { upsert: true }
    );
    return NextResponse.json({ success: true, online: false });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
