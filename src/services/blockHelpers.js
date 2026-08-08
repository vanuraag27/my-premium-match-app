/**
 * Shared helpers for the User Block / Unblock messaging feature.
 * Uses a raw `blocks` collection, following the same pattern as
 * messageRequestHelpers.js (message_requests, notifications) — no
 * Mongoose model is introduced, keeping the existing architecture intact.
 *
 * Blocking is directional and does not touch existing chat or match
 * records: it only gates whether a new message / message request from
 * `blockedUserId` to `blockerUserId` is allowed to go through.
 */

/**
 * Ensures a unique compound index exists on (blockerUserId, blockedUserId).
 * This guarantees exactly one block record per direction, which is what
 * prevents duplicate block records regardless of how many times the
 * block/unblock endpoints are called.
 */
export async function ensureBlockIndexes(db) {
  await db.collection('blocks').createIndex(
    { blockerUserId: 1, blockedUserId: 1 },
    { unique: true }
  );
  await db.collection('blocks').createIndex(
    { blockedUserId: 1, isBlocked: 1 }
  );
}

/**
 * Returns true if blockerUserId currently has an active block against
 * blockedUserId (i.e. blockedUserId is blocked FROM messaging blockerUserId).
 */
export async function isUserBlocked(db, blockerUserId, blockedUserId) {
  const record = await db.collection('blocks').findOne({
    blockerUserId: String(blockerUserId),
    blockedUserId: String(blockedUserId),
    isBlocked: true,
  });
  return !!record;
}

/**
 * Returns the two-way block relationship between userId and otherUserId:
 * - iBlockedThem: userId has blocked otherUserId
 * - theyBlockedMe: otherUserId has blocked userId
 */
export async function getBlockStatus(db, userId, otherUserId) {
  const uid = String(userId);
  const oid = String(otherUserId);

  const [iBlockedThem, theyBlockedMe] = await Promise.all([
    isUserBlocked(db, uid, oid),
    isUserBlocked(db, oid, uid),
  ]);

  return { iBlockedThem, theyBlockedMe };
}

/**
 * Block a user. Idempotent — upserts on the unique (blockerUserId,
 * blockedUserId) pair, so calling this repeatedly never creates duplicate
 * block records; it just refreshes the existing one.
 */
export async function blockUser(db, blockerUserId, blockedUserId) {
  const blockerId = String(blockerUserId);
  const blockedId = String(blockedUserId);

  await db.collection('blocks').updateOne(
    { blockerUserId: blockerId, blockedUserId: blockedId },
    {
      $set: {
        blockerUserId: blockerId,
        blockedUserId: blockedId,
        isBlocked: true,
        blockedAt: new Date(),
      },
    },
    { upsert: true }
  );
}

/**
 * Unblock a user. Restores messaging immediately. Does not delete the
 * underlying record (kept for audit/history) and does not touch chat or
 * match data. Safe to call even if no block record exists yet.
 */
export async function unblockUser(db, blockerUserId, blockedUserId) {
  const blockerId = String(blockerUserId);
  const blockedId = String(blockedUserId);

  await db.collection('blocks').updateOne(
    { blockerUserId: blockerId, blockedUserId: blockedId },
    {
      $set: { isBlocked: false },
      $setOnInsert: {
        blockerUserId: blockerId,
        blockedUserId: blockedId,
        blockedAt: null,
      },
    },
    { upsert: true }
  );
}
