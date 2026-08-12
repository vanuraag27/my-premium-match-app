import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';

// GET — fetch unread messages addressed to a user, across all conversations.
// Used so the Message button can turn GREEN and the audio notification can
// ring immediately even while the corresponding chat window is closed.
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Missing userId parameter.' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('bandhan-engine');

    const unreadMessages = await db.collection('messages')
      .find({ receiverId: String(userId), read: { $ne: true } })
      .project({ _id: 1, senderId: 1, timestamp: 1 })
      .sort({ timestamp: 1 })
      .toArray();

    return NextResponse.json({
      success: true,
      unreadMessages: unreadMessages.map((m) => ({
        _id: m._id.toString(),
        senderId: m.senderId,
        timestamp: m.timestamp,
      })),
    });
  } catch (error) {
    console.error('Unread Messages GET Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
