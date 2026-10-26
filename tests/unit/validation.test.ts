import { describe, it, expect } from "vitest";
import {
  documentTitleSchema,
  documentContentSchema,
  documentIdSchema,
  createShareSchema,
  isSupportedImportName,
  isSupportedImportMime,
  MAX_IMPORT_BYTES,
  emptyDoc,
} from "@/lib/validation/schemas";

describe("document title validation", () => {
  it("accepts a normal title", () => {
    expect(documentTitleSchema.parse("My Doc")).toBe("My Doc");
  });

  it("trims surrounding whitespace", () => {
    expect(documentTitleSchema.parse("  Hello  ")).toBe("Hello");
  });

  it("rejects whitespace-only titles", () => {
    expect(() => documentTitleSchema.parse("   ")).toThrow();
  });

  it("rejects empty titles", () => {
    expect(() => documentTitleSchema.parse("")).toThrow();
  });

  it("rejects titles over 200 characters", () => {
    expect(() => documentTitleSchema.parse("x".repeat(201))).toThrow();
    expect(documentTitleSchema.parse("x".repeat(200))).toBe("x".repeat(200));
  });
});

describe("editor content validation", () => {
  it("accepts a valid empty tiptap doc", () => {
    expect(() => documentContentSchema.parse(emptyDoc())).not.toThrow();
  });

  it("accepts nested content", () => {
    expect(() =>
      documentContentSchema.parse({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Hi", marks: [{ type: "bold" }] }],
          },
        ],
      })
    ).not.toThrow();
  });

  it("rejects a doc without type=doc", () => {
    expect(() => documentContentSchema.parse({ type: "paragraph", content: [] })).toThrow();
  });

  it("rejects arrays or scalars", () => {
    expect(() => documentContentSchema.parse([1, 2, 3])).toThrow();
    expect(() => documentContentSchema.parse("hello")).toThrow();
    expect(() => documentContentSchema.parse(null)).toThrow();
  });
});

describe("document id validation", () => {
  it("accepts a valid uuid", () => {
    expect(() => documentIdSchema.parse("00000000-0000-4000-8000-000000000000")).not.toThrow();
  });
  it("rejects non-uuids", () => {
    expect(() => documentIdSchema.parse("not-a-uuid")).toThrow();
    expect(() => documentIdSchema.parse("../etc/passwd")).toThrow();
  });
});

describe("share payload validation", () => {
  it("accepts valid share payload", () => {
    expect(createShareSchema.parse({ email: "a@b.com", permission: "viewer" })).toEqual({
      email: "a@b.com",
      permission: "viewer",
    });
  });
  it("rejects invalid permission values", () => {
    expect(() => createShareSchema.parse({ email: "a@b.com", permission: "admin" })).toThrow();
  });
  it("rejects invalid emails", () => {
    expect(() => createShareSchema.parse({ email: "nope", permission: "viewer" })).toThrow();
  });
});

describe("file import validation", () => {
  it("accepts supported extensions", () => {
    expect(isSupportedImportName("notes.txt")).toBe(true);
    expect(isSupportedImportName("README.md")).toBe(true);
    expect(isSupportedImportName("report.docx")).toBe(true);
  });
  it("rejects unsupported extensions", () => {
    expect(isSupportedImportName("virus.exe")).toBe(false);
    expect(isSupportedImportName("image.png")).toBe(false);
    expect(isSupportedImportName("script.js")).toBe(false);
    expect(isSupportedImportName("noext")).toBe(false);
  });
  it("validates mime types", () => {
    expect(isSupportedImportMime("text/plain")).toBe(true);
    expect(isSupportedImportMime("text/markdown")).toBe(true);
    expect(isSupportedImportMime("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe(true);
    expect(isSupportedImportMime("application/x-msdownload")).toBe(false);
  });
  it("enforces 5MB limit constant", () => {
    expect(MAX_IMPORT_BYTES).toBe(5 * 1024 * 1024);
  });
});
