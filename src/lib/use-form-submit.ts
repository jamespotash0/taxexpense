'use client';

// ViewModel plumbing for client components that POST/PATCH/DELETE to an API route.
// Owns the boilerplate every form repeated by hand: `busy` flag, JSON/FormData
// encoding, response parsing, and turning a failure into a user-facing `error`.
// Success orchestration (router.refresh, redirects, multi-phase flows) stays in the
// component — that's a View concern. See src/lib/use-reduced-motion.ts for the other hook.
import { useState } from 'react';

interface SubmitInit<T> {
  /** HTTP method. Defaults to 'POST'. */
  method?: string;
  /** Request body. Plain values are JSON-encoded; a FormData is sent as-is; null/undefined sends no body. */
  body?: unknown;
  /** Fallback message when the response carries no `message` and `mapError` returns nothing. */
  errorMessage?: string;
  /** Derive a user-facing message from a failure body — e.g. an error-code dictionary ({ error: 'seat_limit' }). */
  mapError?: (data: T | null, res: Response) => string | undefined;
}

interface Outcome<T> {
  ok: boolean;
  /** HTTP status, or 0 if the request never completed (network error). */
  status: number;
  /** Parsed JSON body, or null when there is none / it failed to parse. */
  data: T | null;
}

const DEFAULT_ERROR = 'Something went wrong.';

export function useFormSubmit() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit<T = unknown>(url: string, init: SubmitInit<T> = {}): Promise<Outcome<T>> {
    setBusy(true);
    setError(null);
    try {
      const isForm = init.body instanceof FormData;
      const hasBody = init.body != null;
      const res = await fetch(url, {
        method: init.method ?? 'POST',
        headers: hasBody && !isForm ? { 'Content-Type': 'application/json' } : undefined,
        body: !hasBody ? undefined : isForm ? (init.body as FormData) : JSON.stringify(init.body),
      });
      const data = (await res.json().catch(() => null)) as T | null;
      if (!res.ok) {
        const fromBody = (data as { message?: string } | null)?.message;
        setError(init.mapError?.(data, res) ?? fromBody ?? init.errorMessage ?? DEFAULT_ERROR);
      }
      return { ok: res.ok, status: res.status, data };
    } catch {
      setError(init.errorMessage ?? DEFAULT_ERROR);
      return { ok: false, status: 0, data: null };
    } finally {
      setBusy(false);
    }
  }

  return { busy, error, setError, submit };
}
