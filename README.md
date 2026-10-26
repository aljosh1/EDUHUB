# Paperstack — Lightweight Document Creation, Editing, Importing, and Sharing

Paperstack is a focused, multi-user document workspace. Sign in, create documents, edit them with a rich-text editor, import `.txt` / `.md` / `.docx` files, save reliably with autosave, and share documents with other registered users using **viewer** or **editor** permissions.

## Features

Implemented and verified:

- **Authentication** — Supabase Auth (email + password), session-protected pages and APIs, sign out.
- **Documents** — create, list (My Documents), rename (validated: trimmed, 1–200 chars), delete (owner-only, with confirmation).
- **Rich-text editing** — TipTap: bold, italic, underline, headings (H1–H3), bullet and numbered lists, undo/redo, keyboard shortcuts; toolbar reflects active formatting.
- **Persistence** — documents are stored as TipTap JSON in PostgreSQL JSONB; formatting survives refresh. Debounced autosave (800 ms) with Saving / Saved / Unsaved changes / Save failed states, serialized saves (older requests cannot overwrite newer content), and an unsaved-changes warning on unload.
- **File import** — `.txt`, `.md`, `.docx` (max 5 MB), parsed server-side into editable documents; see "Supported imports" below.
- **Sharing** — share by email with viewer or editor permission, collaborator list, permission changes, revocation; Shared with Me view showing the owner's name and permission badge.
- **Security** — server-side authorization on every document operation, Row Level Security policies, Zod request validation, safe import validation (size, type, magic bytes), no service-role key in the client.

Limitations are listed at the bottom.

## Technology stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router), React, TypeScript (strict), Tailwind CSS, Lucide icons |
| Editor | TipTap 3 (StarterKit + Underline) |
| Backend | Next.js Route Handlers, server-side service modules, Zod validation |
| Database | Supabase PostgreSQL with Row Level Security |
| Auth | Supabase Auth |
| Testing | Vitest (unit), Playwright (e2e) |

## Prerequisites

- Node.js 20+ and npm
- A free [Supabase](https://supabase.com) project (database + auth)
- (Optional) Playwright browsers for e2e tests: `npx playwright install`

## Installation

```bash
git clone <repository-url>
cd paperstack
npm install
```

## Environment variables

Copy the template and fill in your Supabase values:

```bash
cp .env.example .env.local
```

| Variable | Visibility | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Supabase publishable/anon key (safe for the browser; RLS applies) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only secret | **Not required** by this app; do not add unless you know you need it |

Never commit `.env.local`.

## Database setup

1. Create a Supabase project.
2. Open **SQL Editor** in the Supabase dashboard.
3. Paste the full contents of [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) and run it. This creates:
   - `profiles`, `documents`, `document_shares` tables with constraints and indexes
   - `updated_at` trigger and auto-profile creation on signup
   - **Row Level Security policies** for all three tables
   - `get_user_id_by_email()` security-definer function used for share recipient lookup
4. Create test users: either use the app's Sign up form, or Supabase dashboard → Authentication → Add user. For the sharing demo create two users, e.g. `user-a@paperstack.test` and `user-b@paperstack.test`.

(If you use the Supabase CLI, `supabase db push` against `supabase/migrations` works as well.)

## Local execution

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Unauthenticated visitors are redirected to `/login`.

## Testing

All commands run from the project root:

```bash
npm run lint        # ESLint
npm run typecheck   # strict TypeScript check
npm run test        # Vitest unit tests (30 tests)
npm run e2e         # Playwright end-to-end tests (requires a configured Supabase backend)
npm run build       # production build
```

Unit tests cover title validation, editor-content validation, file type/size validation, TXT/Markdown/DOCX conversion, and permission evaluation (owner/editor/viewer). E2E scenarios cover the document lifecycle, sharing, viewer restrictions, and file import; they require the database to be set up and environment variables configured.

## Deployment

Preferred: Vercel (app) + Supabase (database/auth) + GitHub (source).

1. Push the repository to GitHub.
2. Import it into Vercel.
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the Vercel project environment.
4. Apply `supabase/migrations/0001_init.sql` to the production Supabase project (as above).
5. In Supabase Auth settings, add the production URL to the allowed redirect/site URLs.
6. Deploy, then verify: login, document creation, persistence after refresh, import, sharing between two accounts, and viewer restrictions.

## Supported imports

| Format | Preserved | Not preserved |
|---|---|---|
| `.txt` | Paragraphs | Any styling (none exists) |
| `.md` | Headings, paragraphs, **bold**, *italic*, bullet lists, numbered lists | Raw HTML blocks (deliberately ignored for safety), tables, images, code blocks |
| `.docx` | Paragraphs, headings, bold, italic, underline, bullet/numbered lists | Tables, images, tracked changes, comments, complex layouts |

Limit: 5 MB. Files are processed in memory; nothing is written to disk. Invalid or oversized files are rejected with clear errors.

## Reviewer access

1. Complete **Database setup** above and create the two test users.
2. Sign in as User A → **New Document** → type content, apply bold/heading/list → wait for **Saved** → refresh and confirm formatting persisted.
3. Click **Share** → enter User B's email → permission **editor** → Share.
4. Sign out → sign in as User B → **Shared with Me** → open the document → edit → **Saved** → refresh to verify.
5. As User A, change User B's permission to **viewer** → as User B, the editor is read-only and update attempts are rejected by the server.
6. As User A, remove User B → as User B, the document disappears from Shared with Me and API access is denied.

## Known limitations

- Search filters client-side over the user's already-authorized document list (no server-side search endpoint).
- DOCX fidelity is intentionally limited (see table above).
- No real-time collaboration, version history, or export; document deletion is permanent (no trash).
- Sharing management is owner-only by design.
- Deployment/live URL pending — see SUBMISSION.md for current status.

## Contributing

1. Fork and branch.
2. `npm run lint && npm run typecheck && npm run test` must pass.
3. Submit a pull request describing the change.
