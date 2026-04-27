import { NextRequest } from 'next/server';
import { db } from '@/lib/supabase';
import { requireAdminAuth } from '@/lib/adminAuth';
import { apiJson, handleCorsPreflight, rejectIfOriginNotAllowed } from '@/lib/apiSecurity';

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request);
}

export async function GET(req: NextRequest) {
  const originError = rejectIfOriginNotAllowed(req);
  if (originError) return originError;

  const admin = await requireAdminAuth(req);
  if (!admin) {
    return apiJson(req, { error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await db
    .from('admin_users')
    .select('id, phone, name, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch administrators:', error);
    return apiJson(req, { error: 'Failed to fetch administrators' }, { status: 500 });
  }

  return apiJson(req, data);
}
