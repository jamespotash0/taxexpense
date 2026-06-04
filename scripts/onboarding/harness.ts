// In-memory onboarding harness (DEC-060). Drives the REAL handleOnboarding state machine against
// an injected, in-memory store — no Supabase, fully deterministic. Used by the onboarding sim
// tests (src/lib/onboarding-sim.test.ts) and the runnable simulator (scripts/onboarding/sim.ts),
// so what the tests assert is exactly what you can watch play out live.

import { handleOnboarding, type OnboardingDeps } from '../../src/lib/onboarding';
import type { AppUser } from '../../src/lib/users';

export interface SimStore {
  user: AppUser;
  orgName: string | null;
  leads: unknown[];
  deps: OnboardingDeps;
}

/** A fresh solo user at step 0 (brand new). Override any field (e.g. to simulate a co-owner). */
export function makeStore(overrides: Partial<AppUser> = {}): SimStore {
  const user = {
    id: 'sim-user',
    organization_id: 'sim-org',
    phone_number: '+15550000000',
    full_name: null,
    email: null,
    business_type: null,
    entity_type: null,
    default_payment_account: null,
    accountant_email: null,
    onboarding_completed: false,
    onboarding_step: 0,
    sms_consent_at: null,
    sms_opted_out_at: null,
    ...overrides,
  } as AppUser;

  const store: SimStore = {
    user,
    orgName: null,
    leads: [],
    deps: {
      getOrganizationName: async () => store.orgName,
      updateUser: async (_id, patch) => {
        Object.assign(store.user, patch);
      },
      updateOrganizationName: async (_orgId, name) => {
        store.orgName = name;
      },
      // Solo owner: owner is the user themselves → no co-owner "join" greeting.
      getOrgOwner: async () => ({ id: store.user.id, full_name: store.user.full_name }),
      insertLead: async (lead) => {
        store.leads.push(lead);
      },
    },
  };
  return store;
}

export interface Turn {
  user: string;
  tally: string;
}

/**
 * Feed messages one at a time and return the conversation. The FIRST message is the trigger
 * (step 0 just sends the first question); each subsequent message answers the current question.
 */
export async function converse(store: SimStore, messages: string[]): Promise<Turn[]> {
  const turns: Turn[] = [];
  for (const msg of messages) {
    if (store.user.onboarding_completed) {
      turns.push({ user: msg, tally: '[onboarding already complete — would route to capture]' });
      continue;
    }
    const tally = await handleOnboarding(store.user, msg, store.deps);
    turns.push({ user: msg, tally });
  }
  return turns;
}
