import 'server-only';

import crypto, { timingSafeEqual } from 'crypto';

import { db } from './supabase';
import { generateOtp, hashOtp, isOtpExpired, normalizePhone } from './generationFlow';
import { sendOtpSms } from './snsSms';
import { enforceRateLimit, RATE_LIMITS } from './rateLimit';

// ─── Admin Validation ────────────────────────────────────────────────────────

export async function validateAdminPhone(phone: string) {
  const normalizedPhone = normalizePhone(phone);
  const { data } = await db
    .from('admin_users')
    .select('id, phone, name')
    .eq('phone', normalizedPhone)
    .maybeSingle();
  return data;
}

// ─── Send OTP to Admin (cryptographically secure) ────────────────────────────

export async function sendOtpToAdmin(phone: string) {
  const normalizedPhone = normalizePhone(phone);

  // Use the same cryptographically secure OTP generator as the user flow
  const otp = generateOtp();

  // Use proper HMAC-SHA256 hashing (not base64 encoding)
  const otpCodeHash = hashOtp(normalizedPhone, otp);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  const { error: upsertError } = await db.from('admin_otps').upsert(
    {
      phone: normalizedPhone,
      otp_code_hash: otpCodeHash,
      otp_expires_at: expiresAt.toISOString(),
      is_verified: false,
      verification_attempts: 0,
      otp_verified_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'phone' }
  );

  if (upsertError) {
    console.error('Admin OTP upsert error:', upsertError);
    throw new Error('Failed to store OTP');
  }

  try {
    await sendOtpSms({ to: normalizedPhone, otp });
  } catch (smsError) {
    console.error('Failed to send admin OTP SMS:', smsError);
    // Roll back OTP so it cannot be used
    await db.from('admin_otps').update({ otp_code_hash: null, otp_expires_at: null }).eq('phone', normalizedPhone);
    throw new Error('Failed to send OTP SMS');
  }

  return { success: true, expiresAt, expiresInMinutes: 10 };
}

// ─── Verify Admin OTP (timing-safe) ──────────────────────────────────────────

export async function verifyAdminOtp(phone: string, otp: string): Promise<
  | { success: true; admin: { phone: string; name: string } }
  | { success: false; error: string; status: number }
> {
  const normalizedPhone = normalizePhone(phone);

  // 1. Check admin exists
  const admin = await validateAdminPhone(normalizedPhone);
  if (!admin) {
    return { success: false, error: 'Access denied', status: 403 };
  }

  // 2. Fetch OTP row
  const { data: otpRow, error: selectError } = await db
    .from('admin_otps')
    .select('id, otp_code_hash, otp_expires_at, is_verified, verification_attempts')
    .eq('phone', normalizedPhone)
    .maybeSingle();

  if (selectError) {
    console.error('Admin OTP fetch error:', selectError);
    return { success: false, error: 'Unable to verify OTP', status: 500 };
  }

  if (!otpRow) {
    return { success: false, error: 'No verification request found for this phone number', status: 404 };
  }

  // 3. Block if too many attempts (brute-force protection)
  const MAX_ATTEMPTS = 5;
  if ((otpRow.verification_attempts ?? 0) >= MAX_ATTEMPTS) {
    return { success: false, error: 'Too many incorrect attempts. Please request a new OTP.', status: 429 };
  }

  // 4. Check expiry
  if (isOtpExpired(otpRow.otp_expires_at)) {
    return { success: false, error: 'Verification code expired. Please request a new one.', status: 400 };
  }

  // 5. Timing-safe hash comparison
  const expectedHash = hashOtp(normalizedPhone, otp);
  const storedHash = otpRow.otp_code_hash ?? '';

  let hashesMatch = false;
  try {
    hashesMatch = timingSafeEqual(Buffer.from(expectedHash, 'hex'), Buffer.from(storedHash, 'hex'));
  } catch {
    hashesMatch = false;
  }

  if (!hashesMatch) {
    await db
      .from('admin_otps')
      .update({ verification_attempts: (otpRow.verification_attempts ?? 0) + 1 })
      .eq('id', otpRow.id);
    return { success: false, error: 'Incorrect verification code', status: 400 };
  }

  // 6. Mark as verified and clear OTP hash immediately
  const { error: updateError } = await db
    .from('admin_otps')
    .update({
      is_verified: true,
      otp_verified_at: new Date().toISOString(),
      otp_code_hash: null,  // Destroy OTP after single use
      otp_expires_at: null,
      verification_attempts: 0,
    })
    .eq('id', otpRow.id);

  if (updateError) {
    console.error('Admin OTP update error:', updateError);
    return { success: false, error: 'Failed to complete verification', status: 500 };
  }

  return { success: true, admin: { phone: admin.phone, name: admin.name } };
}

// ─── Rate Limiting (delegated to shared enforceRateLimit) ────────────────────

export function rateLimitAdminOtp(req: Request) {
  return enforceRateLimit(req as any, {
    endpointKey: 'adminRequestOtp',
    limits: RATE_LIMITS.requestOtp,
  });
}

export function rateLimitAdminRegister(req: Request) {
  return enforceRateLimit(req as any, {
    endpointKey: 'adminRegister',
    limits: RATE_LIMITS.requestOtp,
  });
}

// ─── Placeholder: replace with real session/JWT check ────────────────────────

export async function requireAdminAuth(_req: Request): Promise<boolean> {
  // TODO: implement JWT or session-based admin authentication
  return true;
}
