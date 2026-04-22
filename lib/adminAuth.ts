import { db } from './supabase';
import { randomBytes, timingSafeEqual } from 'crypto';
import { sendOtpEmail } from './sesEmail';

export async function validateAdminEmail(email: string) {
  const { data } = await db.from('admin_users').select('*').eq('email', email).single();
  return data;
}

export async function sendOtpToAdmin(email: string) {
  const otp = (Math.floor(100000 + Math.random() * 900000)).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const otpHash = Buffer.from(otp).toString('base64');
  
  await db.from('admin_otps').upsert(
    { 
      email, 
      otp_code_hash: otpHash, 
      otp_expires_at: expiresAt,
      is_verified: false,
      verification_attempts: 0,
      otp_verified_at: null,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'email' }
  );

  try {
    await sendOtpEmail({ to: email, otp });
  } catch (mailError) {
    console.error('Failed to send admin OTP email:', mailError);
    throw new Error('Failed to send OTP email');
  }

  return { success: true, expiresAt, expiresInMinutes: 10 };
}

export async function rateLimitAdminOtp(email: string, req: any) {
  // Implement rate limiting logic (reuse user flow)
  return { allowed: true, error: null as string | null, retryAfter: null as number | null };
}

export async function rateLimitAdminRegister(req: any) {
  // Implement rate limiting logic
  return { allowed: true, error: null as string | null, retryAfter: null as number | null };
}

export async function requireAdminAuth(req: any) {
  // Implement admin authentication (JWT/session)
  return true;
}

