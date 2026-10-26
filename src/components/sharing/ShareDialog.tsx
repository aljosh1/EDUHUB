"use client";

import { useEffect, useState } from "react";
import { X, Trash2 } from "lucide-react";
import { ShareRecord } from "@/types/domain";

interface Props {
  documentId: string;
  onClose: () => void;
}

export function ShareDialog({ documentId, onClose }: Props) {
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState<"viewer" | "editor">("viewer");
  const [shares, setShares] = useState<ShareRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch(`/api/documents/${documentId}/shares`);
    if (res.ok) {
      const data = await res.json();
      setShares(data.shares);
    } else {
      setShares([]);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  async function share(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/documents/${documentId}/shares`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, permission }),
    });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Failed to share document");
      return;
    }
    setSuccess(`Document shared with ${email} as ${permission}.`);
    setEmail("");
    load();
  }

  async function removeShare(shareId: string) {
    const res = await fetch(`/api/documents/${documentId}/shares/${shareId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to remove collaborator");
      return;
    }
    load();
  }

  async function changePermission(shareId: string, perm: string) {
    const res = await fetch(`/api/documents/${documentId}/shares/${shareId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permission: perm }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to update collaborator");
      return;
    }
    load();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="share-title" onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 id="share-title" className="text-lg font-medium">Share document</h2>
          <button onClick={onClose} aria-label="Close share dialog" className="rounded p-1 hover:bg-zinc-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={share} className="mt-4 space-y-3">
          <div className="flex gap-2">
            <label htmlFor="share-email" className="sr-only">Recipient email</label>
            <input
              id="share-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@example.com"
              className="min-w-0 flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
            <label htmlFor="share-permission" className="sr-only">Permission</label>
            <select
              id="share-permission"
              value={permission}
              onChange={(e) => setPermission(e.target.value as "viewer" | "editor")}
              className="rounded-md border border-zinc-300 px-2 py-2 text-sm"
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
            </select>
          </div>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          {success && <p role="status" className="text-sm text-green-700">{success}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-zinc-900 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {busy ? "Sharing…" : "Share"}
          </button>
        </form>

        <div className="mt-5">
          <h3 className="text-sm font-medium text-zinc-700">Collaborators</h3>
          {shares === null && <p className="mt-2 text-sm text-zinc-500">Loading…</p>}
          {shares !== null && shares.length === 0 && <p className="mt-2 text-sm text-zinc-500">Not shared with anyone yet.</p>}
          {shares !== null && shares.length > 0 && (
            <ul className="mt-2 divide-y divide-zinc-100">
              {shares.map((s) => (
                <li key={s.id} className="flex items-center gap-2 py-2">
                  <div className="min-w-0 flex-1 truncate text-sm">
                    {s.shared_with_display_name ?? s.shared_with}
                  </div>
                  <select
                    aria-label={`Permission for collaborator ${s.shared_with}`}
                    value={s.permission}
                    onChange={(e) => changePermission(s.id, e.target.value)}
                    className="rounded border border-zinc-300 px-1.5 py-1 text-xs"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                  </select>
                  <button
                    onClick={() => removeShare(s.id)}
                    aria-label={`Remove collaborator ${s.shared_with}`}
                    className="rounded p-1 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
