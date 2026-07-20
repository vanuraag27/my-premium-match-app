import { NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb';

// Pull message list logs between two specified user identifier strings
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const senderId = searchParams.get('senderId');
    const receiverId = searchParams.get('receiverId');

    if (!senderId || !receiverId) {
      return NextResponse.json({ success: false, error: 'Incomplete communication trace routing values.' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('bandhan-engine');
    const collection = db.collection('messages');

    const conversationHistory = await collection.find({
      $or: [
        { senderId: senderId, receiverId: receiverId },
        { senderId: receiverId, receiverId: senderId }
      ]
    })
    .sort({ timestamp: 1 })
    .toArray();

    return NextResponse.json({ success: true, messages: conversationHistory });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Post a new message transmission text chunk down to database
export async function POST(req) {
  try {
    const body = await req.json();
    const { senderId, receiverId, messageText } = body;

    if (!senderId || !receiverId || !messageText?.trim()) {
      return NextResponse.json({ success: false, error: 'Invalid document schema params.' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('bandhan-engine');
    const collection = db.collection('messages');

    const entryPayload = {
      senderId,
      receiverId,
      messageText: messageText.trim(),
      timestamp: new Date()
    };

    await collection.insertOne(entryPayload);

    return NextResponse.json({ success: true, message: entryPayload });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}