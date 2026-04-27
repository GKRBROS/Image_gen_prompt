import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { requireAdminAuth, rateLimitAdminRegister } from '@/lib/adminAuth';

export async function POST(req: NextRequest) {
  // Strict CORS and content-type validation
  if (req.headers.get('origin') && !process.env.ALLOWED_ADMIN_ORIGINS?.split(',').includes(req.headers.get('origin')!)) {
    return NextResponse.json({ error: 'Origin not allowed' }, { status: 400 });
  }
  if (req.headers.get('content-type') !== 'application/json') {
    return NextResponse.json({ error: 'Invalid content type' }, { status: 400 });
  }
  const { email, name } = await req.json();
  if (!email || !name) return NextResponse.json({ error: 'Email and name are required' }, { status: 400 });

  // Rate limit per IP
  const rateLimitResult = await rateLimitAdminRegister(req);
  if (!rateLimitResult.allowed) {
    return NextResponse.json({ error: rateLimitResult.error, retryAfterSeconds: rateLimitResult.retryAfter }, { status: 429 });
  }

  // Require admin authentication (e.g., JWT/session)
  const admin = await requireAdminAuth(req);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Insert new admin
  const { error } = await db.from('admin_users').insert([{ email, name }]);
  if (error) {
    return NextResponse.json({ error: 'Failed to register admin (may already exist)' }, { status: 409 });
  }

  return NextResponse.json({ success: true, email, name });
}
