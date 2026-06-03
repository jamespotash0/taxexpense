// PATCH /api/settings — update profile collected at the dashboard (DEC-014):
// email, organization name, accountant email, display name.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser, parseBody } from '@/lib/api';
import { updateUser } from '@/lib/users';
import { getSupabaseAdmin } from '@/lib/supabase';

const Body = z
  .object({
    full_name: z.string().max(120).nullable(),
    email: z.string().email().nullable(),
    accountant_email: z.string().email().nullable(),
    organization_name: z.string().max(255).nullable(),
  })
  .partial();

export async function PATCH(req: Request): Promise<NextResponse> {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const body = await parseBody(req, Body);
  if (body instanceof NextResponse) return body;
  const { organization_name, ...userFields } = body;

  if (Object.keys(userFields).length > 0) await updateUser(user.id, userFields);
  if (organization_name !== undefined) {
    await getSupabaseAdmin().from('organizations').update({ name: organization_name }).eq('id', user.organization_id);
  }
  return NextResponse.json({ ok: true });
}
