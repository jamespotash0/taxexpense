// GET /api/test-claude — TSNAP-010 connectivity check for the Anthropic API.
// Dev-only: returns 404 in production (must be disabled before launch).
// Verifies both models are reachable with a trivial prompt.
import { NextResponse } from 'next/server';
import { getClaude, HAIKU_MODEL, SONNET_MODEL } from '@/lib/claude';
import { log } from '@/lib/log';

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  try {
    const claude = getClaude();
    const ping = (model: string) =>
      claude.messages.create({
        model,
        max_tokens: 16,
        messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
      });

    const [haiku, sonnet] = await Promise.all([ping(HAIKU_MODEL), ping(SONNET_MODEL)]);
    const text = (m: Awaited<ReturnType<typeof ping>>) =>
      m.content.map((b) => ('text' in b ? b.text : '')).join('').trim();

    return NextResponse.json({
      ok: true,
      haiku: { model: HAIKU_MODEL, reply: text(haiku) },
      sonnet: { model: SONNET_MODEL, reply: text(sonnet) },
    });
  } catch (err) {
    log.error('test_claude_failed', { message: err instanceof Error ? err.message : 'unknown' });
    return NextResponse.json({ ok: false, error: 'claude_call_failed' }, { status: 500 });
  }
}
