import { NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb';
import { ObjectId } from 'mongodb';

// Helper function to get MongoDB instance
async function getDb() {
  const client = await clientPromise;
  return client.db(); // Uses default database from MONGODB_URI
}

// GET: Fetch conversation OR unread message indicators
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || searchParams.get('senderId');
    const partnerId = searchParams.get('partnerId') || searchParams.get('receiverId');
    const checkUnread = searchParams.get('checkUnread');

    const db = await getDb();

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
          deletedFor: { $ne: userId } // Hide messages soft-deleted by this user
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

// POST: Save new incoming message
export async function POST(req) {
  try {
    const body = await req.json();
    const { senderId, receiverId, text, timestamp } = body;

    if (!senderId || !receiverId || !text) {
      return NextResponse.json({ success: false, error: 'senderId, receiverId, and text are required' }, { status: 400 });
    }

    const db = await getDb();
    
    const newMessage = {
      senderId,
      receiverId,
      text,
      timestamp: timestamp || new Date().toISOString(),
      read: false,
      deletedFor: []
    };

    const result = await db.collection('messages').insertOne(newMessage);

    return NextResponse.json({
      success: true,
      message: { ...newMessage, _id: result.insertedId }
    });
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

    const db = await getDb();

    // Soft delete: append user ID to deletedFor array
    await db.collection('messages').updateOne(
      { _id: new ObjectId(messageId) },
      { $addToSet: { deletedFor: userId } }
    );

    return NextResponse.json({ success: true, message: 'Message deleted successfully' });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}