# SUBMISSION — Paperstack

## Project

Paperstack — a lightweight, multi-user document workspace: create, rename, edit (rich text), import (.txt/.md/.docx), save reliably, and share documents with viewer/editor permissions between registered users.

## Source code

Repository: pending push to GitHub (local git history is complete; see README "Deployment" for the exact steps). Update this line with the final URL after pushing.

## Live application

Live URL: pending (Vercel deployment not yet completed — no deployment credentials were available in this environment). The app builds and runs locally with `npm run dev`; see README for the full deployment checklist. **Deployment preparation is complete; deployment execution is not.**

## Reviewer accounts

Test accounts are created via Supabase Auth (dashboard → Authentication → Add user, or the login page's Sign up form):

- `user-a@paperstack.test` / password of your choice (document it when creating)
- `user-b@paperstack.test` / password of your choice

Demonstration procedure:

1. Sign in as User A → create a document → write content, apply formatting → confirm "Saved".
2. Click **Share**, enter `user-b@paperstack.test`, choose **editor**, share.
3. Sign out → sign in as User B → **Shared with Me** shows the document with User A as owner.
4. Edit and save as User B; refresh to verify persistence.
5. Repeat with **viewer**: User B sees a read-only editor and the server rejects update attempts.
6. Owner removes the collaborator → User B loses access on next request.

## Included materials

- Source code (this repository)
- `README.md` — setup, environment, database, testing, deployment, limitations
- `ARCHITECTURE.md` — system overview, lifecycle, persistence, authorization, tradeoffs
- `AI_WORKFLOW.md` — actual AI usage, changes/rejections, verification
- `SUBMISSION.md` — this manifest
- `supabase/migrations/0001_init.sql` — complete schema: tables, RLS, triggers, lookup function
- `tests/unit/*` — 30 Vitest tests (validation, permissions, import)
- `tests/e2e/paperstack.spec.ts` — Playwright scenarios
- `WALKTHROUGH_URL.txt` — placeholder until the video is recorded and published
- `docs/screenshots/` — to be captured from the running app (not fabricated)

## Working functionality

Verified locally (build + 30 unit tests pass; typecheck and lint clean):

- Authentication (sign in/up via Supabase Auth), session-protected routes and APIs
- Document create, list (owned), rename (validated), delete (owner-only, confirmed)
- TipTap editor: bold/italic/underline, H1–H3, bullet/numbered lists, undo/redo; toolbar reflects active state
- Debounced autosave with save states (Saving/Saved/Unsaved/Failed), serialized saves, unsaved-change warning
- Import of .txt, .md, .docx with server-side type/size/magic-byte validation
- Sharing with viewer/editor permissions, collaborator list, permission change, revocation
- Server-side + RLS authorization; 401/403/404/413/415 semantics
- Shared-with-Me view with owner display name and permission badge

## Known limitations

- Database schema must be applied to the Supabase project before use (SQL is provided; apply via Supabase SQL editor or `supabase db push`).
- Hosted deployment not completed (no credentials in this environment); live URL pending.
- Walkthrough video not yet recorded; `WALKTHROUGH_URL.txt` is a placeholder.
- Search filters client-side over already-authorized documents (server returns the user's full authorized list; no server-side search endpoint).
- DOCX import preserves paragraphs/headings/inline marks/lists only; tables, images, and tracked changes are not preserved (documented).

## Next steps

1. Apply schema + deploy to Vercel; verify against the live URL and record the walkthrough video.
2. Add server-side search/pagination and optimistic concurrency (version counter) on PATCH.
3. Add Markdown export and a minimal version history (updated_at snapshots) as the first optional enhancement.
