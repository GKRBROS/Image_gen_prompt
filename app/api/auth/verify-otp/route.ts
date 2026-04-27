import { NextRequest } from 'next/server';
import { timingSafeEqual } from 'crypto';

import { apiJson, handleCorsPreflight, rejectIfOriginNotAllowed } from '@/lib/apiSecurity';
import { hashOtp, IMAGE_GENERATION_TABLE, isOtpExpired, normalizePhone } from '@/lib/generationFlow';
import { RATE_LIMITS, enforceRateLimit } from '@/lib/rateLimit';
import { parseStrictJson, validateVerifyOtpInput } from '@/lib/requestValidation';
import { getSupabaseClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_VERIFY_ATTEMPTS = 5;

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request);
}

export async function POST(request: NextRequest) {
  const blockedOriginResponse = rejectIfOriginNotAllowed(request);
  if (blockedOriginResponse) return blockedOriginResponse;

  try {
    const body = await parseStrictJson(request);

    const prevalidatedPhone = typeof body?.phone === 'string' ? body.phone : '';
    const rateLimit = enforceRateLimit(request, {
      endpointKey: 'verifyOtp',
      limits: RATE_LIMITS.verifyOtp,
      userIdentifier: prevalidatedPhone,
    });
    if (rateLimit.limited) {
      return apiJson(
        request,
        {
          error: 'Too many verification attempts. Please wait and try again.',
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        },
        { status: 429, headers: rateLimit.headers }
      );
    }

    const validated = validateVerifyOtpInput(body);
    if ('error' in validated) {
      return apiJson(request, { error: validated.error }, { status: 400 });
    }

    const phone = normalizePhone(validated.data.phone);
    const otp = validated.data.otp.trim();
    const supabase = getSupabaseClient();

    const { data: requestRow, error: selectError } = await supabase
      .from(IMAGE_GENERATION_TABLE)
      .select('id, otp_code_hash, otp_expires_at, is_verified, verification_attempts')
      .eq('phone', phone)
      .maybeSingle();

    if (selectError) {
      console.error('OTP verify select error:', selectError);
      return apiJson(request, { error: 'Unable to verify OTP' }, { status: 500 });
    }

    if (!requestRow) {
      return apiJson(request, { error: 'No OTP request found for this phone number' }, { status: 404 });
    }

    // Already verified — idempotent success
    if (requestRow.is_verified) {
      return apiJson(request, { success: true, verified: true, requestId: requestRow.id });
    }

    // Brute-force lockout
    if ((requestRow.verification_attempts ?? 0) >= MAX_VERIFY_ATTEMPTS) {
      return apiJson(
        request,
        { error: 'Too many incorrect attempts. Please request a new OTP.' },
        { status: 429 }
      );
    }

    // Expiry check
    if (isOtpExpired(requestRow.otp_expires_at)) {
      return apiJson(request, { error: 'Verification code expired. Request a new code.' }, { status: 400 });
    }

    // Timing-safe hash comparison
    const expectedHash = hashOtp(phone, otp);
    const storedHash = requestRow.otp_code_hash ?? '';

    let hashesMatch = false;
    try {
      hashesMatch = timingSafeEqual(
        Buffer.from(expectedHash, 'hex'),
        Buffer.from(storedHash, 'hex')
      );
    } catch {
      hashesMatch = false;
    }

    if (!hashesMatch) {
      await supabase
        .from(IMAGE_GENERATION_TABLE)
        .update({ verification_attempts: (requestRow.verification_attempts ?? 0) + 1 })
        .eq('id', requestRow.id);

      return apiJson(request, { error: 'Incorrect verification code' }, { status: 400 });
    }

    // Success — mark verified and destroy OTP hash (single-use)
    const { error: updateError } = await supabase
      .from(IMAGE_GENERATION_TABLE)
      .update({
        is_verified: true,
        otp_verified_at: new Date().toISOString(),
        otp_code_hash: null,    // Destroy after use
        otp_expires_at: null,
        generation_status: 'phone_verified',
        verification_attempts: 0,
      })
      .eq('id', requestRow.id);

    if (updateError) {
      console.error('OTP verify update error:', updateError);
      return apiJson(request, { error: 'Unable to verify OTP' }, { status: 500 });
    }

    return apiJson(request, {
      success: true,
      verified: true,
      requestId: requestRow.id,
    });
  } catch (error: any) {
    console.error('OTP verify unexpected error:', error);
    return apiJson(request, { error: 'Unable to verify OTP' }, { status: 500 });
  }
}
