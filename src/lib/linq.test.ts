import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifyLinqSignature, parseLinqInbound, parseLinqEdit, sendLinq } from './linq';

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
      id: 'msg-1',
      chat: { id: 'chat-1' },
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
    linq: { messageId: 'msg-1', chatId: 'chat-1' },
  });

  assert.equal(parseLinqInbound({ event_type: 'message.delivered', data: { direction: 'outbound' } }), null);
  assert.equal(parseLinqInbound({ event_type: 'message.received', data: { direction: 'outbound' } }), null);
});

test('parseLinqEdit: inbound message.edited → new text + ids; ignores our own edits', () => {
  const ev = {
    event_type: 'message.edited',
    data: {
      id: 'msg-1',
      chat: { id: 'chat-1' },
      direction: 'inbound',
      sender_handle: { handle: '+14155551234' },
      part: { index: 0, text: ' $54 lunch with Sam ' },
    },
  };
  assert.deepEqual(parseLinqEdit(ev), { from: '+14155551234', messageId: 'msg-1', chatId: 'chat-1', text: '$54 lunch with Sam' });
  assert.equal(parseLinqEdit({ ...ev, data: { ...ev.data, direction: 'outbound' } }), null);
  assert.equal(parseLinqEdit({ ...ev, event_type: 'message.received' }), null);
});

test('sendLinq: extras rejected → retries once as plain text so the reply still lands', async () => {
  process.env.LINQ_API_KEY = 'test';
  const bodies: Record<string, unknown>[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    bodies.push(JSON.parse(String(init.body)));
    return bodies.length === 1
      ? new Response('{}', { status: 403 })
      : new Response(JSON.stringify({ message: { id: 'out-1' } }), { status: 202 });
  }) as typeof fetch;
  try {
    const id = await sendLinq('+14155551234', 'hi', { chatId: 'chat-1', replyTo: 'msg-1', effect: 'confetti' });
    assert.equal(id, 'out-1');
    assert.equal(bodies.length, 2);
    const first = bodies[0].message as Record<string, unknown>;
    assert.deepEqual(first.reply_to, { message_id: 'msg-1' });
    assert.deepEqual(first.effect, { type: 'screen', name: 'confetti' });
    const retry = bodies[1].message as Record<string, unknown>;
    assert.equal(retry.reply_to, undefined);
    assert.equal(retry.effect, undefined);
  } finally {
    globalThis.fetch = realFetch;
  }
});
