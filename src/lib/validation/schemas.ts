import { z } from "zod";

export const emptyDoc = () => ({
  type: "doc",
  content: [{ type: "paragraph" }],
});

export const tiptapNodeSchema: z.ZodType<unknown> = z.lazy(() =>
  z.object({
    type: z.string(),
    attrs: z.record(z.string(), z.unknown()).optional(),
    content: z.array(tiptapNodeSchema).optional(),
    marks: z
      .array(
        z.object({
          type: z.string(),
          attrs: z.record(z.string(), z.unknown()).optional(),
        })
      )
      .optional(),
    text: z.string().optional(),
  })
);

export const documentContentSchema = z
  .object({
    type: z.literal("doc"),
    content: z.array(tiptapNodeSchema).max(2000),
  })
  .passthrough();

export type DocumentContent = z.infer<typeof documentContentSchema>;

export const documentTitleSchema = z
  .string()
  .transform((s) => s.trim())
  .refine((s) => s.length > 0, "Title cannot be empty")
  .refine((s) => s.length <= 200, "Title must be at most 200 characters");

export const documentIdSchema = z.string().uuid("Invalid document id");

export const updateDocumentSchema = z
  .object({
    title: documentTitleSchema.optional(),
    content: documentContentSchema.optional(),
    expectedVersion: z.number().int().optional(),
  })
  .refine((v) => v.title !== undefined || v.content !== undefined, {
    message: "Nothing to update",
  });

export const permissionSchema = z.enum(["viewer", "editor"]);
export type Permission = z.infer<typeof permissionSchema>;

export const createShareSchema = z.object({
  email: z.string().email("Enter a valid email"),
  permission: permissionSchema,
});

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024; // 5 MB

export const SUPPORTED_IMPORT_TYPES = [
  "text/plain",
  "text/markdown",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export function isSupportedImportName(name: string): boolean {
  return /\.(txt|md|markdown|docx)$/i.test(name);
}

/**
 * MIME check is advisory, not authoritative:
 * - Browsers frequently send an EMPTY type or `application/octet-stream` for
 *   `.md` (and sometimes `.txt`) because those extensions are not registered.
 * - The real gate is the extension check plus parser-level validation
 *   (UTF-8 decode for text, ZIP magic bytes for DOCX).
 *
 * @param mime      The reported content type (may be empty).
 * @param fileName  Optional filename; when supplied, per-format aliases are allowed.
 */
export function isSupportedImportMime(mime: string, fileName?: string): boolean {
  const m = (mime ?? "").split(";")[0].trim().toLowerCase();
  if (!m || m === "application/octet-stream") return true; // unknown type → rely on extension + parser
  if ((SUPPORTED_IMPORT_TYPES as readonly string[]).includes(m)) return true;

  const name = (fileName ?? "").toLowerCase();
  if (name.endsWith(".md") || name.endsWith(".markdown")) {
    return m === "text/x-markdown" || m === "text/plain";
  }
  if (name.endsWith(".txt")) return m.startsWith("text/");
  if (name.endsWith(".docx")) {
    return m === "application/zip" || m === "application/msword" || m === "application/docx";
  }
  return false;
}
