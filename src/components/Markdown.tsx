import { useState } from "react";
import { Check, Download } from "lucide-react";
import { copyText } from "../lib/luca";

/* Small, safe markdown subset renderer: paragraphs, headings, **bold**,
   *italic*, `inline code`, [links](url), > quotes, - / 1. lists, ```fences```. */

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(text: string): string {
  let s = escapeHtml(text);
  s = s.replace(/`([^`]+)`/g, '<code class="font-mono text-[13px] px-1.5 py-px rounded-md bg-surface3 border border-linestrong/70 text-ink whitespace-nowrap">$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer" class="text-accent hover:underline underline-offset-2">$1</a>');
  return s;
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const download = () => {
    const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "luca-snippet." + (lang || "txt");
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-line bg-[#151515]">
      <div className="flex items-center justify-between border-b border-line bg-surface2/70 px-3.5 py-1.5">
        <span className="font-mono text-[11px] tracking-wide text-mute">{lang || "text"}</span>
        <div className="flex gap-0.5">
          <button
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-mute transition-colors hover:bg-surface3 hover:text-ink"
            onClick={async () => {
              if (await copyText(code)) {
                setCopied(true);
                setTimeout(() => setCopied(false), 1400);
              }
            }}
            aria-label="Copy code"
          >
            {copied ? <Check size={13} className="text-ok" /> : <span className="inline-flex"><CopyGlyph /></span>}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-mute transition-colors hover:bg-surface3 hover:text-ink"
            onClick={download}
            aria-label="Download code"
          >
            <Download size={13} /> Download
          </button>
        </div>
      </div>
      <pre className="overflow-x-auto px-4 py-3 font-mono text-[13px] leading-relaxed text-[#e2e2e2]">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function CopyGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    </svg>
  );
}

interface Block {
  type: "code" | "html";
  lang?: string;
  content: string;
}

function parseBlocks(md: string): Block[] {
  const blocks: Block[] = [];
  const parts = md.split("```");
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (i % 2 === 1) {
      const nl = part.indexOf("\n");
      const lang = nl === -1 ? "" : part.slice(0, nl).trim();
      const code = nl === -1 ? part : part.slice(nl + 1);
      blocks.push({ type: "code", lang, content: code.replace(/\n$/, "") });
    } else if (part.trim()) {
      blocks.push({ type: "html", content: renderLines(part.trim()) });
    }
  }
  return blocks;
}

function renderLines(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let list: string[] = [];
  let olist: string[] = [];
  let quote: string[] = [];
  let para: string[] = [];

  const flushList = () => {
    if (list.length) {
      out.push('<ul class="grid gap-1.5 pl-5 list-disc mb-3 marker:text-mute">' + list.map((l) => `<li>${inline(l)}</li>`).join("") + "</ul>");
      list = [];
    }
  };
  const flushOlist = () => {
    if (olist.length) {
      out.push('<ol class="grid gap-1.5 pl-5 list-decimal mb-3 marker:text-mute">' + olist.map((l) => `<li>${inline(l)}</li>`).join("") + "</ol>");
      olist = [];
    }
  };
  const flushQuote = () => {
    if (quote.length) {
      out.push('<blockquote class="border-l-2 border-linestrong pl-4 my-3 text-[15px] text-ink/90">' + quote.map((l) => inline(l)).join("<br/>") + "</blockquote>");
      quote = [];
    }
  };
  const flushPara = () => {
    if (para.length) {
      out.push('<p class="mb-3 last:mb-0">' + para.map((l) => inline(l)).join("<br/>") + "</p>");
      para = [];
    }
  };
  const flushAll = () => {
    flushList();
    flushOlist();
    flushQuote();
    flushPara();
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const t = line.trim();
    if (/^```/.test(t)) continue;
    if (!t) {
      flushAll();
      continue;
    }
    const h = t.match(/^(#{1,3})\s+(.*)/);
    if (h) {
      flushAll();
      const lvl = h[1].length;
      const cls =
        lvl === 1
          ? "font-display font-semibold text-xl mt-4 mb-2"
          : lvl === 2
            ? "font-display font-semibold text-lg mt-4 mb-2"
            : "font-semibold text-[15px] mt-3 mb-1.5";
      out.push(`<div class="${cls}">${inline(h[2])}</div>`);
      continue;
    }
    const ul = t.match(/^[-*]\s+(.*)/);
    if (ul) {
      flushOlist();
      flushQuote();
      flushPara();
      list.push(ul[1]);
      continue;
    }
    const ol = t.match(/^\d+\.\s+(.*)/);
    if (ol) {
      flushList();
      flushQuote();
      flushPara();
      olist.push(ol[1]);
      continue;
    }
    if (t.startsWith("> ")) {
      flushList();
      flushOlist();
      flushPara();
      quote.push(t.slice(2));
      continue;
    }
    flushList();
    flushOlist();
    flushQuote();
    para.push(t);
  }
  flushAll();
  return out.join("");
}

export default function Markdown({ text }: { text: string }) {
  const blocks = parseBlocks(text);
  return (
    <div className="text-[16px] leading-[1.68] md:text-[15px]">
      {blocks.map((b, i) =>
        b.type === "code" ? (
          <CodeBlock key={i} lang={b.lang || ""} code={b.content} />
        ) : (
          <div key={i} dangerouslySetInnerHTML={{ __html: b.content }} />
        ),
      )}
    </div>
  );
}
