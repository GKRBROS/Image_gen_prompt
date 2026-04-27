import { NextRequest } from 'next/server';

import { apiJson, handleCorsPreflight, rejectIfOriginNotAllowed } from '@/lib/apiSecurity';
import { verifyAdminOtp } from '@/lib/adminAuth';
import { normalizePhone } from '@/lib/generationFlow';
import { RATE_LIMITS, enforceRateLimit } from '@/lib/rateLimit';
import { parseStrictJson } from '@/lib/requestValidation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request);
}

export async function POST(request: NextRequest) {
  const blockedOriginResponse = rejectIfOriginNotAllowed(request);
  if (blockedOriginResponse) return blockedOriginResponse;

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.startsWith('application/json')) {
    return apiJson(request, { error: 'Invalid content type' }, { status: 400 });
  }

  try {
    const body = await parseStrictJson(request);

    const rawPhone = typeof body?.phone === 'string' ? body.phone : '';
    const rawOtp = typeof body?.otp === 'string' ? body.otp : '';

    if (!rawPhone || !rawOtp) {
      return apiJson(request, { error: 'Phone number and verification code are required' }, { status: 400 });
    }

    // Rate limit per IP on verify endpoint
    const rateLimit = enforceRateLimit(request, {
      endpointKey: 'adminVerifyOtp',
      limits: RATE_LIMITS.verifyOtp,
    });
    if (rateLimit.limited) {
      return apiJson(
        request,
        { error: 'Too many verification attempts. Please wait and try again.', retryAfterSeconds: rateLimit.retryAfterSeconds },
        { status: 429, headers: rateLimit.headers }
      );
    }

    // Validate OTP format before hitting the DB
    if (!/^\d{6}$/.test(rawOtp.trim())) {
      return apiJson(request, { error: 'Enter the 6-digit verification code' }, { status: 400 });
    }

    const phone = normalizePhone(rawPhone);
    const otp = rawOtp.trim();

    // Fully encapsulated secure verification (timing-safe, brute-force protected)
    const result = await verifyAdminOtp(phone, otp);

    if (!result.success) {
      return apiJson(request, { error: result.error }, { status: result.status });
    }

    return apiJson(request, {
      success: true,
      verified: true,
      admin: result.admin,
    });
  } catch (error: any) {
    console.error('Admin verify-otp unexpected error:', error);
    return apiJson(request, { error: 'Unable to verify OTP' }, { status: 500 });
  }
}
