import { NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb';
import { isConversationApproved } from '../../../services/messageRequestHelpers';
import { isUserBlocked } from '../../../services/blockHelpers';
import { isSessionAuthorized, unauthorizedResponse } from '../../../services/sessionHelpers';

let messagesIndexesPromise = null;

function ensureMessageIndexes(db) {
  if (!messagesIndexesPromise) {
    messagesIndexesPromise = Promise.all([
      db.collection('messages').createIndex({ timestamp: 1 }, { expireAfterSeconds: 86400 }),
      db.collection('messages').createIndex({ senderId: 1, timestamp: -1 }),
      db.collection('messages').createIndex({ senderId: 1, receiverId: 1, timestamp: 1 }),
    ]).catch((error) => {
      messagesIndexesPromise = null;
      throw error;
    });
  }
  return messagesIndexesPromise;
}

// Fetch chat history — only allowed for approved conversations
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const senderId = searchParams.get('senderId');
    const receiverId = searchParams.get('receiverId');

    if (!senderId || !receiverId) {
      return NextResponse.json({ success: false, error: 'Missing user parameters.' }, { status: 400 });
    }

    if (!isSessionAuthorized(req, senderId)) {
      const { body, status } = unauthorizedResponse();
      return NextResponse.json(body, { status });
    }

    const client = await clientPromise;
    const db = client.db('bandhan-engine');

    // Security: prevent unauthorized conversation access
    const approved = await isConversationApproved(db, senderId, receiverId);
    if (!approved) {
      return NextResponse.json({
        success: true,
        messages: [],
        requiresApproval: true,
      });
    }

    const conversationHistory = await db.collection('messages').find({
      $or: [
        { senderId: String(senderId), receiverId: String(receiverId) },
        { senderId: String(receiverId), receiverId: String(senderId) }
      ]
    })
    .sort({ timestamp: 1 })
    .toArray();

    // The caller (senderId param) is actively viewing this conversation —
    // mark any messages sent TO them by the other party as read so the
    // unread indicator/green Message button clears once the chat is open.
    // Capture which incoming messages were unread *before* this marks them
    // read, so the client can optionally read them aloud once when the
    // chat is opened (see the Read Messages Aloud feature) — without this,
    // a message that arrived while the chat was closed would never get
    // spoken, since the "new incoming message" detection on the client
    // only fires for messages that arrive while the chat is already open.
    const unreadIncomingMessages = conversationHistory.filter(
      (message) =>
        String(message.senderId) === String(receiverId) &&
        String(message.receiverId) === String(senderId) &&
        message.read !== true
    );

    await db.collection('messages').updateMany(
      {
        senderId: String(receiverId),
        receiverId: String(senderId),
        read: { $ne: true },
      },
      { $set: { read: true, deliveredAt: new Date() } }
    );

    return NextResponse.json({
      success: true,
      messages: conversationHistory,
      newlyReadMessageIds: unreadIncomingMessages.map((message) => String(message._id)),
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Post new message — only allowed after message request approval
export async function POST(req) {
  try {
    const body = await req.json();
    const { senderId, receiverId, messageText } = body;

    if (!senderId || !receiverId || !messageText?.trim()) {
      return NextResponse.json({ success: false, error: 'Invalid parameters.' }, { status: 400 });
    }

    if (String(senderId) === String(receiverId)) {
      return NextResponse.json({ success: false, error: 'Cannot message yourself.' }, { status: 400 });
    }

    if (!isSessionAuthorized(req, senderId)) {
      const { body: unauthBody, status } = unauthorizedResponse();
      return NextResponse.json(unauthBody, { status });
    }

    const client = await clientPromise;
    const db = client.db('bandhan-engine');

    // Security: verify conversation is approved before allowing messages
    const approved = await isConversationApproved(db, senderId, receiverId);
    if (!approved) {
      return NextResponse.json(
        {
          success: false,
          error: 'Messaging requires an accepted message request. Send a message request first.',
          requiresApproval: true,
        },
        { status: 403 }
      );
    }

    // Security: the recipient may have blocked the sender — server-side
    // enforcement so this cannot be bypassed by calling the API directly,
    // regardless of what the client UI allows.
    const blockedByRecipient = await isUserBlocked(db, receiverId, senderId);
    if (blockedByRecipient) {
      return NextResponse.json(
        {
          success: false,
          error: 'You cannot send messages because this user has blocked communication.',
          blocked: true,
        },
        { status: 403 }
      );
    }

    // Spam prevention: rate limit to 30 messages per minute per sender
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const recentCount = await db.collection('messages').countDocuments({
      senderId: String(senderId),
      timestamp: { $gte: oneMinuteAgo },
    });
    if (recentCount >= 30) {
      return NextResponse.json(
        { success: false, error: 'Message rate limit exceeded. Please wait a moment.' },
        { status: 429 }
      );
    }

    // Ensure indexes once per server process instead of running createIndex on every message.
    // This keeps normal message sends fast while retaining TTL cleanup and rate-limit indexes.
    await ensureMessageIndexes(db);

    const entryPayload = {
      senderId: String(senderId),
      receiverId: String(receiverId),
      messageText: messageText.trim(),
      timestamp: new Date(), // Native BSON Date for TTL auto-deletion
      read: false, // Tracks unread status for the receiver's Message button indicator
      deliveredAt: null // Set when the recipient's app receives/loads the message
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
