// Pure decision logic for the proactive trial-reminder cron (DEC-061). No DB/API.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trialReminderDue, type TrialReminderRow } from './subscription';

const NOW = new Date('2026-06-10T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const at = (msFromNow: number) => new Date(NOW.getTime() + msFromNow).toISOString();

function org(over: Partial<TrialReminderRow>): TrialReminderRow {
  return {
    id: 'o1',
    owner_user_id: 'u1',
    trial_ends_at: at(10 * DAY),
    subscription_status: 'trialing',
    trial_ended_reminder_at: null,
    ...over,
  };
}

test('well inside the trial → no notice', () => {
  assert.equal(trialReminderDue(org({ trial_ends_at: at(10 * DAY) }), NOW), null);
});

test('no pre-expiry nudge: still inside the trial → no notice (DEC-079)', () => {
  // What used to fire an "ending soon" nudge now stays silent until the trial actually lapses.
  assert.equal(trialReminderDue(org({ trial_ends_at: at(2 * DAY) }), NOW), null);
  assert.equal(trialReminderDue(org({ trial_ends_at: at(1000) }), NOW), null);
});

test('just past expiry → "ended"', () => {
  assert.equal(trialReminderDue(org({ trial_ends_at: at(-1 * DAY) }), NOW), 'ended');
  assert.equal(trialReminderDue(org({ trial_ends_at: at(-1000) }), NOW), 'ended');
});

test('idempotent: a stamped "ended" notice is not re-sent', () => {
  assert.equal(trialReminderDue(org({ trial_ends_at: at(-2 * DAY), trial_ended_reminder_at: at(-DAY) }), NOW), null);
});

test('non-trialing orgs never get a notice', () => {
  for (const subscription_status of ['active', 'canceled', 'past_due', null] as const) {
    assert.equal(trialReminderDue(org({ subscription_status, trial_ends_at: at(-DAY) }), NOW), null);
  }
});

test('no trial_ends_at → no reminder', () => {
  assert.equal(trialReminderDue(org({ trial_ends_at: null }), NOW), null);
});
