import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";

/* Lightweight markdown renderer for assistant replies: paragraphs, bold,
   italics, inline code, links, lists, headings, quotes, fenced code blocks. */

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(text: string): string {
  let s = escapeHtml(text);
  s = s.replace(/`([^`]+)`/g, '<code class="inline">$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  s = s.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  );
  return s;
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400); // TIMINGS.COPY_FEEDBACK
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <div className="code-block">
      <div className="code-head">
        <span>{lang}</span>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] text-mute transition-colors hover:bg-row hover:text-ink normal-case tracking-normal font-body"
        >
          {copied ? <Check size={12} className="text-accent" /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function Markdown({ text }: { text: string }) {
  const blocks = useMemo(() => {
    const out: { type: "html" | "code"; html?: string; lang?: string; code?: string }[] = [];
    const lines = text.split("\n");
    let buf: string[] = [];
    let i = 0;
    const flush = () => {
      if (!buf.length) return;
      const html: string[] = [];
      let list: "ul" | "ol" | null = null;
      const closeList = () => {
        if (list) {
          html.push(list === "ul" ? "</ul>" : "</ol>");
          list = null;
        }
      };
      for (const raw of buf) {
        const line = raw.trimEnd();
        if (/^\s*[-*]\s+/.test(line)) {
          if (list !== "ul") {
            closeList();
            html.push("<ul>");
            list = "ul";
          }
          html.push(`<li>${inline(line.replace(/^\s*[-*]\s+/, ""))}</li>`);
          continue;
        }
        if (/^\s*\d+\.\s+/.test(line)) {
          if (list !== "ol") {
            closeList();
            html.push("<ol>");
            list = "ol";
          }
          html.push(`<li>${inline(line.replace(/^\s*\d+\.\s+/, ""))}</li>`);
          continue;
        }
        closeList();
        if (/^###\s+/.test(line)) html.push(`<h3>${inline(line.slice(4))}</h3>`);
        else if (/^##\s+/.test(line)) html.push(`<h2>${inline(line.slice(3))}</h2>`);
        else if (/^#\s+/.test(line)) html.push(`<h1>${inline(line.slice(2))}</h1>`);
        else if (/^>\s?/.test(line)) html.push(`<blockquote>${inline(line.replace(/^>\s?/, ""))}</blockquote>`);
        else if (line.trim() === "") html.push("");
        else html.push(`<p>${inline(line)}</p>`);
      }
      closeList();
      out.push({ type: "html", html: html.join("") });
      buf = [];
    };

    while (i < lines.length) {
      const m = lines[i].match(/^```(\w*)/);
      if (m) {
        flush();
        const lang = (m[1] || "text").toLowerCase();
        const code: string[] = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i])) {
          code.push(lines[i]);
          i++;
        }
        i++; // skip closing fence
        out.push({ type: "code", lang, code: code.join("\n") });
        continue;
      }
      buf.push(lines[i]);
      i++;
    }
    flush();
    return out;
  }, [text]);

  return (
    <div className="md text-[14.5px] text-ink/95">
      {blocks.map((b, idx) =>
        b.type === "code" ? (
          <CodeBlock key={idx} lang={b.lang || "text"} code={b.code || ""} />
        ) : (
          <div key={idx} dangerouslySetInnerHTML={{ __html: b.html || "" }} />
        ),
      )}
    </div>
  );
}
