import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { listOwnedDocuments } from "@/services/documents";
import { documentTitleSchema, emptyDoc } from "@/lib/validation/schemas";
import { handleApiError, jsonError, requireUser } from "@/lib/api/helpers";

export async function GET() {
  try {
    const user = await requireUser();
    const db = await getSupabaseServerClient();
    const docs = await listOwnedDocuments(db, user.id);
    return NextResponse.json({ documents: docs });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    let title = "Untitled document";
    try {
      const body = (await req.json()) as { title?: string };
      if (body?.title) title = documentTitleSchema.parse(body.title);
    } catch {
      // keep default title on empty/invalid body
    }
    const db = await getSupabaseServerClient();
    const { createDocument } = await import("@/services/documents");
    const doc = await createDocument(db, user.id, title, emptyDoc());
    return NextResponse.json({ document: doc }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message.includes("check")) return jsonError(400, "Invalid title");
    return handleApiError(err);
  }
}
