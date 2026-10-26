/**
 * Client-safe API response helpers.
 *
 * This module MUST NOT import anything server-only (no `next/headers`, no
 * Supabase server client). It is imported by client components, so a server
 * import here would break the browser bundle.
 */

/**
 * Safely parse an API response. Never throws on HTML bodies (e.g. an
 * unexpected redirect to the login page, or a proxy error page) — returns a
 * human-readable error instead of the opaque browser "Failed to fetch" text.
 */
export async function readApiResponse<T = unknown>(
  res: Response
): Promise<{ ok: boolean; status: number; data: T | null; error: string | null }> {
  const contentType = res.headers.get("content-type") ?? "";
  let data: T | null = null;
  let error: string | null = null;

  if (contentType.includes("application/json")) {
    try {
      const body = (await res.json()) as { error?: string } & T;
      data = body;
      if (!res.ok) error = body?.error ?? `Request failed (${res.status})`;
    } catch {
      if (!res.ok) error = `Request failed (${res.status})`;
    }
  } else {
    error =
      res.status === 401
        ? "Your session has expired. Please sign in again."
        : `Unexpected response from the server (${res.status}). Please try again.`;
  }

  return { ok: res.ok, status: res.status, data, error };
}

/** Normalise a thrown fetch error into a message worth showing a user. */
export function describeFetchError(e: unknown, fallback: string): string {
  if (e instanceof Error) {
    if (e.message === "Failed to fetch" || e.name === "TypeError") {
      return "Could not reach the server. Check your connection and try again.";
    }
    return e.message;
  }
  return fallback;
}
