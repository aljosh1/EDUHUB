import { SupabaseClient } from "@supabase/supabase-js";
import { evaluatePermission, Permission } from "@/types/domain";
import { EMPTY_DOC } from "@/types/domain";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

type Db = SupabaseClient;

export async function getSharePermission(db: Db, documentId: string, userId: string): Promise<Permission | null> {
  const { data } = await db
    .from("document_shares")
    .select("permission")
    .eq("document_id", documentId)
    .eq("shared_with", userId)
    .maybeSingle();
  return (data?.permission as Permission | undefined) ?? null;
}

/** Returns the document if the user is authorized to read it, else null. */
export async function getAuthorizedDocument(db: Db, documentId: string, userId: string) {
  const { data: doc, error } = await db.from("documents").select("*").eq("id", documentId).maybeSingle();
  if (error || !doc) return null;
  const perms = evaluatePermission({ userId, ownerId: doc.owner_id, sharePermission: await getSharePermission(db, documentId, userId) });
  if (!perms.canRead) return null;
  return { doc, perms };
}

export async function listOwnedDocuments(db: Db, userId: string) {
  const { data, error } = await db
    .from("documents")
    .select("id, title, owner_id, updated_at, created_at")
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw new HttpError(500, "Failed to load documents");
  return data ?? [];
}

export async function listSharedDocuments(db: Db, userId: string) {
  const { data, error } = await db
    .from("document_shares")
    .select("permission, documents(id, title, owner_id, updated_at, created_at, profiles:owner_id(display_name))")
    .eq("shared_with", userId);
  if (error) throw new HttpError(500, "Failed to load shared documents");
  return (data ?? []).map((row: Record<string, unknown>) => {
    const d = row.documents as Record<string, unknown> | null;
    if (!d) return null;
    const profiles = d.profiles as { display_name: string | null } | { display_name: string | null }[] | null;
    const ownerName = Array.isArray(profiles) ? profiles[0]?.display_name : profiles?.display_name;
    return {
      id: d.id as string,
      title: d.title as string,
      owner_id: d.owner_id as string,
      updated_at: d.updated_at as string,
      created_at: d.created_at as string,
      owner_display_name: ownerName ?? null,
      permission: row.permission as Permission,
    };
  }).filter(Boolean);
}


export async function createDocument(
  db: Db,
  userId: string,
  title: string,
  content: unknown
) {
  const { data, error } = await db
    .from("documents")
    .insert({ owner_id: userId, title, content })
    .select("id, title, owner_id, updated_at, created_at")
    .single();

  if (error) {
    console.error("[createDocument] Supabase insert failed:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });

    throw new HttpError(500, "Failed to create document");
  }

  if (!data) {
    console.error("[createDocument] Insert returned no document.");
    throw new HttpError(500, "Failed to create document");
  }

  return data;
}


export async function updateDocument(db: Db, documentId: string, userId: string, patch: { title?: string; content?: unknown }) {
  const found = await getAuthorizedDocument(db, documentId, userId);
  if (!found) throw new HttpError(404, "Document not found");
  if (!found.perms.canEdit) throw new HttpError(403, "You do not have permission to edit this document");
  const { data, error } = await db
    .from("documents")
    .update(patch)
    .eq("id", documentId)
    .select("id, title, updated_at")
    .single();
  if (error || !data) throw new HttpError(500, "Failed to update document");
  return data;
}

export async function deleteDocument(db: Db, documentId: string, userId: string) {
  const found = await getAuthorizedDocument(db, documentId, userId);
  if (!found) throw new HttpError(404, "Document not found");
  if (!found.perms.canDelete) throw new HttpError(403, "Only the owner can delete this document");
  const { error } = await db.from("documents").delete().eq("id", documentId);
  if (error) throw new HttpError(500, "Failed to delete document");
}

// ---- sharing ----

export async function findUserByEmail(db: Db, email: string) {
  // Requires admin client or a SQL function; see listCollaborators for secure RPC usage.
  const { data } = await db.rpc("get_user_id_by_email", { target_email: email });
  if (!data) return null;
  const rec = Array.isArray(data) ? data[0] : data;
  if (!rec?.id) return null;
  return { id: rec.id as string, email: rec.email as string | null, display_name: (rec.display_name as string | null) ?? null };
}

export async function listShares(db: Db, documentId: string, userId: string) {
  const found = await getAuthorizedDocument(db, documentId, userId);
  if (!found) throw new HttpError(404, "Document not found");
  const { data, error } = await db
    .from("document_shares")
    .select("id, document_id, shared_by, shared_with, permission, created_at, profiles:shared_with(display_name)")
    .eq("document_id", documentId);
  if (error) throw new HttpError(500, "Failed to load collaborators");
  return (data ?? []).map((s: Record<string, unknown>) => {
    const p = s.profiles as { display_name: string | null } | { display_name: string | null }[] | null;
    const dn = Array.isArray(p) ? p[0]?.display_name : p?.display_name;
    return {
      id: s.id as string,
      document_id: s.document_id as string,
      shared_by: s.shared_by as string,
      shared_with: s.shared_with as string,
      permission: s.permission as Permission,
      created_at: s.created_at as string,
      shared_with_display_name: dn ?? null,
    };
  });
}

/** Only the owner may create or modify shares. */
export async function upsertShare(db: Db, documentId: string, ownerId: string, recipientId: string, permission: Permission) {
  const { data: doc } = await db.from("documents").select("id, owner_id").eq("id", documentId).maybeSingle();
  if (!doc) throw new HttpError(404, "Document not found");
  if (doc.owner_id !== ownerId) throw new HttpError(403, "Only the owner can share this document");
  if (recipientId === ownerId) throw new HttpError(400, "Cannot share a document with yourself");

  const { error } = await db
    .from("document_shares")
    .upsert({ document_id: documentId, shared_by: ownerId, shared_with: recipientId, permission }, { onConflict: "document_id,shared_with" });
  if (error) throw new HttpError(500, "Failed to share document");
}

export async function updateSharePermission(db: Db, documentId: string, ownerId: string, shareId: string, permission: Permission) {
  const { data: share } = await db.from("document_shares").select("id, document_id").eq("id", shareId).maybeSingle();
  if (!share || share.document_id !== documentId) throw new HttpError(404, "Share not found");
  const { data: doc } = await db.from("documents").select("owner_id").eq("id", documentId).maybeSingle();
  if (!doc || doc.owner_id !== ownerId) throw new HttpError(403, "Only the owner can manage collaborators");
  const { error } = await db.from("document_shares").update({ permission }).eq("id", shareId);
  if (error) throw new HttpError(500, "Failed to update collaborator");
}

export async function removeShare(db: Db, documentId: string, ownerId: string, shareId: string) {
  const { data: share } = await db.from("document_shares").select("id, document_id, shared_with").eq("id", shareId).maybeSingle();
  if (!share || share.document_id !== documentId) throw new HttpError(404, "Share not found");
  const { data: doc } = await db.from("documents").select("owner_id").eq("id", documentId).maybeSingle();
  if (!doc || doc.owner_id !== ownerId) throw new HttpError(403, "Only the owner can manage collaborators");
  const { error } = await db.from("document_shares").delete().eq("id", shareId);
  if (error) throw new HttpError(500, "Failed to remove collaborator");
}

export { EMPTY_DOC };
