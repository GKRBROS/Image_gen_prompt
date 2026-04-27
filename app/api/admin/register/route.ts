import { NextRequest, NextResponse } from 'next/server';

import { apiJson, handleCorsPreflight, rejectIfOriginNotAllowed } from '@/lib/apiSecurity';
import { requireAdminAuth, rateLimitAdminRegister } from '@/lib/adminAuth';
import { normalizePhone } from '@/lib/generationFlow';
import { parseStrictJson } from '@/lib/requestValidation';
import { db } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request);
}

export async function POST(req: NextRequest) {
  // Shared CORS guard
  const blockedOriginResponse = rejectIfOriginNotAllowed(req);
  if (blockedOriginResponse) return blockedOriginResponse;

  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.startsWith('application/json')) {
    return apiJson(req, { error: 'Invalid content type' }, { status: 400 });
  }

  try {
    const body = await parseStrictJson(req);

    const rawPhone = typeof body?.phone === 'string' ? body.phone : '';
    const rawName = typeof body?.name === 'string' ? body.name.trim() : '';

    if (!rawPhone || !rawName) {
      return apiJson(req, { error: 'Phone number and name are required' }, { status: 400 });
    }

    // Rate limit per IP (uses enforceRateLimit which returns { limited, retryAfterSeconds, headers })
    const rateLimit = rateLimitAdminRegister(req);
    if (rateLimit.limited) {
      return apiJson(
        req,
        { error: 'Too many registration requests. Please try again later.', retryAfterSeconds: rateLimit.retryAfterSeconds },
        { status: 429, headers: rateLimit.headers }
      );
    }

    // Require admin authentication
    const admin = await requireAdminAuth(req);
    if (!admin) {
      return apiJson(req, { error: 'Unauthorized' }, { status: 401 });
    }

    const phone = normalizePhone(rawPhone);

    // Insert new admin
    const { error } = await db.from('admin_users').insert([{ phone, name: rawName }]);
    if (error) {
      return apiJson(req, { error: 'Failed to register admin (may already exist)' }, { status: 409 });
    }

    return apiJson(req, { success: true, phone, name: rawName });
  } catch (error: any) {
    console.error('Admin register unexpected error:', error);
    return apiJson(req, { error: 'Unable to process registration' }, { status: 500 });
  }
}
