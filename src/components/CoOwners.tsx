'use client';

// Co-owner management on the settings screen (DEC-045). Owner-only: lists who's on the org
// and invites a new co-owner by phone. The invitee joins by texting Tally — no outbound from
// here (TCPA: we can't text someone who hasn't opted in).
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatUsPhone } from '@/lib/phone';
import { useFormSubmit } from '@/lib/use-form-submit';

export interface CoOwnersCopy {
  heading: string;
  body: string;
  placeholder: string;
  add: string;
  adding: string;
  you: string;
  owner: string;
  coowner: string;
  pending: string;
  active: string;
  hint: string;
  locked: string;
  subscribe: string;
  full: string;
  errAlready: string;
  errOther: string;
  errPhone: string;
  errSelf: string;
  errNotEntitled: string;
  errSeatLimit: string;
  errGeneric: string;
}

export interface Member {
  id: string;
  phone_number: string;
  full_name: string | null;
  role: 'owner' | 'editor';
  status: 'active' | 'pending';
}

export function CoOwners({
  t,
  members,
  currentUserId,
  entitled,
  atCap,
}: {
  t: CoOwnersCopy;
  members: Member[];
  currentUserId: string;
  entitled: boolean;
  atCap: boolean;
}) {
  const router = useRouter();
  const { busy, error, submit } = useFormSubmit();
  const [phone, setPhone] = useState('');

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const errors: Record<string, string> = {
      already_member: t.errAlready,
      has_other_account: t.errOther,
      invalid_phone: t.errPhone,
      cannot_invite_self: t.errSelf,
      not_entitled: t.errNotEntitled,
      seat_limit: t.errSeatLimit,
    };
    const { ok } = await submit<{ error?: string }>('/api/settings/members', {
      body: { phone },
      errorMessage: t.errGeneric,
      mapError: (data) => (data?.error ? errors[data.error] : undefined),
    });
    if (ok) {
      setPhone('');
      router.refresh();
    }
  }

  return (
    <div>
      <h2 className="text-lg font-bold tracking-[-0.02em]">{t.heading}</h2>
      <p className="mb-4 mt-1 text-[0.9375rem] text-muted">{t.body}</p>

      <ul className="mb-4 space-y-2">
        {members.map((m) => (
          <li key={m.id} className="flex min-h-12 items-center justify-between rounded-2xl bg-fill px-4 py-2.5 text-sm">
            <span className="min-w-0">
              <span className="font-semibold">{m.full_name || formatUsPhone(m.phone_number)}</span>
              {m.id === currentUserId && <span className="text-muted"> · {t.you}</span>}
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="text-xs text-muted">{m.role === 'owner' ? t.owner : t.coowner}</span>
              {m.status === 'pending' && (
                <span className="chip chip-need h-6">{t.pending}</span>
              )}
            </span>
          </li>
        ))}
      </ul>

      {!entitled ? (
        <p className="rounded-2xl bg-fill px-4 py-3 text-sm text-muted">
          {t.locked}{' '}
          <a href="/pricing" className="font-medium text-primary hover:underline">
            {t.subscribe}
          </a>
        </p>
      ) : atCap ? (
        <p className="rounded-2xl bg-fill px-4 py-3 text-sm text-muted">{t.full}</p>
      ) : (
        <>
          <form onSubmit={add} className="flex gap-2">
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t.placeholder}
              className="field min-w-0 flex-1"
              required
            />
            <button
              type="submit"
              disabled={busy || phone.trim().length === 0}
              className="btn btn-primary shrink-0"
            >
              {busy ? t.adding : t.add}
            </button>
          </form>
          {error && <p className="mt-2 text-sm text-error-600">{error}</p>}
          <p className="mt-2 text-xs text-muted">{t.hint}</p>
        </>
      )}
    </div>
  );
}
