// LLM cost tracking (DEC-097): recording is a no-op outside a unit of work, and a failed flush
// (no DB here) never breaks or changes the handler's result.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withUsage, setUsageOwner, recordUsage } from './llm-usage';

test('recordUsage outside a unit is a no-op', () => {
  assert.doesNotThrow(() => recordUsage('claude-haiku-5-5', { input_tokens: 10, output_tokens: 5 }));
});

test('withUsage returns the result even when the flush fails', async () => {
  const out = await withUsage(async () => {
    setUsageOwner('org-1', 'user-1');
    recordUsage('claude-haiku-5-5', { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 1000 });
    return 'reply';
  });
  assert.equal(out, 'reply');
});

test('withUsage rethrows the handler error', async () => {
  await assert.rejects(withUsage(async () => { throw new Error('boom'); }), /boom/);
});
