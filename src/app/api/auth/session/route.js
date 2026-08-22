import { NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME, getSessionCookieOptions } from '../../../../services/sessionHelpers';

// GET — validate the signed session cookie (if present) and return the
// verified userId. Used on app mount / page refresh to restore a logged-in
// session without forcing the user back through the OTP flow.
export async function GET(req) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const userId = verifySessionToken(token);

    if (!userId) {
      return NextResponse.json({ success: true, authenticated: false });
    }

    return NextResponse.json({ success: true, authenticated: true, userId });
  } catch (error) {
    console.error('Session GET Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE — clear the session cookie on logout, so a later refresh doesn't
// silently re-authenticate a user who explicitly signed out.
export async function DELETE() {
  try {
    const response = NextResponse.json({ success: true });
    response.cookies.set(SESSION_COOKIE_NAME, '', { ...getSessionCookieOptions(), maxAge: 0 });
    return response;
  } catch (error) {
    console.error('Session DELETE Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
