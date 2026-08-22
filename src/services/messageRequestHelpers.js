/**
 * Shared helpers for message request approval workflow.
 * Validates conversation access and manages message-request state between users.
 */

const REQUEST_STATUS = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  REVOKED: 'Revoked',
};

/**
 * Ensures required indexes exist on message_requests.
 */
export async function ensureMessageRequestIndexes(db) {
  await db.collection('message_requests').createIndex(
    { senderId: 1, receiverId: 1 },
    { unique: false }
  );
  await db.collection('message_requests').createIndex({ receiverId: 1, requestStatus: 1 });
  await db.collection('message_requests').createIndex({ senderId: 1, requestStatus: 1 });
}

/**
 * Check if two users have an approved conversation.
 * Legacy chats (existing messages) remain accessible for backward compatibility.
 */
export async function isConversationApproved(db, userId1, userId2) {
  const uid1 = String(userId1);
  const uid2 = String(userId2);

  // Backward compatibility: existing message history implies approved chat
  const existingMessage = await db.collection('messages').findOne({
    $or: [
      { senderId: uid1, receiverId: uid2 },
      { senderId: uid2, receiverId: uid1 },
    ],
  });
  if (existingMessage) return true;

  const acceptedRequest = await db.collection('message_requests').findOne({
    requestStatus: REQUEST_STATUS.ACCEPTED,
    $or: [
      { senderId: uid1, receiverId: uid2 },
      { senderId: uid2, receiverId: uid1 },
    ],
  });
  return !!acceptedRequest;
}

/**
 * Get the message-request status between currentUser and otherUser.
 * Returns: 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'rejected'
 */
export async function getMessageRequestStatus(db, currentUserId, otherUserId) {
  const uid = String(currentUserId);
  const oid = String(otherUserId);

  if (await isConversationApproved(db, uid, oid)) {
    return 'accepted';
  }

  const pendingSent = await db.collection('message_requests').findOne({
    senderId: uid,
    receiverId: oid,
    requestStatus: REQUEST_STATUS.PENDING,
  });
  if (pendingSent) return 'pending_sent';

  const pendingReceived = await db.collection('message_requests').findOne({
    senderId: oid,
    receiverId: uid,
    requestStatus: REQUEST_STATUS.PENDING,
  });
  if (pendingReceived) return 'pending_received';

  const rejected = await db.collection('message_requests').findOne({
    $or: [
      { senderId: uid, receiverId: oid, requestStatus: REQUEST_STATUS.REJECTED },
      { senderId: oid, receiverId: uid, requestStatus: REQUEST_STATUS.REJECTED },
    ],
  });
  if (rejected) return 'rejected';

  return 'none';
}


export { REQUEST_STATUS };
