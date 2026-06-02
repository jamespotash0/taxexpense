// PATCH /api/settings — update profile collected at the dashboard (DEC-014):
// email, organization name, accountant email, display name.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/session';
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
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  const { organization_name, ...userFields } = parsed.data;

  if (Object.keys(userFields).length > 0) await updateUser(user.id, userFields);
  if (organization_name !== undefined) {
    await getSupabaseAdmin().from('organizations').update({ name: organization_name }).eq('id', user.organization_id);
  }
  return NextResponse.json({ ok: true });
}
