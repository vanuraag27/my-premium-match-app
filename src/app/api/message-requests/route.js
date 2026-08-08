import { NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb';
import {
  ensureMessageRequestIndexes,
  REQUEST_STATUS,
  createNotification,
} from '../../../services/messageRequestHelpers';
import { isUserBlocked } from '../../../services/blockHelpers';

async function getDatabase() {
  const client = await clientPromise;
  return client.db('bandhan-engine');
}

/**
 * Enrich a request document with sender profile details for the inbox UI.
 */
async function enrichRequestWithProfile(db, request) {
  const sender = await db.collection('users').findOne({ userId: request.senderId });
  return {
    ...request,
    _id: request._id.toString(),
    senderName: sender?.name || 'Unknown User',
    senderPhotoUrl: sender?.photoUrl || '',
    senderProfession: sender?.profession || 'Professional',
  };
}

// GET — list message requests for a user (incoming, outgoing, or all)
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const type = searchParams.get('type') || 'all'; // 'incoming' | 'outgoing' | 'all'

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Missing userId parameter.' }, { status: 400 });
    }

    const db = await getDatabase();
    await ensureMessageRequestIndexes(db);

    const uid = String(userId);
    let query = {};

    if (type === 'incoming') {
      query = { receiverId: uid };
    } else if (type === 'outgoing') {
      query = { senderId: uid };
    } else {
      query = { $or: [{ receiverId: uid }, { senderId: uid }] };
    }

    const requests = await db
      .collection('message_requests')
      .find(query)
      .sort({ requestCreatedAt: -1 })
      .toArray();

    const enriched = await Promise.all(requests.map((r) => enrichRequestWithProfile(db, r)));

    return NextResponse.json({ success: true, requests: enriched });
  } catch (error) {
    console.error('Message Requests GET Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST — create a new message request (first message workflow)
export async function POST(req) {
  try {
    const body = await req.json();
    const { senderId, receiverId, firstMessage, matchPercentage } = body;

    if (!senderId || !receiverId || !firstMessage?.trim()) {
      return NextResponse.json(
        { success: false, error: 'senderId, receiverId, and firstMessage are required.' },
        { status: 400 }
      );
    }

    const sid = String(senderId);
    const rid = String(receiverId);

    if (sid === rid) {
      return NextResponse.json(
        { success: false, error: 'Cannot send a message request to yourself.' },
        { status: 400 }
      );
    }

    const db = await getDatabase();
    await ensureMessageRequestIndexes(db);

    // Security: the receiver may have blocked the sender — server-side
    // enforcement so a new request cannot be used to bypass a block.
    const blockedByReceiver = await isUserBlocked(db, rid, sid);
    if (blockedByReceiver) {
      return NextResponse.json(
        {
          success: false,
          error: 'You cannot send messages because this user has blocked communication.',
          blocked: true,
        },
        { status: 403 }
      );
    }

    if (firstMessage.trim().length > 1000) {
      return NextResponse.json(
        { success: false, error: 'First message exceeds maximum length of 1000 characters.' },
        { status: 400 }
      );
    }

    // Prevent duplicate pending requests between the same pair
    const existingPending = await db.collection('message_requests').findOne({
      senderId: sid,
      receiverId: rid,
      requestStatus: REQUEST_STATUS.PENDING,
    });
    if (existingPending) {
      return NextResponse.json(
        { success: false, error: 'A pending message request already exists for this user.' },
        { status: 409 }
      );
    }

    // Prevent new requests if already accepted
    const existingAccepted = await db.collection('message_requests').findOne({
      requestStatus: REQUEST_STATUS.ACCEPTED,
      $or: [
        { senderId: sid, receiverId: rid },
        { senderId: rid, receiverId: sid },
      ],
    });
    if (existingAccepted) {
      return NextResponse.json(
        { success: false, error: 'A conversation already exists with this user.' },
        { status: 409 }
      );
    }

    // Block repeat requests after rejection (audit history preserved)
    const existingRejected = await db.collection('message_requests').findOne({
      senderId: sid,
      receiverId: rid,
      requestStatus: REQUEST_STATUS.REJECTED,
    });
    if (existingRejected) {
      return NextResponse.json(
        { success: false, error: 'Your previous message request was rejected. Messaging is not available.' },
        { status: 403 }
      );
    }

    // Rate limiting: max 5 pending outgoing requests per user
    const pendingCount = await db.collection('message_requests').countDocuments({
      senderId: sid,
      requestStatus: REQUEST_STATUS.PENDING,
    });
    if (pendingCount >= 5) {
      return NextResponse.json(
        { success: false, error: 'Too many pending message requests. Please wait for responses.' },
        { status: 429 }
      );
    }

    const requestDoc = {
      senderId: sid,
      receiverId: rid,
      firstMessage: firstMessage.trim(),
      matchPercentage: typeof matchPercentage === 'number' ? matchPercentage : null,
      requestStatus: REQUEST_STATUS.PENDING,
      requestCreatedAt: new Date(),
      requestRespondedAt: null,
      acceptedBy: null,
      rejectedBy: null,
    };

    const result = await db.collection('message_requests').insertOne(requestDoc);

    // Notify receiver of new message request
    const sender = await db.collection('users').findOne({ userId: sid });
    await createNotification(db, {
      userId: rid,
      type: 'new_message_request',
      title: 'New Message Request',
      body: `${sender?.name || 'Someone'} sent you a message request.`,
      relatedRequestId: result.insertedId,
      relatedUserId: sid,
    });

    return NextResponse.json({
      success: true,
      request: { ...requestDoc, _id: result.insertedId.toString() },
    });
  } catch (error) {
    console.error('Message Requests POST Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH — accept or reject a message request (receiver only)
export async function PATCH(req) {
  try {
    const body = await req.json();
    const { requestId, userId, action } = body;

    if (!requestId || !userId || !action) {
      return NextResponse.json(
        { success: false, error: 'requestId, userId, and action are required.' },
        { status: 400 }
      );
    }

    if (!['accept', 'reject'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Action must be "accept" or "reject".' },
        { status: 400 }
      );
    }

    const db = await getDatabase();
    const { ObjectId } = await import('mongodb');

    let objectId;
    try {
      objectId = new ObjectId(requestId);
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid request ID.' }, { status: 400 });
    }

    const request = await db.collection('message_requests').findOne({ _id: objectId });

    if (!request) {
      return NextResponse.json({ success: false, error: 'Message request not found.' }, { status: 404 });
    }

    // Security: only the intended receiver can accept or reject
    if (String(request.receiverId) !== String(userId)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Only the receiver can respond to this request.' },
        { status: 403 }
      );
    }

    if (request.requestStatus !== REQUEST_STATUS.PENDING) {
      return NextResponse.json(
        { success: false, error: `Request has already been ${request.requestStatus.toLowerCase()}.` },
        { status: 409 }
      );
    }

    const now = new Date();
    const uid = String(userId);

    if (action === 'accept') {
      await db.collection('message_requests').updateOne(
        { _id: objectId },
        {
          $set: {
            requestStatus: REQUEST_STATUS.ACCEPTED,
            requestRespondedAt: now,
            acceptedBy: uid,
          },
        }
      );

      // Create the first message in the conversation from the stored request
      await db.collection('messages').insertOne({
        senderId: request.senderId,
        receiverId: request.receiverId,
        messageText: request.firstMessage,
        timestamp: request.requestCreatedAt,
      });

      // Notify sender that request was accepted
      const receiver = await db.collection('users').findOne({ userId: uid });
      await createNotification(db, {
        userId: request.senderId,
        type: 'message_request_accepted',
        title: 'Message Request Accepted',
        body: `${receiver?.name || 'Your match'} accepted your message request. You can now chat!`,
        relatedRequestId: objectId,
        relatedUserId: uid,
      });

      return NextResponse.json({
        success: true,
        status: REQUEST_STATUS.ACCEPTED,
        message: 'Message request accepted. Conversation is now open.',
      });
    }

    // Reject flow — store for history/audit, no conversation created
    await db.collection('message_requests').updateOne(
      { _id: objectId },
      {
        $set: {
          requestStatus: REQUEST_STATUS.REJECTED,
          requestRespondedAt: now,
          rejectedBy: uid,
        },
      }
    );

    const receiver = await db.collection('users').findOne({ userId: uid });
    await createNotification(db, {
      userId: request.senderId,
      type: 'message_request_rejected',
      title: 'Message Request Declined',
      body: `${receiver?.name || 'Your match'} declined your message request.`,
      relatedRequestId: objectId,
      relatedUserId: uid,
    });

    return NextResponse.json({
      success: true,
      status: REQUEST_STATUS.REJECTED,
      message: 'Message request rejected.',
    });
  } catch (error) {
    console.error('Message Requests PATCH Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
