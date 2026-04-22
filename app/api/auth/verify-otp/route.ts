import { NextRequest, NextResponse } from 'next/server';

import { apiJson, handleCorsPreflight, rejectIfOriginNotAllowed } from '@/lib/apiSecurity';
import { hashOtp, IMAGE_GENERATION_TABLE, isOtpExpired, normalizeEmail } from '@/lib/generationFlow';
import { RATE_LIMITS, enforceRateLimit } from '@/lib/rateLimit';
import { parseStrictJson, validateVerifyOtpInput } from '@/lib/requestValidation';
import { getSupabaseClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request);
}

export async function POST(request: NextRequest) {
  const blockedOriginResponse = rejectIfOriginNotAllowed(request);
  if (blockedOriginResponse) return blockedOriginResponse;

  try {
    const body = await parseStrictJson(request);

    const prevalidatedEmail = typeof body?.email === 'string' ? body.email : '';
    const rateLimit = enforceRateLimit(request, {
      endpointKey: 'verifyOtp',
      limits: RATE_LIMITS.verifyOtp,
      userIdentifier: prevalidatedEmail,
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

    const email = normalizeEmail(validated.data.email);
    const otp = validated.data.otp;
    const supabase = getSupabaseClient();

    const { data: requestRow, error: selectError } = await supabase
      .from(IMAGE_GENERATION_TABLE)
      .select('id, otp_code_hash, otp_expires_at, is_verified, verification_attempts')
      .eq('email', email)
      .maybeSingle();

    if (selectError) {
      console.error('OTP verify select error:', selectError);
      return apiJson(request, { error: 'Unable to verify OTP' }, { status: 500 });
    }

    if (!requestRow) {
      return apiJson(request, { error: 'No OTP request found for this email' }, { status: 404 });
    }

    if (requestRow.is_verified) {
      return apiJson(request, { success: true, verified: true, requestId: requestRow.id });
    }

    if (isOtpExpired(requestRow.otp_expires_at)) {
      return apiJson(request, { error: 'Verification code expired. Request a new code.' }, { status: 400 });
    }

    const expectedHash = hashOtp(email, otp);
    if (expectedHash !== requestRow.otp_code_hash) {
      await supabase
        .from(IMAGE_GENERATION_TABLE)
        .update({ verification_attempts: (requestRow.verification_attempts ?? 0) + 1 })
        .eq('id', requestRow.id);

      return apiJson(request, { error: 'Incorrect verification code' }, { status: 400 });
    }

    const { error: updateError } = await supabase
      .from(IMAGE_GENERATION_TABLE)
      .update({
        is_verified: true,
        otp_verified_at: new Date().toISOString(),
        otp_code_hash: null,
        otp_expires_at: null,
        generation_status: 'email_verified',
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
    return apiJson(
      request,
      { error: 'Unable to verify OTP' },
      { status: 500 }
    );
  }
}
