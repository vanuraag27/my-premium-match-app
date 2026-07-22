import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';

// GET: Retrieve and normalize conversation history
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const senderId = searchParams.get('senderId');
    const receiverId = searchParams.get('receiverId');

    if (!senderId || !receiverId) {
      return NextResponse.json(
        { success: false, error: 'senderId and receiverId are required parameters.' },
        { status: 400 }
      );
    }

    const db = await getDatabase();

    const rawMessages = await db
      .collection('messages')
      .find({
        $or: [
          { senderId, receiverId },
          { senderId: receiverId, receiverId: senderId },
        ],
      })
      .sort({ createdAt: 1, timestamp: 1 })
      .toArray();

    // Standardize documents for the frontend
    const normalizedMessages = rawMessages.map((msg) => ({
      _id: msg._id.toString(),
      senderId: String(msg.senderId),
      receiverId: String(msg.receiverId),
      text: msg.text || msg.message || msg.content || '',
      createdAt: msg.createdAt || msg.timestamp || new Date().toISOString(),
      read: msg.read || false,
    }));

    return NextResponse.json({ success: true, messages: normalizedMessages }, { status: 200 });
  } catch (error) {
    console.error('GET /api/messages error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Save normalized message document
export async function POST(req) {
  try {
    const body = await req.json();
    const senderId = String(body.senderId || '');
    const receiverId = String(body.receiverId || '');
    const messageText = body.text || body.message || body.content || '';

    if (!senderId || !receiverId || !messageText.trim()) {
      return NextResponse.json(
        { success: false, error: 'senderId, receiverId, and text are required.' },
        { status: 400 }
      );
    }

    const db = await getDatabase();

    const newMessage = {
      senderId,
      receiverId,
      text: messageText.trim(),
      createdAt: new Date().toISOString(),
      read: false,
    };

    const result = await db.collection('messages').insertOne(newMessage);

    return NextResponse.json(
      {
        success: true,
        message: {
          ...newMessage,
          _id: result.insertedId.toString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/messages error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}