
import { describe, it, expect } from "vitest";
import { parseTxt, parseMarkdown } from "@/lib/import/parsers";

describe("txt parser", () => {
  it("converts paragraphs into tiptap paragraph nodes", () => {
    const { content, title } = parseTxt(
      "notes.txt",
      "First paragraph.\n\nSecond paragraph."
    );

    expect(title).toBe("notes");
    expect(content.type).toBe("doc");
    expect(content.content).toHaveLength(2);
    expect(content.content![0].type).toBe("paragraph");
    expect(content.content![0].content![0].text).toBe("First paragraph.");
  });

  it("returns a single empty paragraph for empty files", () => {
    const { content } = parseTxt("empty.txt", "");

    expect(content.content).toEqual([
      { type: "paragraph", content: [] },
    ]);
  });

  it("strips BOM characters", () => {
    const { content } = parseTxt("bom.txt", "\uFEFFHello");

    expect(content.content![0].content![0].text).toBe("Hello");
  });

  it("derives title without extension", () => {
    expect(parseTxt("My Notes.txt", "x").title).toBe("My Notes");
  });
});

describe("markdown parser", () => {
  it("converts headings, paragraphs and emphasis", async () => {
    const { content } = await parseMarkdown(
      "doc.md",
      "# Title\n\nSome **bold** and *italic* text."
    );

    expect(content.type).toBe("doc");

    const heading = content.content![0];
    expect(heading.type).toBe("heading");
    expect(heading.attrs!.level).toBe(1);

    const para = content.content![1];
    expect(para.type).toBe("paragraph");

    const texts = para.content!.map((node) => ({
      text: node.text,
      marks: node.marks?.map((mark) => mark.type),
    }));

    expect(texts).toContainEqual({
      text: "bold",
      marks: ["bold"],
    });

    expect(texts).toContainEqual({
      text: "italic",
      marks: ["italic"],
    });
  });

  it("converts bullet and ordered lists", async () => {
    const { content } = await parseMarkdown(
      "list.md",
      "- One\n- Two\n\n1. First\n2. Second"
    );

    const bullet = content.content!.find(
      (node) => node.type === "bulletList"
    );

    const ordered = content.content!.find(
      (node) => node.type === "orderedList"
    );

    expect(bullet).toBeDefined();
    expect(ordered).toBeDefined();
    expect(bullet!.content).toHaveLength(2);
    expect(bullet!.content![0].type).toBe("listItem");
  });

  it("does not interpret raw html as trusted content", async () => {
    const { content } = await parseMarkdown(
      "evil.md",
      "<script>alert(1)</script>\n\n<script>alert(2)</script>"
    );

    const allText = JSON.stringify(content);
    expect(allText).not.toContain("<script");
  });

  it("falls back to an empty paragraph for an empty file", async () => {
    const { content } = await parseMarkdown("empty.md", "");

    expect(content.content).toEqual([
      { type: "paragraph", content: [] },
    ]);
  });
});
