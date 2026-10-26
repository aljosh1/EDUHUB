"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FileText, Users, Search, MoreVertical, Trash2, Pencil, Upload, Plus, Clock } from "lucide-react";
import { DocumentSummary } from "@/types/domain";

interface SharedDoc extends DocumentSummary {
  permission?: "viewer" | "editor";
  owner_display_name?: string | null;
}

export function DocumentList({ mode }: { mode: "owned" | "shared" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [docs, setDocs] = useState<SharedDoc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SharedDoc | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(mode === "owned" ? "/api/documents" : "/api/documents/shared");
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Failed to load");
      const data = await res.json();
      setDocs(data.documents);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load documents");
      setDocs([]);
    }
  }, [mode]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const createDocument = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/documents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      if (!res.ok) throw new Error("Failed to create document");
      const data = await res.json();
      router.push(`/documents/${data.document.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create document");
    } finally {
      setBusy(false);
    }
  }, [router]);

  // Auto-create when ?new=1 (sidebar New Document)
  useEffect(() => {
    if (mode === "owned" && searchParams.get("new") === "1" && !busy) {
      const sp = new URLSearchParams(searchParams.toString());
      sp.delete("new");
      router.replace(`/documents${sp.toString() ? `?${sp}` : ""}`);
      void Promise.resolve().then(createDocument);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function handleImport(file: File) {
    setImportOpen(false);
    setImportMsg(null);
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/documents/import", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      router.push(`/documents/${data.document.id}`);
    } catch (e) {
      setImportMsg(e instanceof Error ? e.message : "Import failed");
      setBusy(false);
    }
  }

  async function handleRename(docId: string) {
    setRenameError(null);
    const title = renameValue.trim();
    if (!title) {
      setRenameError("Title cannot be empty.");
      return;
    }
    if (title.length > 200) {
      setRenameError("Title must be at most 200 characters.");
      return;
    }
    const res = await fetch(`/api/documents/${docId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setRenameError(data.error ?? "Rename failed");
      return;
    }
    setRenameId(null);
    load();
  }

  async function handleDelete(docId: string) {
    setDeleteTarget(null);
    const res = await fetch(`/api/documents/${docId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Delete failed");
      return;
    }
    load();
  }

  const filtered = useMemo(() => {
    if (!docs) return null;
    const q = query.trim().toLowerCase();
    const visible = q ? docs.filter((d) => d.title.toLowerCase().includes(q)) : docs;
    return visible;
  }, [docs, query]);

  const heading = mode === "owned" ? "My Documents" : "Shared with Me";

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {mode === "owned" ? <FileText className="h-6 w-6" /> : <Users className="h-6 w-6" />}
          <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
        </div>
        {mode === "owned" && (
          <div className="flex gap-2">
            <button
              onClick={createDocument}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> New Document
            </button>
            <button
              onClick={() => setImportOpen(true)}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              <Upload className="h-4 w-4" /> Import Document
            </button>
          </div>
        )}
      </div>

      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title…"
          aria-label="Search documents by title"
          className="w-full rounded-md border border-zinc-300 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
        />
      </div>

      {importMsg && <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{importMsg}</p>}
      {error && <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {filtered === null && <p className="mt-8 text-sm text-zinc-500">Loading documents…</p>}

      {filtered !== null && filtered.length === 0 && !query && (
        <div className="mt-16 text-center">
          <FileText className="mx-auto h-10 w-10 text-zinc-300" />
          <p className="mt-3 font-medium text-zinc-700">
            {mode === "owned" ? "No documents yet" : "Nothing shared with you yet"}
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            {mode === "owned"
              ? "Create your first document or import a file to get started."
              : "Documents shared with you will appear here."}
          </p>
        </div>
      )}
      {filtered !== null && filtered.length === 0 && query && (
        <p className="mt-8 text-sm text-zinc-500">No documents match “{query}”.</p>
      )}

      {filtered !== null && filtered.length > 0 && (
        <ul className="mt-6 divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
          {filtered.map((doc) => (
            <li key={doc.id} className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50">
              <FileText className="h-5 w-5 shrink-0 text-zinc-400" />
              <div className="min-w-0 flex-1">
                {renameId === doc.id ? (
                  <div>
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(doc.id);
                        if (e.key === "Escape") setRenameId(null);
                      }}
                      aria-label="Document title"
                      className="w-full rounded border border-zinc-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                    />
                    {renameError && <p role="alert" className="mt-1 text-xs text-red-600">{renameError}</p>}
                    <div className="mt-1 flex gap-2">
                      <button onClick={() => handleRename(doc.id)} className="rounded bg-zinc-900 px-2 py-1 text-xs text-white">Save</button>
                      <button onClick={() => setRenameId(null)} className="rounded border border-zinc-300 px-2 py-1 text-xs">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <Link href={`/documents/${doc.id}`} className="block truncate font-medium text-zinc-900 hover:underline">
                    {doc.title}
                  </Link>
                )}
                <p className="mt-0.5 flex items-center gap-1 text-xs text-zinc-500">
                  <Clock className="h-3 w-3" /> Updated {new Date(doc.updated_at).toLocaleString()}
                  {mode === "shared" && (
                    <>
                      {" · "}
                      <span>
                        {doc.owner_display_name ? `Owner: ${doc.owner_display_name}` : "Shared"}
                      </span>
                      <span className="ml-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700 capitalize">
                        {doc.permission}
                      </span>
                    </>
                  )}
                </p>
              </div>
              {mode === "owned" && (
                <div className="relative">
                  <button
                    onClick={() => setMenuOpenId(menuOpenId === doc.id ? null : doc.id)}
                    aria-label={`Actions for ${doc.title}`}
                    aria-haspopup="menu"
                    aria-expanded={menuOpenId === doc.id}
                    className="rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {menuOpenId === doc.id && (
                    <div role="menu" className="absolute right-0 z-10 mt-1 w-40 rounded-md border border-zinc-200 bg-white py-1 shadow-lg">
                      <button
                        role="menuitem"
                        onClick={() => {
                          setMenuOpenId(null);
                          router.push(`/documents/${doc.id}`);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-100"
                      >
                        <FileText className="h-4 w-4" /> Open
                      </button>
                      <button
                        role="menuitem"
                        onClick={() => {
                          setMenuOpenId(null);
                          setRenameId(doc.id);
                          setRenameValue(doc.title);
                          setRenameError(null);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-100"
                      >
                        <Pencil className="h-4 w-4" /> Rename
                      </button>
                      <button
                        role="menuitem"
                        onClick={() => {
                          setMenuOpenId(null);
                          setDeleteTarget(doc);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" /> Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Import dialog */}
      {importOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="import-title">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 id="import-title" className="text-lg font-medium">Import a document</h2>
            <p className="mt-1 text-sm text-zinc-600">Supported formats: .txt, .md, .docx (max 5 MB).</p>
            <input
              type="file"
              accept=".txt,.md,.docx,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImport(f);
              }}
              className="mt-4 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-2 file:text-white"
            />
            <button
              onClick={() => setImportOpen(false)}
              className="mt-4 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-title">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h2 id="delete-title" className="text-lg font-medium">Delete document?</h2>
            <p className="mt-2 text-sm text-zinc-600">
              “{deleteTarget.title}” will be permanently deleted, along with its sharing relationships. This cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50">
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteTarget.id)} className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
