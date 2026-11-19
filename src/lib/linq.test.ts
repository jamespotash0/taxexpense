import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifyLinqSignature, parseLinqInbound } from './linq';

const keyBytes = Buffer.from('test-signing-key-bytes');
process.env.LINQ_WEBHOOK_SECRET = `whsec_${keyBytes.toString('base64')}`;

function sign(id: string, ts: string, body: string): string {
  return 'v1,' + createHmac('sha256', keyBytes).update(`${id}.${ts}.${body}`).digest('base64');
}

test('verifyLinqSignature: accepts valid, rejects tampered / stale / missing', () => {
  const now = 1_800_000_000_000;
  const ts = String(now / 1000);
  const body = '{"event_type":"message.received"}';
  const sig = sign('msg_1', ts, body);

  assert.equal(verifyLinqSignature('msg_1', ts, sig, body, now), true);
  // Multiple space-separated signatures (secret rotation): any match passes.
  assert.equal(verifyLinqSignature('msg_1', ts, `v1,bm9wZQ== ${sig}`, body, now), true);
  assert.equal(verifyLinqSignature('msg_1', ts, sig, body + ' ', now), false);
  assert.equal(verifyLinqSignature('msg_2', ts, sig, body, now), false);
  assert.equal(verifyLinqSignature('msg_1', ts, sig, body, now + 301_000), false);
  assert.equal(verifyLinqSignature('msg_1', ts, null, body, now), false);
});

test('parseLinqInbound: text + media from message.received; ignores other events', () => {
  const msg = parseLinqInbound({
    event_type: 'message.received',
    data: {
      direction: 'inbound',
      sender_handle: { handle: '+14155551234' },
      parts: [
        { type: 'text', value: '$42 lunch with Sam' },
        { type: 'media', url: 'https://cdn.linqapp.com/attachments/a.jpg' },
      ],
    },
  });
  assert.deepEqual(msg, {
    from: '+14155551234',
    body: '$42 lunch with Sam',
    numMedia: 1,
    mediaUrls: ['https://cdn.linqapp.com/attachments/a.jpg'],
    channel: 'sms',
  });

  assert.equal(parseLinqInbound({ event_type: 'message.delivered', data: { direction: 'outbound' } }), null);
  assert.equal(parseLinqInbound({ event_type: 'message.received', data: { direction: 'outbound' } }), null);
});
