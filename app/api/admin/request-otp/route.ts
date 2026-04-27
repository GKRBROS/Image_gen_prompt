import { NextRequest, NextResponse } from 'next/server';
import { sendOtpToAdmin, validateAdminEmail, rateLimitAdminOtp } from '@/lib/adminAuth';
import { db } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  // Strict CORS and content-type validation
  if (req.headers.get('origin') && !process.env.ALLOWED_ADMIN_ORIGINS?.split(',').includes(req.headers.get('origin')!)) {
    return NextResponse.json({ error: 'Origin not allowed' }, { status: 400 });
  }
  if (req.headers.get('content-type') !== 'application/json') {
    return NextResponse.json({ error: 'Invalid content type' }, { status: 400 });
  }
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });

  // Rate limit per email and IP
  const rateLimitResult = await rateLimitAdminOtp(email, req);
  if (!rateLimitResult.allowed) {
    return NextResponse.json({ error: rateLimitResult.error, retryAfterSeconds: rateLimitResult.retryAfter }, { status: 429 });
  }

  // Check if email is a registered admin
  const admin = await validateAdminEmail(email);
  if (!admin) {
    return NextResponse.json({ error: 'Email is not a registered admin' }, { status: 403 });
  }

  // Send OTP
  const otpResult = await sendOtpToAdmin(email);
  if (!otpResult.success) {
    return NextResponse.json({ error: 'Failed to send OTP' }, { status: 500 });
  }

  return NextResponse.json({ success: true, email, expiresAt: otpResult.expiresAt, expiresInMinutes: otpResult.expiresInMinutes, emailSent: true });
}
