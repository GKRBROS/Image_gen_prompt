import { NextRequest, NextResponse } from 'next/server';

import { apiJson, handleCorsPreflight, rejectIfOriginNotAllowed } from '@/lib/apiSecurity';
import { rateLimitAdminOtp, sendOtpToAdmin, validateAdminPhone } from '@/lib/adminAuth';
import { normalizePhone } from '@/lib/generationFlow';
import { parseStrictJson } from '@/lib/requestValidation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request);
}

export async function POST(request: NextRequest) {
  // Unified CORS guard (uses shared allowlist, not a separate env var)
  const blockedOriginResponse = rejectIfOriginNotAllowed(request);
  if (blockedOriginResponse) return blockedOriginResponse;

  // Strict content-type enforcement
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.startsWith('application/json')) {
    return apiJson(request, { error: 'Invalid content type' }, { status: 400 });
  }

  try {
    // Strict JSON parsing — rejects non-JSON, oversized, or malformed bodies
    const body = await parseStrictJson(request);

    const rawPhone = typeof body?.phone === 'string' ? body.phone : '';
    if (!rawPhone) {
      return apiJson(request, { error: 'Phone number is required' }, { status: 400 });
    }

    // Rate limit per IP (shared enforceRateLimit)
    const rateLimit = rateLimitAdminOtp(request);
    if (rateLimit.limited) {
      return apiJson(
        request,
        { error: 'Too many OTP requests. Please try again shortly.', retryAfterSeconds: rateLimit.retryAfterSeconds },
        { status: 429, headers: rateLimit.headers }
      );
    }

    const phone = normalizePhone(rawPhone);

    // Verify this phone is a registered admin — return identical error to avoid enumeration
    const admin = await validateAdminPhone(phone);
    if (!admin) {
      // Deliberately vague to prevent phone enumeration
      return apiJson(request, { error: 'Phone number is not a registered admin' }, { status: 403 });
    }

    // Generate OTP, hash, store, send via SNS
    const result = await sendOtpToAdmin(phone);

    return apiJson(request, {
      success: true,
      phone,
      expiresAt: result.expiresAt,
      expiresInMinutes: result.expiresInMinutes,
      smsSent: true,
    });
  } catch (error: any) {
    console.error('Admin request-otp unexpected error:', error);
    return apiJson(request, { error: 'Unable to process OTP request' }, { status: 500 });
  }
}
