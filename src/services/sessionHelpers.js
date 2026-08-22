/**
 * Lightweight signed-session helpers.
 *
 * The app's login flow authenticates a user by email via a one-time code
 * (see /api/auth/verify-otp). Previously nothing was issued after that check
 * succeeded, so the browser had no way to prove "I already verified this
 * email" on a later request — a page refresh lost that fact entirely and
 * the user was dropped back to the login screen.
 *
 * This adds a small HMAC-signed token (no new dependency — Node's built-in
 * crypto module) carrying the verified userId/email. It's stored in an
 * HttpOnly cookie by the verify-otp route, so client-side JS can never read
 * or forge it, and a page refresh can silently re-validate it via
 * /api/auth/session instead of asking the user to log in again.
 */

import crypto from 'crypto';

const SECRET = process.env.SESSION_SECRET || 'vibekey-dev-only-session-secret-do-not-use-in-production';

if (!process.env.SESSION_SECRET) {
  console.warn(
    '⚠️  SESSION_SECRET is not set — using an insecure development fallback. ' +
    'Set SESSION_SECRET in your environment before deploying to production.'
  );
}

function sign(payload) {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
}

// Build a signed token for a verified userId (email). Format: base64url(payload).signature
export function createSessionToken(userId) {
  const payload = String(userId).trim().toLowerCase();
  const encodedPayload = Buffer.from(payload, 'utf8').toString('base64url');
  const signature = sign(payload);
  return `${encodedPayload}.${signature}`;
}

// Verify a token produced by createSessionToken. Returns the userId on
// success, or null if the token is missing, malformed, or the signature
// doesn't match (tampered/forged).
export function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;

  const separatorIndex = token.lastIndexOf('.');
  if (separatorIndex <= 0) return null;

  const encodedPayload = token.slice(0, separatorIndex);
  const signature = token.slice(separatorIndex + 1);
  if (!encodedPayload || !signature) return null;

  let payload;
  try {
    payload = Buffer.from(encodedPayload, 'base64url').toString('utf8');
  } catch {
    return null;
  }

  const expectedSignature = sign(payload);

  const providedBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);
  if (providedBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(providedBuf, expectedBuf)) return null;

  return payload;
}

export const SESSION_COOKIE_NAME = 'vibekey_session';

// Shared cookie options so set/clear always agree on attributes.
export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  };
}

// Read and verify the session cookie from a request. Returns the verified
// (lowercased) userId, or null if there's no cookie / it's invalid.
export function getSessionUserId(req) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

/**
 * Check whether the request's session cookie belongs to claimedUserId.
 *
 * This is what stops any API route from being callable for someone else's
 * account just by knowing/guessing their email — every route that reads or
 * writes a specific user's data should require this before doing so.
 *
 * Comparison is case-insensitive because the session token always stores a
 * normalized (trimmed + lowercased) email, while userId values elsewhere in
 * the app are stored/sent in whatever case the user originally typed them.
 * Only the *authorization check* is case-insensitive — the underlying
 * database queries are untouched and keep using the original casing exactly
 * as they do today, so no existing data or lookups are affected.
 */
export function isSessionAuthorized(req, claimedUserId) {
  const sessionUserId = getSessionUserId(req);
  if (!sessionUserId || !claimedUserId) return false;
  return sessionUserId === String(claimedUserId).trim().toLowerCase();
}

// Standard 401 payload used by every route that requires the session to
// match the userId being acted on.
export function unauthorizedResponse() {
  return {
    body: { success: false, error: 'Unauthorized. Please log in again.' },
    status: 401,
  };
}
