import { db } from './supabase';
import { randomBytes, timingSafeEqual } from 'crypto';

export async function validateAdminEmail(email: string) {
  const { data } = await db.from('admin_users').select('*').eq('email', email).single();
  return data;
}

export async function sendOtpToAdmin(email: string) {
  // Generate OTP and store hash in admin_otps table
  const otp = (Math.floor(100000 + Math.random() * 900000)).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const otpHash = Buffer.from(otp).toString('base64'); // Replace with real hash
  await db.from('admin_otps').upsert({ email, otp_code_hash: otpHash, otp_expires_at: expiresAt });
  // TODO: Send OTP via email (reuse user flow)
  return { success: true, expiresAt, expiresInMinutes: 10 };
}

export async function verifyAdminOtp(email: string, otp: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const trimmedOtp = otp.trim();

  const { data: requestRow, error: selectError } = await db
    .from('admin_otps')
    .select('id, otp_code_hash, otp_expires_at, is_verified, verification_attempts')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (selectError) {
    console.error('Admin OTP verify select error:', selectError);
    return { success: false, error: 'Unable to verify OTP', status: 500 as const };
  }

  if (!requestRow) {
    return { success: false, error: 'No OTP request found for this email', status: 404 as const };
  }

  if (requestRow.is_verified) {
    const { data: admin } = await db.from('admin_users').select('*').eq('email', normalizedEmail).maybeSingle();
    return { success: true, verified: true, admin };
  }

  if ((requestRow.verification_attempts ?? 0) >= 5) {
    return { success: false, error: 'Too many incorrect attempts. Please request a new OTP.', status: 429 as const };
  }

  if (requestRow.otp_expires_at && new Date(requestRow.otp_expires_at).getTime() < Date.now()) {
    return { success: false, error: 'Verification code expired. Request a new code.', status: 400 as const };
  }

  const expectedHash = Buffer.from(trimmedOtp).toString('base64');
  const storedHash = requestRow.otp_code_hash ?? '';

  let hashesMatch = false;
  try {
    hashesMatch = timingSafeEqual(Buffer.from(expectedHash, 'utf8'), Buffer.from(storedHash, 'utf8'));
  } catch {
    hashesMatch = false;
  }

  if (!hashesMatch) {
    await db
      .from('admin_otps')
      .update({ verification_attempts: (requestRow.verification_attempts ?? 0) + 1 })
      .eq('id', requestRow.id);

    return { success: false, error: 'Incorrect verification code', status: 400 as const };
  }

  const { error: updateError } = await db
    .from('admin_otps')
    .update({
      is_verified: true,
      otp_verified_at: new Date().toISOString(),
      otp_code_hash: null,
      otp_expires_at: null,
      verification_attempts: 0,
    })
    .eq('id', requestRow.id);

  if (updateError) {
    console.error('Admin OTP verify update error:', updateError);
    return { success: false, error: 'Unable to verify OTP', status: 500 as const };
  }

  const { data: admin, error: adminError } = await db
    .from('admin_users')
    .select('*')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (adminError) {
    console.error('Admin lookup error after OTP verify:', adminError);
    return { success: false, error: 'Unable to verify OTP', status: 500 as const };
  }

  return { success: true, verified: true, admin };
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

