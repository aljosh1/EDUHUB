import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthorizedDocument } from "@/services/documents";
import { documentIdSchema } from "@/lib/validation/schemas";
import { handleApiError, jsonError, requireUser } from "@/lib/api/helpers";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const parsedId = documentIdSchema.parse(id);
    const db = await getSupabaseServerClient();
    const found = await getAuthorizedDocument(db, parsedId, user.id);
    if (!found) return jsonError(404, "Document not found");
    return NextResponse.json({
      document: found.doc,
      role: found.perms.role,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const parsedId = documentIdSchema.parse(id);
    const db = await getSupabaseServerClient();
    const { deleteDocument } = await import("@/services/documents");
    await deleteDocument(db, parsedId, user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const parsedId = documentIdSchema.parse(id);
    const body = (await req.json()) as { title?: string; content?: unknown };
    const db = await getSupabaseServerClient();
    const { updateDocument } = await import("@/services/documents");
    const patch: { title?: string; content?: unknown } = {};
    if (body.title !== undefined) {
      const { documentTitleSchema } = await import("@/lib/validation/schemas");
      patch.title = documentTitleSchema.parse(body.title);
    }
    if (body.content !== undefined) {
      const { documentContentSchema } = await import("@/lib/validation/schemas");
      patch.content = documentContentSchema.parse(body.content);
    }
    if (!Object.keys(patch).length) return jsonError(400, "Nothing to update");
    const updated = await updateDocument(db, parsedId, user.id, patch);
    return NextResponse.json({ document: updated });
  } catch (err) {
    return handleApiError(err);
  }
}


