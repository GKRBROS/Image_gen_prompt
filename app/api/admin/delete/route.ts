import { NextRequest } from 'next/server';
import { db } from '@/lib/supabase';
import { requireAdminAuth } from '@/lib/adminAuth';
import { apiJson, handleCorsPreflight, rejectIfOriginNotAllowed } from '@/lib/apiSecurity';

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request);
}

export async function DELETE(req: NextRequest) {
  const originError = rejectIfOriginNotAllowed(req);
  if (originError) return originError;

  if (!req.headers.get('content-type')?.startsWith('application/json')) {
    return apiJson(req, { error: 'Invalid content type' }, { status: 400 });
  }

  const { phone } = await req.json();
  if (!phone) return apiJson(req, { error: 'Admin phone is required' }, { status: 400 });

  const admin = await requireAdminAuth(req);
  if (!admin) {
    return apiJson(req, { error: 'Unauthorized' }, { status: 401 });
  }

  // Prevent deleting the last administrator
  const { count } = await db.from('admin_users').select('*', { count: 'exact', head: true });
  if (count !== null && count <= 1) {
    return apiJson(req, { error: 'Cannot delete the only remaining administrator' }, { status: 403 });
  }

  const { error } = await db.from('admin_users').delete().eq('phone', phone);

  if (error) {
    console.error('Failed to remove administrator:', error);
    return apiJson(req, { error: 'Failed to remove administrator' }, { status: 500 });
  }

  return apiJson(req, { success: true, phone });
}
