/**
 * File import parsers: TXT, Markdown, DOCX → Tiptap JSON.
 * All parsers return { type: "doc", content: [...] } structures.
 */

export interface TiptapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  marks?: TiptapMark[];
  text?: string;
}

export interface ParsedDocument {
  title: string;
  content: TiptapNode;
}

function doc(content: TiptapNode[]): TiptapNode {
  return { type: "doc", content };
}
function p(children: TiptapNode[]): TiptapNode {
  return { type: "paragraph", content: children };
}
function t(text: string, marks: TiptapMark[] = []): TiptapNode {
  const node: TiptapNode = { type: "text", text };
  if (marks.length) node.marks = marks;
  return node;
}

export function parseTxt(name: string, raw: string): ParsedDocument {
  const text = raw.replace(/^\uFEFF/, ""); // strip BOM
  const paragraphs = text
    .split(/\r?\n\s*\r?\n|\r?\n/) // blank lines OR single newlines → paragraph breaks
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const content = paragraphs.length
    ? paragraphs.map((para) => p([t(para)]))
    : [p([])];
  const base = name.replace(/\.[^.]+$/, "") || "Imported document";
  return { title: base, content: doc(content) };
}

// ---------- Markdown ----------
// Minimal, safe markdown→tiptap converter covering: headings, paragraphs,
// bold/italic, bullet lists, ordered lists. We deliberately do NOT parse
// raw HTML blocks from .md files for security reasons.
import { marked } from "marked";

export async function parseMarkdown(name: string, raw: string): Promise<ParsedDocument> {
  const tokens = marked.lexer(raw);
  const nodes: TiptapNode[] = [];

  function inlineToNodes(md: string): TiptapNode[] {
    const out: TiptapNode[] = [];
    const inlineTokens = marked.lexer(md, { async: false })[0]?.type === "paragraph"
      ? (marked.lexer(md, { async: false })[0] as { tokens?: unknown[] }).tokens ?? []
      : [];
    for (const it of inlineTokens as Array<Record<string, unknown>>) {
      if (it.type === "text" && typeof it.text === "string") {
        out.push(t(it.text, []));
      } else if (it.type === "strong") {
        const inner = (it.tokens ?? []) as Array<Record<string, unknown>>;
        for (const n of inner) {
          if (n.type === "text" && typeof n.text === "string") out.push(t(n.text, [{ type: "bold" }]));
        }
      } else if (it.type === "em") {
        const inner = (it.tokens ?? []) as Array<Record<string, unknown>>;
        for (const n of inner) {
          if (n.type === "text" && typeof n.text === "string") out.push(t(n.text, [{ type: "italic" }]));
        }
      } else if (it.type === "codespan" && typeof it.text === "string") {
        out.push(t(it.text, [{ type: "code" }]));
      }
    }
    return out.length ? out : [t(md)];
  }

  for (const tok of tokens) {
    const tk = tok as Record<string, unknown> & { type: string };
    if (tk.type === "heading") {
      const depth = Math.min(Number(tk.depth) || 1, 6);
      nodes.push({ type: "heading", attrs: { level: depth }, content: inlineToNodes(String(tk.text ?? "")) });
    } else if (tk.type === "paragraph") {
      const md = String(tk.text ?? "");
      nodes.push(p(inlineToNodes(md)));
    } else if (tk.type === "list") {
      const ordered = Boolean(tk.ordered);
      const items = (tk.items ?? []) as Array<Record<string, unknown>>;
      const listItems: TiptapNode[] = items.map((li) => {
        const liTokens = (li.tokens ?? []) as Array<Record<string, unknown>>;
        const paras: TiptapNode[] = [];
        for (const lt of liTokens) {
          if (lt.type === "text") {
            paras.push({ type: "paragraph", content: inlineToNodes(String(lt.text ?? "")) });
          }
        }
        return { type: "listItem", content: paras.length ? paras : [p([])] };
      });
      nodes.push({ type: ordered ? "orderedList" : "bulletList", content: listItems });
    } else if (tk.type === "space") {
      continue;
    } else if (tk.type === "code") {
      nodes.push({ type: "codeBlock", attrs: { language: (tk.lang as string) ?? null }, content: [t(String(tk.text ?? ""))] });
    }
    // Other token types (blockquotes, html, tables, etc.) are intentionally skipped.
  }

  const base = name.replace(/\.[^.]+$/, "") || "Imported document";
  return { title: base, content: doc(nodes.length ? nodes : [p([])]) };
}

// ---------- DOCX ----------
import mammoth from "mammoth";

interface MammothElement {
  type: string;
  tagName?: string | null;
  children?: MammothElement[];
  value?: string;
}

export function parseDocx(name: string, buffer: Buffer): Promise<ParsedDocument> {
  return mammoth
    .convertToHtml({ buffer })
    .then(({ value: html }) => {
      // Parse the HTML produced by mammoth with a minimal, trusted-tag-only parser.
      // mammoth output is a limited subset: p, h1-h6, strong/em/b/i, u, ul/ol/li, br.
      const nodes: TiptapNode[] = [];
      const blockRe = /<(p|h[1-6]|li)[^>]*>([\s\S]*?)<\/\1>/gi;
      let match: RegExpExecArray | null;
      while ((match = blockRe.exec(html))) {
        const tag = match[1].toLowerCase();
        const inner = match[2];
        if (tag === "li") continue; // handled with its list wrapper below

        const level = /^h([1-6])$/i.exec(tag);
        const runs = parseRuns(inner);
        if (level) {
          nodes.push({ type: "heading", attrs: { level: Number(level[1]) }, content: runs });
        } else {
          nodes.push(p(runs));
        }
      }

      // Lists: find <ul>/<ol> blocks and convert their <li> children
      const listRe = /<(ul|ol)[^>]*>([\s\S]*?)<\/\1>/gi;
      let lmatch: RegExpExecArray | null;
      while ((lmatch = listRe.exec(html))) {
        const ordered = lmatch[1].toLowerCase() === "ol";
        const items: TiptapNode[] = [];
        const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
        let liMatch: RegExpExecArray | null;
        while ((liMatch = liRe.exec(lmatch[2]))) {
          items.push({ type: "listItem", content: [p(parseRuns(liMatch[1]))] });
        }
        if (items.length) {
          nodes.push({ type: ordered ? "orderedList" : "bulletList", content: items });
        }
      }

      const base = name.replace(/\.[^.]+$/, "") || "Imported document";
      return { title: base, content: doc(nodes.length ? nodes : [p([])]) };
    })
    .catch((err: unknown) => {
      throw new Error(`Failed to parse DOCX file: ${err instanceof Error ? err.message : "unknown error"}`);
    });
}

/** Convert inline HTML runs (strong/b/em/i/u) to tiptap nodes. Only trusted tags. */
function parseRuns(html: string): TiptapNode[] {
  const out: TiptapNode[] = [];
  const re = /<(strong|b|em|i|u)>[\s\S]*?<\/\1>|[^<]+/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const seg = m[0];
    const tagMatch = /^<(strong|b|em|i|u)>([\s\S]*?)<\/\1>$/i.exec(seg);
    if (tagMatch) {
      const tag = tagMatch[1].toLowerCase();
      const mark = tag === "strong" || tag === "b" ? "bold" : tag === "em" || tag === "i" ? "italic" : "underline";
      const text = tagMatch[2].replace(/<[^>]+>/g, "");
      if (text) out.push(t(text, [{ type: mark }]));
    } else {
      const text = seg
        .replace(/<br\s*\/?\s*>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">");
      if (text) {
        // split on newlines from <br>
        for (const line of text.split("\n")) {
          if (line) out.push(t(line));
        }
      }
    }
  }
  return out.length ? out : [t("")];
}
