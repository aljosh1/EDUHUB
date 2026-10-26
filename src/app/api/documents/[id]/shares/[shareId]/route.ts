import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { updateSharePermission, removeShare } from "@/services/documents";
import { documentIdSchema, permissionSchema } from "@/lib/validation/schemas";
import { handleApiError, requireUser } from "@/lib/api/helpers";

type Ctx = { params: Promise<{ id: string; shareId: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    const { id, shareId } = await params;
    const documentId = documentIdSchema.parse(id);
    const { permission } = (await req.json()) as { permission: string };
    const perm = permissionSchema.parse(permission);
    const db = await getSupabaseServerClient();
    await updateSharePermission(db, documentId, user.id, shareId, perm);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    const { id, shareId } = await params;
    const documentId = documentIdSchema.parse(id);
    const db = await getSupabaseServerClient();
    await removeShare(db, documentId, user.id, shareId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
