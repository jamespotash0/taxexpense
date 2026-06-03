import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter, getClientIp } from './rate-limit';

test('allows up to max attempts within the window, then blocks', () => {
  const limited = createRateLimiter({ windowMs: 1000, max: 3 });
  const now = 10_000;
  assert.equal(limited('+15551230000', now), false);
  assert.equal(limited('+15551230000', now), false);
  assert.equal(limited('+15551230000', now), false);
  assert.equal(limited('+15551230000', now), true); // 4th in the same window
});

test('resets once the window has fully elapsed', () => {
  const limited = createRateLimiter({ windowMs: 1000, max: 1 });
  assert.equal(limited('a', 0), false);
  assert.equal(limited('a', 500), true); // still inside the window
  assert.equal(limited('a', 1000), false); // window passed (now - t == windowMs, not < )
});

test('tracks keys independently', () => {
  const limited = createRateLimiter({ windowMs: 1000, max: 1 });
  assert.equal(limited('a', 0), false);
  assert.equal(limited('b', 0), false); // a different phone is unaffected
  assert.equal(limited('a', 0), true); // a is already at its limit
});

test('a blocked attempt does not extend the window', () => {
  const limited = createRateLimiter({ windowMs: 1000, max: 1 });
  assert.equal(limited('a', 0), false);
  assert.equal(limited('a', 900), true); // blocked, must not record t=900
  assert.equal(limited('a', 1000), false); // only the t=0 entry aged out → allowed again
});

test('getClientIp prefers x-forwarded-for and takes the first hop', () => {
  const req = new Request('https://x.test', {
    headers: { 'x-forwarded-for': '203.0.113.7, 70.0.0.1', 'x-real-ip': '10.0.0.1' },
  });
  assert.equal(getClientIp(req), '203.0.113.7');
});

test('getClientIp falls back to x-real-ip, then unknown', () => {
  assert.equal(getClientIp(new Request('https://x.test', { headers: { 'x-real-ip': '10.0.0.1' } })), '10.0.0.1');
  assert.equal(getClientIp(new Request('https://x.test')), 'unknown');
});
