import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const body = await req.json();
    const email = body.email ? body.email.trim().toLowerCase() : '';
    // Accept either otpToken or otp from request payload
    const otpToken = body.otpToken || body.otp;

    if (!email || !otpToken) {
      return NextResponse.json(
        { success: false, error: 'Missing email or OTP verification parameters.' },
        { status: 400 }
      );
    }

    // =========================================================================
    // GOOGLE PLAY REVIEWER STATIC BYPASS
    // Handles tester accounts & the default fallback email (username@domain.com)
    // seen in Google Play review screenshot tests.
    // =========================================================================
    const isTestEmail = 
      email === 'tester@vibekey.com' || 
      email === 'username@domain.com' || 
      email === 'tester@yourdomain.com';

    if (isTestEmail && String(otpToken).trim() === '123456') {
      console.log(`✅ Google Play Reviewer bypass authenticated successfully for: ${email}`);
      return NextResponse.json({
        success: true,
        message: 'Identity vector authenticated successfully (Reviewer Test Mode).'
      });
    }

    // =========================================================================
    // REGULAR OTP VERIFICATION FLOW
    // =========================================================================
    // Lookup token inside global context registry cache map
    const storedRecord = global.otpCache?.get(email);

    if (!storedRecord) {
      return NextResponse.json(
        { success: false, error: 'Verification session expired or does not exist.' },
        { status: 400 }
      );
    }

    if (storedRecord.code !== otpToken) {
      return NextResponse.json(
        { success: false, error: 'Incorrect verification code entry.' },
        { status: 401 }
      );
    }

    if (Date.now() > storedRecord.expires) {
      global.otpCache.delete(email); // Flush expired record reference
      return NextResponse.json(
        { success: false, error: 'Verification code time-limit expired.' },
        { status: 410 }
      );
    }

    // Token code verified successfully! Clear it out so it can't be reused
    global.otpCache.delete(email);
    console.log(`✅ Token authorization succeeded for node identity: ${email}`);

    return NextResponse.json({
      success: true,
      message: 'Identity vector authenticated successfully.'
    });

  } catch (error) {
    console.error("Token verification engine failure:", error);
    return NextResponse.json(
      { success: false, error: 'Internal gateway authentication failure.' },
      { status: 500 }
    );
  }
}