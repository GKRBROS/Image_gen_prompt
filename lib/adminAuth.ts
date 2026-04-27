import { db } from './supabase';
import { randomBytes, timingSafeEqual } from 'crypto';

export async function validateAdminEmail(email: string) {
  const { data } = await db.from('admin_users').select('*').eq('email', email).single();
  return data;
}

const OTP_SECRET = process.env.OTP_SECRET || 'dev-secret-admin';

export function hashAdminOtp(email: string, otp: string) {
  return Buffer.from(email + ':' + otp + ':' + OTP_SECRET).toString('base64');
}

export async function sendOtpToAdmin(email: string) {
  // Generate OTP and store hash in admin_otps table
  const otp = (Math.floor(100000 + Math.random() * 900000)).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const otpHash = hashAdminOtp(email, otp);
  
  await db.from('admin_otps').upsert({ 
    email, 
    otp_code_hash: otpHash, 
    otp_expires_at: expiresAt.toISOString(),
    verification_attempts: 0 
  });

  // Log OTP for development if no email service is configured
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[DEV] Admin OTP for ${email}: ${otp}`);
  }

  // TODO: Send OTP via email (reuse user flow)
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

export async function verifyAdminOtp(email: string, otp: string) {
  const { data, error } = await db
    .from('admin_otps')
    .select('*')
    .eq('email', email)
    .single();

  if (error || !data) {
    return { success: false, error: 'No OTP request found', status: 404 };
  }

  if (new Date(data.otp_expires_at) < new Date()) {
    return { success: false, error: 'OTP expired', status: 400 };
  }

  if (data.verification_attempts >= 5) {
    return { success: false, error: 'Too many attempts', status: 429 };
  }

  const expectedHash = hashAdminOtp(email, otp);
  if (data.otp_code_hash !== expectedHash) {
    await db
      .from('admin_otps')
      .update({ verification_attempts: (data.verification_attempts || 0) + 1 })
      .eq('email', email);
    return { success: false, error: 'Invalid OTP', status: 400 };
  }

  // Success - clear OTP and return admin info
  await db.from('admin_otps').delete().eq('email', email);
  
  const admin = await validateAdminEmail(email);
  
  return { success: true, admin };
}

