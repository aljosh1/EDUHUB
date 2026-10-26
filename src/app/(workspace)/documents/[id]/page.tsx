
import { notFound } from "next/navigation";
import {
  getSupabaseServerClient,
  getAuthenticatedUser,
} from "@/lib/supabase/server";
import { getAuthorizedDocument } from "@/services/documents";
import { DocumentEditor } from "@/components/editor/DocumentEditor";

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await getAuthenticatedUser();
  if (!user) notFound();

  const db = await getSupabaseServerClient();
  const found = await getAuthorizedDocument(db, id, user.id);
  if (!found) notFound();

  const role = found.perms.role;

  if (role === "none") {
    notFound();
  }

  return (
    <DocumentEditor
      doc={{
        id: found.doc.id,
        title: found.doc.title,
        content: found.doc.content,
        owner_id: found.doc.owner_id,
        updated_at: found.doc.updated_at,
      }}
      role={role}
    />
  );
}
