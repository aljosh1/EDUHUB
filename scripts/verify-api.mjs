/**
 * End-to-end API smoke test against a running dev/prod server.
 *
 * Signs in through Supabase Auth, then exercises every document/share
 * endpoint with real session cookies — exactly like the browser does.
 *
 * Usage:
 *   node scripts/verify-api.mjs
 *   BASE_URL=http://localhost:3000 EMAIL=user-a@paperstack.test PASSWORD=secret node scripts/verify-api.mjs
 *
 * Requires: a running server, a migrated database, and one existing user.
 * It CREATES and then DELETES its own document, so it is safe to re-run.
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.EMAIL ?? "user-a@paperstack.test";
const PASSWORD = process.env.PASSWORD ?? "";

function loadEnv() {
  if (!fs.existsSync(".env.local")) return {};
  return Object.fromEntries(
    fs
      .readFileSync(".env.local", "utf8")
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])
  );
}

const env = loadEnv();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const results = [];
function check(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

function cookieHeader(session) {
  const ref = new URL(url).hostname.split(".")[0];
  const name = `sb-${ref}-auth-token`;
  const value = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64");
  return `${name}=${value}`;
}

async function call(path, { method = "GET", body, cookie, headers = {} } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  const type = res.headers.get("content-type") ?? "";
  let json = null;
  if (type.includes("application/json")) {
    try {
      json = await res.json();
    } catch {
      json = null;
    }
  }
  return { status: res.status, json, type };
}

const supabase = createClient(url, anon, { auth: { persistSession: false } });

console.log(`\nPaperstack API smoke test → ${BASE}\n`);

// --- unauthenticated -------------------------------------------------------
const anonDocs = await call("/api/documents");
check("GET /api/documents without session → 401 JSON", anonDocs.status === 401 && !!anonDocs.json?.error, `status=${anonDocs.status} type=${anonDocs.type}`);
check("unauthenticated response is not HTML", !anonDocs.type.includes("text/html"), anonDocs.type);

// --- sign in ---------------------------------------------------------------
if (!PASSWORD) {
  console.log("\nNo PASSWORD provided (set EMAIL/PASSWORD env vars) — stopping after unauthenticated checks.\n");
  process.exit(results.every((r) => r.pass) ? 0 : 1);
}

const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
if (authErr || !auth.session) {
  check(`sign in as ${EMAIL}`, false, authErr?.message ?? "no session");
  process.exit(1);
}
check(`sign in as ${EMAIL}`, true);
const cookie = cookieHeader(auth.session);
const userId = auth.user.id;

const list = await call("/api/documents", { cookie });
check("GET /api/documents → 200 and an array", list.status === 200 && Array.isArray(list.json?.documents), `status=${list.status} ${JSON.stringify(list.json?.error ?? "")}`);

const shared = await call("/api/documents/shared", { cookie });
check("GET /api/documents/shared → 200", shared.status === 200 && Array.isArray(shared.json?.documents), `status=${shared.status} ${JSON.stringify(shared.json?.error ?? "")}`);

// --- create ----------------------------------------------------------------
const created = await call("/api/documents", { method: "POST", cookie, body: {} });
const docId = created.json?.document?.id;
check("POST /api/documents → 201 with id", created.status === 201 && !!docId, `status=${created.status}`);
check("new document is owned by the session user", created.json?.document?.owner_id === userId);
if (!docId) process.exit(1);

// --- read own --------------------------------------------------------------
const got = await call(`/api/documents/${docId}`, { cookie });
check("GET own document → 200 with role=owner", got.status === 200 && got.json?.role === "owner", `status=${got.status}`);

// --- update ----------------------------------------------------------------
const content = { type: "doc", content: [{ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Hello" }] }, { type: "paragraph", content: [{ type: "text", marks: [{ type: "bold" }], text: "world" }] }] };
const patched = await call(`/api/documents/${docId}`, { method: "PATCH", cookie, body: { title: "Smoke test doc", content } });
check("PATCH title+content → 200", patched.status === 200, `status=${patched.status} ${JSON.stringify(patched.json?.error ?? "")}`);

const reread = await call(`/api/documents/${docId}`, { cookie });
check("content persists as structured JSON", JSON.stringify(reread.json?.document?.content) === JSON.stringify(content));
check("bold mark survived round-trip", JSON.stringify(reread.json?.document?.content).includes('"type":"bold"'));

// --- validation ------------------------------------------------------------
const badTitle = await call(`/api/documents/${docId}`, { method: "PATCH", cookie, body: { title: "   " } });
check("whitespace-only title → 400", badTitle.status === 400, `status=${badTitle.status}`);
const badId = await call(`/api/documents/not-a-uuid`, { cookie });
check("invalid UUID → 400", badId.status === 400, `status=${badId.status}`);

// --- sharing ---------------------------------------------------------------
const shares = await call(`/api/documents/${docId}/shares`, { cookie });
check("GET shares as owner → 200", shares.status === 200, `status=${shares.status}`);

const selfShare = await call(`/api/documents/${docId}/shares`, { method: "POST", cookie, body: { email: EMAIL, permission: "viewer" } });
check("sharing with self → 400", selfShare.status === 400, `status=${selfShare.status}`);

const ghost = await call(`/api/documents/${docId}/shares`, { method: "POST", cookie, body: { email: "nobody@nowhere.test", permission: "viewer" } });
check("sharing with unknown email → 404", ghost.status === 404, `status=${ghost.status}`);

const other = await call(`/api/documents/00000000-0000-4000-8000-000000000000`, { cookie });
check("inaccessible document → 404", other.status === 404, `status=${other.status}`);

// --- import ----------------------------------------------------------------
const form = new FormData();
form.append("file", new Blob(["# Title\n\nSome **bold** text.\n\n- one\n- two\n"], { type: "text/markdown" }), "smoke.md");
const imp = await fetch(`${BASE}/api/documents/import`, { method: "POST", body: form, headers: { Cookie: cookie } });
const impJson = imp.status === 201 ? await imp.json() : null;
check("import .md → 201", imp.status === 201, `status=${imp.status}`);

const badForm = new FormData();
badForm.append("file", new Blob(["hello"], { type: "text/plain" }), "notes.exe");
const badImp = await fetch(`${BASE}/api/documents/import`, { method: "POST", body: badForm, headers: { Cookie: cookie } });
check("import .exe → 415", badImp.status === 415, `status=${badImp.status}`);

// --- cleanup ---------------------------------------------------------------
const del = await call(`/api/documents/${docId}`, { method: "DELETE", cookie });
check("DELETE own document → 200", del.status === 200, `status=${del.status}`);
if (impJson?.document?.id) await call(`/api/documents/${impJson.document.id}`, { method: "DELETE", cookie });
const gone = await call(`/api/documents/${docId}`, { cookie });
check("deleted document → 404", gone.status === 404, `status=${gone.status}`);

await supabase.auth.signOut();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log("Failed checks:");
  failed.forEach((f) => console.log(`  - ${f.name} (${f.detail})`));
}
process.exit(failed.length ? 1 : 0);
