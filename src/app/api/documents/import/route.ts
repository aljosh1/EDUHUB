import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { createDocument } from "@/services/documents";
import { MAX_IMPORT_BYTES, isSupportedImportName, isSupportedImportMime, emptyDoc } from "@/lib/validation/schemas";
import { parseTxt, parseMarkdown, parseDocx } from "@/lib/import/parsers";
import { handleApiError, jsonError, requireUser } from "@/lib/api/helpers";
import { HttpError } from "@/services/documents";


export async function POST(req: Request) {
  try {
    const user = await requireUser();
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return jsonError(400, "Expected a multipart form with a 'file' field");
    }
    const file = form.get("file");
    if (!(file instanceof File)) return jsonError(400, "Missing 'file' field");

    // Size check (server-authoritative)
    if (file.size > MAX_IMPORT_BYTES) {
      return jsonError(413, `File exceeds the ${MAX_IMPORT_BYTES / (1024 * 1024)} MB import limit`);
    }
    if (file.size === 0) return jsonError(400, "File is empty");

    // Extension AND MIME must both be acceptable
    if (!isSupportedImportName(file.name)) return jsonError(415, "Unsupported file type. Supported: .txt, .md, .docx");
    if (!isSupportedImportMime(file.type, file.name)) return jsonError(415, "Unsupported file content type. Supported: .txt, .md, .docx");

    const lower = file.name.toLowerCase();
    let parsed;
    if (lower.endsWith(".txt")) {
      const text = await file.text();
      // Basic encoding sanity: reject if replacement chars dominate (likely binary)
      const bad = (text.match(/\uFFFD/g) ?? []).length;
      if (text.length > 0 && bad / text.length > 0.05) {
        return jsonError(415, "File does not appear to be valid UTF-8 text");
      }
      parsed = parseTxt(file.name, text);
    } else if (lower.endsWith(".md")) {
      const text = await file.text();
      parsed = await parseMarkdown(file.name, text);
    } else if (lower.endsWith(".docx")) {
      // DOCX magic bytes: PK\x03\x04
      const buf = Buffer.from(await file.arrayBuffer());
      if (!(buf[0] === 0x50 && buf[1] === 0x4b && (buf[2] === 0x03 || buf[2] === 0x05) && buf[3] === 0x04)) {
        return jsonError(415, "File is not a valid DOCX document");
      }
      parsed = await parseDocx(file.name, buf);
    } else {
      return jsonError(415, "Unsupported file type");
    }

    const db = await getSupabaseServerClient();
    const doc = await createDocument(db, user.id, parsed.title || "Imported document", parsed.content || emptyDoc());
    return NextResponse.json({ document: doc }, { status: 201 });
  } catch (err) {
    if (err instanceof HttpError) return handleApiError(err);
    const message = err instanceof Error ? err.message : "Import failed";
    // Never expose stack traces or file paths
    return jsonError(422, `Import failed: ${message.slice(0, 200)}`);
  }
}
