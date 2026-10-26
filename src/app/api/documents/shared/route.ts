import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { listSharedDocuments } from "@/services/documents";
import { handleApiError, requireUser } from "@/lib/api/helpers";

export async function GET() {
  try {
    const user = await requireUser();
    const db = await getSupabaseServerClient();
    const docs = await listSharedDocuments(db, user.id);
    return NextResponse.json({ documents: docs });
  } catch (err) {
    return handleApiError(err);
  }
}
