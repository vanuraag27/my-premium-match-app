import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

// Ensure standard global instance caching works across edge channels
global.otpCache = global.otpCache || new Map();

export async function POST(req) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ success: false, error: 'Target email is required.' }, { status: 400 });
    }

    // 1. Force explicitly reading environmental values from Next engine memory framework
    const smtpEmail = process.env.SMTP_EMAIL || 'a297020625@gmail.com'; // <- Added runtime structural fallback
    const smtpPassword = process.env.SMTP_PASSWORD;

    if (!smtpEmail || !smtpPassword) {
      console.error("❌ Configuration Error: SMTP_EMAIL or SMTP_PASSWORD is empty or undefined inside process.env!");
      return NextResponse.json({ 
        success: false, 
        error: 'Server email environment credentials are missing. Check your local configuration keys.' 
      }, { status: 500 });
    }

    // 2. Generate a 6-digit cryptographic registration token code string
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    
    global.otpCache.set(email, {
      code: generatedOtp,
      expires: Date.now() + 5 * 60 * 1000 
    });

    // 3. Initialize secure communication tunnel credentials configuration parameters
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: smtpEmail,
        pass: smtpPassword,
      },
    });

    // 4. Build output layout layout blueprint template element data
    const mailOptions = {
      from: `"Bandhan Matrix Engine" <${smtpEmail}>`,
      to: email,
      subject: '🔒 Secure Core Node Verification Access Token',
      html: `
        <div style="font-family: sans-serif; background-color: #020617; color: #f8fafc; padding: 32px; border-radius: 16px; max-width: 480px; margin: 0 auto; border: 1px solid #1e293b;">
          <h2 style="color: #fb7185; margin-bottom: 4px; font-size: 24px; font-weight: 900;">Bandhan Matrix Engine</h2>
          <hr style="border: 0; border-top: 1px solid #334155; margin: 20px 0;" />
          <p style="font-size: 14px; color: #cbd5e1;">Use this secure access verification token code:</p>
          <div style="background-color: #0f172a; border: 1px solid #fb7185; padding: 16px; text-align: center; border-radius: 12px; margin: 24px 0;">
            <span style="font-family: monospace; font-size: 32px; font-weight: 900; color: #34d399; letter-spacing: 4px;">${generatedOtp}</span>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`📡 Security Token sent out successfully to address: ${email}`);

    return NextResponse.json({ success: true, message: 'OTP node dispatched successfully.' });

  } catch (error) {
    console.error("SMTP Transport System Intercept Failure:", error);
    return NextResponse.json({ success: false, error: error.message || 'Failed dispatching mail node.' }, { status: 500 });
  }
}