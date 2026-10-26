import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthorizedDocument, upsertShare, listShares, findUserByEmail } from "@/services/documents";
import { createShareSchema, documentIdSchema } from "@/lib/validation/schemas";
import { handleApiError, jsonError, requireUser } from "@/lib/api/helpers";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const documentId = documentIdSchema.parse(id);
    const db = await getSupabaseServerClient();
    const found = await getAuthorizedDocument(db, documentId, user.id);
    if (!found) return jsonError(404, "Document not found");
    // Only owner can view collaborator list
    if (found.perms.role !== "owner") return jsonError(403, "Only the owner can manage collaborators");
    const shares = await listShares(db, documentId, user.id);
    return NextResponse.json({ shares });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const documentId = documentIdSchema.parse(id);
    const body = createShareSchema.parse(await req.json());
    const db = await getSupabaseServerClient();
    const found = await getAuthorizedDocument(db, documentId, user.id);
    if (!found) return jsonError(404, "Document not found");
    if (found.perms.role !== "owner") return jsonError(403, "Only the owner can share this document");

    // Resolve the recipient against real registered accounts (server-side RPC).
    const recipient = await findUserByEmail(db, body.email);
    if (!recipient) return jsonError(404, "No registered user found with that email");

    await upsertShare(db, documentId, user.id, recipient.id, body.permission);
    return NextResponse.json({ ok: true, recipient: { id: recipient.id, display_name: recipient.display_name } }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
