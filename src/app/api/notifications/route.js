import { NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb';
import { ensureMessageRequestIndexes } from '../../../services/messageRequestHelpers';

async function getDatabase() {
  const client = await clientPromise;
  return client.db('bandhan-engine');
}

// GET — fetch unread notifications for a user
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const includeRead = searchParams.get('includeRead') === 'true';

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Missing userId parameter.' }, { status: 400 });
    }

    const db = await getDatabase();
    await ensureMessageRequestIndexes(db);

    const query = { userId: String(userId) };
    if (!includeRead) {
      query.read = false;
    }

    const notifications = await db
      .collection('notifications')
      .find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    return NextResponse.json({
      success: true,
      notifications: notifications.map((n) => ({ ...n, _id: n._id.toString() })),
    });
  } catch (error) {
    console.error('Notifications GET Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH — mark notifications as read
export async function PATCH(req) {
  try {
    const body = await req.json();
    const { userId, notificationIds } = body;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Missing userId parameter.' }, { status: 400 });
    }

    const db = await getDatabase();
    const { ObjectId } = await import('mongodb');

    const filter = { userId: String(userId), read: false };

    if (notificationIds && Array.isArray(notificationIds) && notificationIds.length > 0) {
      filter._id = { $in: notificationIds.map((id) => new ObjectId(id)) };
    }

    await db.collection('notifications').updateMany(filter, { $set: { read: true } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Notifications PATCH Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
