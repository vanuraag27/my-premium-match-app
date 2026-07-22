import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// GET: Fetch conversation OR unread message indicators
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const partnerId = searchParams.get('partnerId');
    const checkUnread = searchParams.get('checkUnread');

    const { db } = await connectToDatabase();

    // Check for unread message counts/indicators across conversations
    if (checkUnread === 'true' && userId) {
      const unreadCount = await db.collection('messages').countDocuments({
        receiverId: userId,
        read: false,
      });
      return NextResponse.json({ success: true, unreadCount, hasUnread: unreadCount > 0 });
    }

    // Fetch message history between two users
    if (userId && partnerId) {
      const messages = await db.collection('messages')
        .find({
          $or: [
            { senderId: userId, receiverId: partnerId },
            { senderId: partnerId, receiverId: userId }
          ],
          deletedFor: { $ne: userId } // Don't return messages deleted by this user
        })
        .sort({ timestamp: 1 })
        .toArray();

      // Mark incoming messages as read
      await db.collection('messages').updateMany(
        { senderId: partnerId, receiverId: userId, read: false },
        { $set: { read: true } }
      );

      return NextResponse.json({ success: true, messages });
    }

    return NextResponse.json({ success: false, error: 'Missing user parameters' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE: Hide/delete a message for the requesting user
export async function DELETE(req) {
  try {
    const { messageId, userId } = await req.json();

    if (!messageId || !userId) {
      return NextResponse.json({ success: false, error: 'Message ID and User ID are required' }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    // Soft delete: append user ID to deletedFor array so the message disappears from their panel
    await db.collection('messages').updateOne(
      { _id: new ObjectId(messageId) },
      { $addToSet: { deletedFor: userId } }
    );

    return NextResponse.json({ success: true, message: 'Message deleted successfully' });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}