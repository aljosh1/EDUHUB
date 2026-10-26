# AI Workflow — How AI Was Used on Paperstack

This document is an honest account of how AI tools supported development, what was accepted, changed, or rejected, and how generated output was verified.

## AI tools used

- **Claude (agentic coding assistant)** — used throughout for scaffolding, implementation, refactoring, test writing, debugging, and documentation. This is the primary tool; everything below refers to it unless stated otherwise.
- **Built-in tooling driven by the assistant** — shell commands, file edits, web/docs lookups when API details were uncertain (e.g., TipTap v3 extension packages, `@supabase/ssr` cookie handling).

## Where AI accelerated development

- **Project scaffolding and structure** — Next.js App Router layout, route-group structure (`(workspace)`), Tailwind setup, and the layered `lib/` / `services/` / `components/` split were drafted quickly with AI, then reviewed and adjusted.
- **Supabase SSR wiring** — cookie-aware server/browser/middleware clients. The three-client pattern (browser, server component, route handler) is boilerplate-prone; AI produced a consistent first draft that survived review with minor changes.
- **Database schema** — AI drafted the migration (tables, RLS policies, triggers, the `get_user_id_by_email` security-definer function). The draft was then reviewed line by line; see "changed or rejected" below.
- **Repetitive UI** — dialog markup, toolbar buttons, list rows, empty states, and the share dialog benefited most; these are pattern-heavy and low-risk.
- **Import parsers** — first drafts of the marked-lexer-based Markdown conversion and the mammoth-based DOCX path, including the decision to parse mammoth's *output* with a minimal tag whitelist rather than trusting arbitrary HTML.
- **Tests** — initial unit test cases for validation, permissions, and import conversion (30 tests), plus Playwright scenario skeletons.
- **Debugging** — diagnosing the React Compiler lint rule (`react-hooks/set-state-in-effect`), production-build errors, and Supabase error shapes.

## AI-generated output that was changed or rejected

Real examples from this project:

1. **Client-supplied identity (rejected).** Early drafts of share/update flows were written to accept a `userId` from the request body for convenience. This was rejected: identity must come from the authenticated session (`auth.getUser()` server-side), never from the browser. All services now take the session-derived user id only.
2. **Naive autosave (changed).** A first autosave draft fired a PATCH per `update` event with no ordering guarantees, allowing an older in-flight response to overwrite newer content. It was replaced with a serialized save queue: one in-flight request, a `latestPayload` slot, a monotonic sequence number, and a post-completion flush.
3. **HTML round-tripping for persistence (rejected).** An early suggestion stored `editor.getHTML()` and re-parsed HTML on load. Rejected as lossy and a sanitization risk; the schema stores TipTap JSON validated with Zod instead.
4. **Trusting imported HTML (rejected).** mammoth returns HTML; rendering it directly would have allowed arbitrary markup into the page. Replaced with a strict tag-whitelist parser that converts only known-safe tags into TipTap nodes.
5. **`console.error` of full Supabase errors (changed).** Initial error logging included full error objects; trimmed to code/message/details/hint only, and user-facing messages are generic — no internals leak to clients.
6. **RLS policy gaps (changed).** The first draft had a single `for all` shares policy; review found the recipient also needs `select` on their own share rows (for "Shared with Me"), so an explicit recipient-select policy was added, plus the `shared_by <> shared_with` constraint.
7. **React effect patterns (changed).** AI-generated components triggered the strict `react-hooks/set-state-in-effect` rule. Rather than disabling the rule globally, the data-loading calls were deferred (`Promise.resolve().then(load)`) so state updates never run synchronously inside effects.

## Verification

Generated code was never accepted on faith. Every phase was checked with:

- **Type checking** — `npm run typecheck` (strict TS) after each significant change.
- **Linting** — `npm run lint`; real rule violations were fixed in code, not suppressed.
- **Unit/integration tests** — `npm run test` (30 tests covering title validation, editor-content validation, file type/size validation, markdown/DOCX/TXT conversion, and owner/editor/viewer permission evaluation).
- **Production build** — `npm run build` run to completion; build breakages were fixed rather than worked around.
- **Manual browser testing** — sign-in, document creation, formatting, refresh persistence, import, and sharing flows exercised in the running app.
- **Authorization checks** — API behavior verified for unauthenticated requests (401), cross-user access (404), viewer updates (403), and non-owner share management (403), with RLS as the second layer.

## Responsible AI use

- Security-sensitive operations (authorization, RLS, share management, file validation) were reviewed line by line against the threat model rather than accepted because they compiled.
- Error messages and logs were audited so secrets, stack traces, and internal identifiers are not exposed.
- Claims in the README/SUBMISSION are limited to what was actually run and observed; unverified items (e.g., hosted deployment when access is unavailable) are stated as pending, not pretended.
