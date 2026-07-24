import { NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb';

// Fetch chat history
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const senderId = searchParams.get('senderId');
    const receiverId = searchParams.get('receiverId');

    if (!senderId || !receiverId) {
      return NextResponse.json({ success: false, error: 'Missing user parameters.' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('bandhan-engine');

    const conversationHistory = await db.collection('messages').find({
      $or: [
        { senderId: String(senderId), receiverId: String(receiverId) },
        { senderId: String(receiverId), receiverId: String(senderId) }
      ]
    })
    .sort({ timestamp: 1 })
    .toArray();

    return NextResponse.json({ success: true, messages: conversationHistory });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Post new message
export async function POST(req) {
  try {
    const body = await req.json();
    const { senderId, receiverId, messageText } = body;

    if (!senderId || !receiverId || !messageText?.trim()) {
      return NextResponse.json({ success: false, error: 'Invalid parameters.' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('bandhan-engine');

    const entryPayload = {
      senderId: String(senderId),
      receiverId: String(receiverId),
      messageText: messageText.trim(),
      timestamp: new Date() // Ensure this is a native Date object for TTL index
    };

    const result = await db.collection('messages').insertOne(entryPayload);

    return NextResponse.json({ 
      success: true, 
      message: { ...entryPayload, _id: result.insertedId } 
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}