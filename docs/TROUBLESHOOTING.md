# Fixing "Failed to fetch document" / "Failed to fetch shared documents"

These errors had **two independent causes**. Both are now addressed.

---

## Cause 1 — API routes were redirecting to HTML (fixed in code)

`src/middleware.ts` redirected **every** unauthenticated request to `/login`,
including `/api/*`. A `fetch()` that hits that redirect receives the login
**HTML page** instead of JSON, so the client blew up with a parse/fetch error
and reported "Failed to fetch …".

Now the middleware returns a real JSON response for API routes:

```json
{ "error": "Authentication required" }   // HTTP 401
```

Verified locally:

```
GET /api/documents  ->  401 {"error":"Authentication required"}
```

Also added: every client call now uses `readApiResponse()` (in
`src/lib/api/helpers.ts`), so a bad/HTML/non-JSON response produces a clear
message ("Your session has expired…", "Unexpected response from the server…")
instead of the opaque browser "Failed to fetch" text.

**Important:** if you see this error, you are probably simply **signed out**.
Sign in at `/login`.

---

## Cause 2 — the database schema was never applied (action required by you)

The Supabase project exists, but the tables do not:

```
profiles:        PGRST205 | Could not find the table 'public.profiles' in the schema cache
documents:       PGRST205 | Could not find the table 'public.documents' in the schema cache
document_shares: PGRST205 | Could not find the table 'public.document_shares' in the schema cache
```

Until this is fixed, every document operation fails. The app now says so
explicitly instead of failing silently.

### Apply the schema (about 2 minutes)

1. Open your Supabase project → **SQL Editor** → **New query**.
2. Open `docs/APPLY_SCHEMA.sql` (identical to `supabase/migrations/0001_init.sql`).
3. Copy the **entire** file, paste it into the editor, and click **Run**.
   You should see "Success. No rows returned".
4. The final line runs `notify pgrst, 'reload schema';` so the API sees the new
   tables immediately. If you still see `PGRST205`, wait ~30 seconds, or go to
   **Project Settings → API → Reload schema cache**.
5. Create two users for the sharing demo — either with the app's **Sign up**
   form or **Authentication → Users → Add user**:
   - `user-a@paperstack.test`
   - `user-b@paperstack.test`

### Confirm it worked

```powershell
node -e "const fs=require('fs');const e=Object.fromEntries(fs.readFileSync('.env.local','utf8').split(/\r?\n/).filter(l=>l&&!l.startsWith('#')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1)]));const {createClient}=require('@supabase/supabase-js');const c=createClient(e.NEXT_PUBLIC_SUPABASE_URL,e.NEXT_PUBLIC_SUPABASE_ANON_KEY);(async()=>{for(const t of ['profiles','documents','document_shares']){const {error}=await c.from(t).select('*').limit(1);console.log(t+':',error?error.code+' '+error.message:'OK (exists, RLS active)')}})()"
```

All three lines must read `OK (exists, RLS active)` — an empty result with no
error means the table exists and Row Level Security is correctly hiding rows
from an anonymous client.

### Why this could not be done from the development environment

Applying the migration requires either the database password / connection
string, a service-role key, or a Supabase access token. None of those are
present in this environment, and inventing a success would be dishonest.
The SQL itself is complete and idempotent — it can be re-run safely.

---

## Other bugs found during this pass and fixed

| Bug | Impact | Fix |
|---|---|---|
| Middleware redirected `/api/*` to login | "Failed to fetch document" / "…shared documents" | Return 401 JSON for API routes |
| Empty MIME type for `.md` rejected | **Every** `.md`/`.txt` import failed with 415 on Windows | `isSupportedImportMime` now tolerates empty/`octet-stream`/alias types and defers to extension + magic-byte checks |
| Supabase errors logged as `{}` | Impossible to diagnose server-side | Flat, grepped log line: `code=… message=… details=… hint=…` |
| Missing-table error surfaced as generic 500 | Users saw a dead end | Now returns: "The database is not set up yet. Apply supabase/migrations/0001_init.sql…" |
| Session expiry during save redirected silently | Silent data loss risk | Save shows "Save failed" + explains the session expired |
| Unused `evaluatePermission` import / stale `void` statement | Lint noise | Removed |

Tests: **38 passing** (was 30) — added `tests/unit/api-response.test.ts` (5)
and MIME-alias cases to `tests/unit/validation.test.ts`.
