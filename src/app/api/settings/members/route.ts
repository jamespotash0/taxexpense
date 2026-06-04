// POST /api/settings/members — invite a co-owner to the org by phone (DEC-045). Owner-only.
// Net-new phones only; a number that already has any Tally account is refused (409).
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser, parseBody, jsonError, serverError } from '@/lib/api';
import { getOrgOwnerId, inviteToOrg } from '@/lib/users';
import { getOrgEntitlement } from '@/lib/subscription';
import { normalizeToE164 } from '@/lib/phone';

const Body = z.object({ phone: z.string().min(7).max(25) });

export async function POST(req: Request): Promise<NextResponse> {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  // Only the org owner can add co-owners (editors can't invite — that boundary also holds
  // when teams arrive).
  const ownerId = await getOrgOwnerId(user.organization_id);
  if (ownerId !== user.id) return jsonError('forbidden', 403);

  // Paywall (DEC-046): can't add a co-owner unless the org is paid/in-trial. A new seat must
  // not slip in while billing is lapsed. (The text side is already gated — an unentitled org's
  // inbound hits the paywall in sms-handler before onboarding.)
  const entitlement = await getOrgEntitlement(user.organization_id);
  if (!entitlement.entitled) return jsonError('not_entitled', 402);

  const body = await parseBody(req, Body);
  if (body instanceof NextResponse) return body;

  const phone = normalizeToE164(body.phone);
  if (!phone) return jsonError('invalid_phone', 400);
  if (phone === user.phone_number) return jsonError('cannot_invite_self', 400);

  try {
    const result = await inviteToOrg(user.organization_id, phone, {
      business_type: user.business_type,
      entity_type: user.entity_type,
      default_payment_account: user.default_payment_account,
    });
    if (!result.ok) return jsonError(result.reason, 409);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError('invite_failed', err, { user: user.id });
  }
}
