// PATCH /api/settings — update profile collected at the dashboard (DEC-014):
// email, organization name, accountant email, display name, and work type (DEC-081).
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser, parseBody } from '@/lib/api';
import { updateUser, type AppUser } from '@/lib/users';
import { getSupabaseAdmin } from '@/lib/supabase';

const Body = z
  .object({
    full_name: z.string().max(120).nullable(),
    email: z.string().email().nullable(),
    accountant_email: z.string().email().nullable(),
    organization_name: z.string().max(255).nullable(),
    // Work type drives the profession-aware categorization profile (Spec 09 / DEC-081).
    business_type: z.string().max(100).nullable(),
  })
  .partial();

export async function PATCH(req: Request): Promise<NextResponse> {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const body = await parseBody(req, Body);
  if (body instanceof NextResponse) return body;
  const { organization_name, ...userFields } = body;

  // When the user edits their work type, drop the derived business_profile so it regenerates from
  // the new description on the next logged expense (ensureBusinessProfile, DEC-081). A no-op edit
  // (same value) leaves the existing profile intact, so we don't pay a needless regeneration.
  const patch: Partial<AppUser> = { ...userFields };
  if (userFields.business_type !== undefined && userFields.business_type !== user.business_type) {
    patch.business_profile = null;
  }

  if (Object.keys(patch).length > 0) await updateUser(user.id, patch);
  if (organization_name !== undefined) {
    await getSupabaseAdmin().from('organizations').update({ name: organization_name }).eq('id', user.organization_id);
  }
  return NextResponse.json({ ok: true });
}
