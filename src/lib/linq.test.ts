import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifyLinqSignature, parseLinqInbound, parseLinqEdit, sendLinq, addLinqContact } from './linq';

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

test('sendLinq: unknown recipient (2008) → adds the contact, then retries the send once', async () => {
  process.env.LINQ_API_KEY = 'test';
  process.env.LINQ_ORG_ID = 'org-1';
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)) });
    if (calls.length === 1)
      return new Response(JSON.stringify({ error: { code: 2008, message: 'Recipient not allowed' } }), { status: 403 });
    if (url.includes('/cli/contacts/add')) return new Response('{"contactPhone":"+14155551234"}', { status: 200 });
    return new Response(JSON.stringify({ message: { id: 'out-2' } }), { status: 202 });
  }) as typeof fetch;
  try {
    assert.equal(await sendLinq('+14155551234', 'hi'), 'out-2');
    assert.equal(calls.length, 3);
    assert.match(calls[1].url, /\/cli\/contacts\/add$/);
    assert.deepEqual(calls[1].body, { orgId: 'org-1', contactPhone: '+14155551234' });
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('sendLinq: other 403s (e.g. 2024 opted out) do not add a contact', async () => {
  process.env.LINQ_API_KEY = 'test';
  process.env.LINQ_ORG_ID = 'org-1';
  const urls: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string) => {
    urls.push(url);
    return new Response(JSON.stringify({ error: { code: 2024 } }), { status: 403 });
  }) as typeof fetch;
  try {
    await assert.rejects(sendLinq('+14155551234', 'hi'), /linq_send_failed_403/);
    assert.equal(urls.length, 1);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('addLinqContact: already on the list (409) counts as success; no org id skips the call', async () => {
  process.env.LINQ_API_KEY = 'test';
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return new Response('{}', { status: 409 });
  }) as typeof fetch;
  try {
    process.env.LINQ_ORG_ID = 'org-1';
    assert.equal(await addLinqContact('+14155551234'), true);
    delete process.env.LINQ_ORG_ID;
    assert.equal(await addLinqContact('+14155551234'), false);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = realFetch;
  }
});
