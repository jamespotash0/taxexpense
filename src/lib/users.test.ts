import { test } from 'node:test';
import assert from 'node:assert/strict';
import { joinAnswer } from './users';

test('joinAnswer: invite consent replies', () => {
  for (const t of ['YES', 'yes!', 'Y', 'yep', 'ok.', 'Join']) assert.equal(joinAnswer(t), 'yes', t);
  for (const t of ['NO', 'no.', 'nope', 'my own']) assert.equal(joinAnswer(t), 'no', t);
  // Anything else (an expense, a question) is unclear → re-ask, never an implicit join.
  for (const t of ['$40 lunch', 'who is this?', 'yes and no', '']) assert.equal(joinAnswer(t), null, t);
});
