"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { ArrowLeft, Share2, MoreVertical, Trash2 } from "lucide-react";
import { SaveStatus, EMPTY_DOC } from "@/types/domain";
import { ShareDialog } from "@/components/sharing/ShareDialog";
import { readApiResponse } from "@/lib/api/response";

interface Doc {
  id: string;
  title: string;
  content: unknown;
  owner_id: string;
  updated_at: string;
}

interface Props {
  doc: Doc;
  role: "owner" | "editor" | "viewer";
}

export function DocumentEditor({ doc, role }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(doc.title);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [shareOpen, setShareOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const canEdit = role !== "viewer";
  const isOwner = role === "owner";

  // Save sequencing: track a monotonically increasing request number and
  // a "latest pending" slot so an older in-flight response can never clobber
  // newer content.
  const saveSeq = useRef(0);
  const latestPayload = useRef<{ title?: string; content?: unknown } | null>(null);
  const saving = useRef(false);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);

  const flushSave = useCallback(async () => {
    if (saving.current || !latestPayload.current) return;
    saving.current = true;
    const payload = latestPayload.current;
    latestPayload.current = null;
    const seq = ++saveSeq.current;
    setSaveStatus("saving");
    try {
      const res = await fetch(`/api/documents/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (seq !== saveSeq.current) return; // a newer save superseded this one
      if (res.status === 401) {
        setSaveStatus("error");
        setLoadError("Your session has expired. Please sign in again — your latest changes may not be saved.");
        return;
      }
      const { ok, error: apiError } = await readApiResponse(res);
      if (!ok) {
        setSaveStatus("error");
        setLoadError(apiError ?? "Save failed");
        return;
      }
      setLoadError(null);
      setSaveStatus("saved");
      dirty.current = false;
    } catch {
      if (seq === saveSeq.current) setSaveStatus("error");
    } finally {
      saving.current = false;
      // If new changes arrived while saving, flush again
      if (latestPayload.current) flushSave();
    }
  }, [doc.id]);

  const queueSave = useCallback(
    (patch: { title?: string; content?: unknown }) => {
      latestPayload.current = { ...(latestPayload.current ?? {}), ...patch };
      dirty.current = true;
      setSaveStatus("unsaved");
      if (pendingTimer.current) clearTimeout(pendingTimer.current);
      pendingTimer.current = setTimeout(flushSave, 800);
    },
    [flushSave]
  );

  // Warn about unsaved changes on unload
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
    ],
    content: (doc.content ?? EMPTY_DOC) as Record<string, unknown>,
    editable: canEdit,
    editorProps: {
      attributes: {
        class: "prose prose-zinc max-w-none focus:outline-none min-h-[50vh]",
      },
    },
  });

  // Autosave on content updates
  useEffect(() => {
    if (!editor) return;
    const onUpdate = () => {
      queueSave({ content: editor.getJSON() });
    };
    editor.on("update", onUpdate);
    return () => {
      editor.off("update", onUpdate);
    };
  }, [editor, queueSave]);

  // Flush pending save before navigating back
  const handleBack = useCallback(async () => {
    if (pendingTimer.current) clearTimeout(pendingTimer.current);
    if (latestPayload.current) await flushSave();
    router.push(isOwner ? "/documents" : "/shared");
  }, [flushSave, router, isOwner]);

  async function handleTitleChange(newTitle: string) {
    setTitle(newTitle);
    if (isOwner) queueSave({ title: newTitle });
  }

  async function handleDelete() {
    const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
    const { ok, error: apiError } = await readApiResponse(res);
    if (ok) {
      router.push("/documents");
    } else {
      setLoadError(apiError ?? "Delete failed");
      setConfirmDelete(false);
    }
  }

  const statusText: Record<SaveStatus, string> = {
    saved: "Saved",
    saving: "Saving…",
    unsaved: "Unsaved changes",
    error: "Save failed",
  };
  const statusColor: Record<SaveStatus, string> = {
    saved: "text-green-700",
    saving: "text-zinc-500",
    unsaved: "text-amber-700",
    error: "text-red-700",
  };

  if (!editor) return <div className="p-8 text-sm text-zinc-500">Loading editor…</div>;

  const btn = (active: boolean) =>
    `rounded px-2 py-1 text-sm ${active ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"}`;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={isOwner ? "/documents" : "/shared"} onClick={(e) => { e.preventDefault(); handleBack(); }} className="inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900">
          <ArrowLeft className="h-4 w-4" /> {isOwner ? "My Documents" : "Shared with Me"}
        </Link>
        <span className="ml-auto flex items-center gap-2">
          <span className={`text-xs font-medium ${statusColor[saveStatus]}`} role="status">
            {statusText[saveStatus]}
          </span>
          {isOwner && (
            <button
              onClick={() => setShareOpen(true)}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-zinc-50"
            >
              <Share2 className="h-4 w-4" /> Share
            </button>
          )}
          {isOwner && (
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="Document actions"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
              {menuOpen && (
                <div role="menu" className="absolute right-0 z-10 mt-1 w-44 rounded-md border border-zinc-200 bg-white py-1 shadow-lg">
                  <button
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); setConfirmDelete(true); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" /> Delete document
                  </button>
                </div>
              )}
            </div>
          )}
          {!isOwner && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${role === "editor" ? "bg-blue-100 text-blue-700" : "bg-zinc-200 text-zinc-700"}`}>
              {role}
            </span>
          )}
        </span>
      </div>

      <input
        value={title}
        onChange={(e) => handleTitleChange(e.target.value)}
        disabled={!isOwner}
        aria-label="Document title"
        className="mt-4 w-full border-0 bg-transparent text-3xl font-semibold tracking-tight focus:outline-none disabled:text-zinc-700"
        placeholder="Untitled document"
      />

      {loadError && <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{loadError}</p>}

      <div className="sticky top-0 z-10 mt-4 flex flex-wrap items-center gap-1 rounded-md border border-zinc-200 bg-white p-1.5 shadow-sm">
        <button className={btn(editor.isActive("bold"))} onClick={() => editor.chain().focus().toggleBold().run()} aria-label="Bold">
          B
        </button>
        <button className={`${btn(editor.isActive("italic"))} italic`} onClick={() => editor.chain().focus().toggleItalic().run()} aria-label="Italic">
          I
        </button>
        <button className={`${btn(editor.isActive("underline"))} underline`} onClick={() => editor.chain().focus().toggleUnderline().run()} aria-label="Underline">
          U
        </button>
        <span className="mx-1 h-5 w-px bg-zinc-200" />
        <button className={btn(editor.isActive("heading", { level: 1 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} aria-label="Heading 1">
          H1
        </button>
        <button className={btn(editor.isActive("heading", { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} aria-label="Heading 2">
          H2
        </button>
        <button className={btn(editor.isActive("heading", { level: 3 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} aria-label="Heading 3">
          H3
        </button>
        <span className="mx-1 h-5 w-px bg-zinc-200" />
        <button className={btn(editor.isActive("bulletList"))} onClick={() => editor.chain().focus().toggleBulletList().run()} aria-label="Bulleted list">
          • List
        </button>
        <button className={btn(editor.isActive("orderedList"))} onClick={() => editor.chain().focus().toggleOrderedList().run()} aria-label="Numbered list">
          1. List
        </button>
        <span className="mx-1 h-5 w-px bg-zinc-200" />
        <button className={btn(false)} onClick={() => editor.chain().focus().undo().run()} aria-label="Undo">↺</button>
        <button className={btn(false)} onClick={() => editor.chain().focus().redo().run()} aria-label="Redo">↻</button>
      </div>

      <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm sm:p-10">
        <EditorContent editor={editor} />
      </div>

      {shareOpen && <ShareDialog documentId={doc.id} onClose={() => setShareOpen(false)} />}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="del-title">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h2 id="del-title" className="text-lg font-medium">Delete this document?</h2>
            <p className="mt-2 text-sm text-zinc-600">This permanently removes “{title}” and its shares.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(false)} className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50">Cancel</button>
              <button onClick={handleDelete} className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
