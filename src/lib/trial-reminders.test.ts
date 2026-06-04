// Pure decision logic for the proactive trial-reminder cron (DEC-061). No DB/API.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trialReminderDue, TRIAL_ENDING_SOON_DAYS, type TrialReminderRow } from './subscription';

const NOW = new Date('2026-06-10T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const at = (msFromNow: number) => new Date(NOW.getTime() + msFromNow).toISOString();

function org(over: Partial<TrialReminderRow>): TrialReminderRow {
  return {
    id: 'o1',
    owner_user_id: 'u1',
    trial_ends_at: at(10 * DAY),
    subscription_status: 'trialing',
    trial_ending_reminder_at: null,
    trial_ended_reminder_at: null,
    ...over,
  };
}

test('well inside the trial → no reminder', () => {
  assert.equal(trialReminderDue(org({ trial_ends_at: at(10 * DAY) }), NOW), null);
});

test('within the look-ahead window → "ending"', () => {
  assert.equal(trialReminderDue(org({ trial_ends_at: at(2 * DAY) }), NOW), 'ending');
  assert.equal(trialReminderDue(org({ trial_ends_at: at(TRIAL_ENDING_SOON_DAYS * DAY - 1000) }), NOW), 'ending');
});

test('just past expiry → "ended"', () => {
  assert.equal(trialReminderDue(org({ trial_ends_at: at(-1 * DAY) }), NOW), 'ended');
  assert.equal(trialReminderDue(org({ trial_ends_at: at(-1000) }), NOW), 'ended');
});

test('idempotent: a stamped reminder is not re-sent', () => {
  assert.equal(trialReminderDue(org({ trial_ends_at: at(2 * DAY), trial_ending_reminder_at: at(-DAY) }), NOW), null);
  assert.equal(trialReminderDue(org({ trial_ends_at: at(-2 * DAY), trial_ended_reminder_at: at(-DAY) }), NOW), null);
});

test('an "ending" stamp does NOT suppress the later "ended" notice', () => {
  // Sent "ending" earlier; trial has now lapsed → "ended" is still due.
  assert.equal(
    trialReminderDue(org({ trial_ends_at: at(-1 * DAY), trial_ending_reminder_at: at(-4 * DAY) }), NOW),
    'ended',
  );
});

test('non-trialing orgs never get a reminder', () => {
  for (const subscription_status of ['active', 'canceled', 'past_due', null] as const) {
    assert.equal(trialReminderDue(org({ subscription_status, trial_ends_at: at(-DAY) }), NOW), null);
  }
});

test('no trial_ends_at → no reminder', () => {
  assert.equal(trialReminderDue(org({ trial_ends_at: null }), NOW), null);
});
