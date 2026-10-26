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
  return /\.(txt|md|docx)$/i.test(name);
}

export function isSupportedImportMime(mime: string): boolean {
  if (!mime) return false;
  return (SUPPORTED_IMPORT_TYPES as readonly string[]).includes(mime);
}
