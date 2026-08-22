import { NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb';
import { isConversationApproved } from '../../../services/messageRequestHelpers';
import {
  ensureBlockIndexes,
  getBlockStatus,
  blockUser,
  unblockUser,
} from '../../../services/blockHelpers';
import { isSessionAuthorized, unauthorizedResponse } from '../../../services/sessionHelpers';

async function getDatabase() {
  const client = await clientPromise;
  return client.db('bandhan-engine');
}

// GET — check block status between two users
// Returns whether userId has blocked otherUserId (iBlockedThem) and vice versa (theyBlockedMe)
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const otherUserId = searchParams.get('otherUserId');

    if (!userId || !otherUserId) {
      return NextResponse.json(
        { success: false, error: 'userId and otherUserId are required.' },
        { status: 400 }
      );
    }

    if (!isSessionAuthorized(req, userId)) {
      const { body, status } = unauthorizedResponse();
      return NextResponse.json(body, { status });
    }

    const db = await getDatabase();
    await ensureBlockIndexes(db);
    const { iBlockedThem, theyBlockedMe } = await getBlockStatus(db, userId, otherUserId);

    return NextResponse.json({ success: true, iBlockedThem, theyBlockedMe });
  } catch (error) {
    console.error('Block Status GET Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST — block a user
// blockerUserId is the logged-in user performing the action; blockedUserId is the target.
export async function POST(req) {
  try {
    const body = await req.json();
    const { blockerUserId, blockedUserId } = body;

    if (!blockerUserId || !blockedUserId) {
      return NextResponse.json(
        { success: false, error: 'blockerUserId and blockedUserId are required.' },
        { status: 400 }
      );
    }

    const blockerId = String(blockerUserId);
    const blockedId = String(blockedUserId);

    if (blockerId === blockedId) {
      return NextResponse.json(
        { success: false, error: 'Cannot block yourself.' },
        { status: 400 }
      );
    }

    if (!isSessionAuthorized(req, blockerId)) {
      const { body: unauthBody, status } = unauthorizedResponse();
      return NextResponse.json(unauthBody, { status });
    }

    const db = await getDatabase();
    await ensureBlockIndexes(db);

    // Security: only allow blocking between users with an approved conversation
    // (accepted request or legacy message history). Prevents arbitrary block-spam
    // of unrelated userIds via direct API calls.
    const hasApprovedConversation = await isConversationApproved(db, blockerId, blockedId);
    if (!hasApprovedConversation) {
      return NextResponse.json(
        { success: false, error: 'No existing conversation with this user.' },
        { status: 403 }
      );
    }

    await blockUser(db, blockerId, blockedId);

    return NextResponse.json({ success: true, message: 'User blocked successfully.' });
  } catch (error) {
    console.error('Block POST Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE — unblock a user
// blockerUserId is the logged-in user performing the action; blockedUserId is the target.
export async function DELETE(req) {
  try {
    const body = await req.json();
    const { blockerUserId, blockedUserId } = body;

    if (!blockerUserId || !blockedUserId) {
      return NextResponse.json(
        { success: false, error: 'blockerUserId and blockedUserId are required.' },
        { status: 400 }
      );
    }

    const blockerId = String(blockerUserId);
    const blockedId = String(blockedUserId);

    if (blockerId === blockedId) {
      return NextResponse.json(
        { success: false, error: 'Invalid request.' },
        { status: 400 }
      );
    }

    if (!isSessionAuthorized(req, blockerId)) {
      const { body, status } = unauthorizedResponse();
      return NextResponse.json(body, { status });
    }

    const db = await getDatabase();
    await ensureBlockIndexes(db);
    await unblockUser(db, blockerId, blockedId);

    return NextResponse.json({ success: true, message: 'User unblocked successfully.' });
  } catch (error) {
    console.error('Block DELETE Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
