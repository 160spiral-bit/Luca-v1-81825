import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  Check,
  ChevronDown,
  Copy,
  FileText,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import Markdown from "./Markdown";
import type { LucaMessage, LucaSession, LucaUser, ToolRound } from "../lib/luca";
import { MODELS } from "../lib/luca";

/* ── greeting pools — verbatim from luca-app.js ── */
const HERO_HEADINGS_QUESTION = [
  "What are you working on",
  "Where should we start",
  "What can I help you build",
  "What are you thinking through",
  "What's on your mind",
  "What should we dive into",
  "What are we creating today",
  "What's next",
  "How can I help",
  "What are you exploring",
  "What can I take off your plate",
  "What are we figuring out today",
];
const HERO_HEADINGS_STATEMENT = ["Ready when you are", "Let's get started"];
/* HERO_PROMPT_POOL in luca-app.js ships empty; seeded here so the hero samples 4 */
const HERO_PROMPT_POOL = [
  "Explain quantum tunnelling like I'm a curious 12-year-old",
  "Draft a launch tweet thread for a dark-mode-first notes app",
  "Find the latest releases in the React ecosystem this week",
  "Write a TypeScript debounce with full typings",
  "Plan a 3-day first-time trip to Kyoto",
  "Turn my rough meeting notes into a crisp summary",
  "Why do neural networks need non-linear activations?",
  "Give me five name ideas for a coffee-flavored stout",
  "Review this SQL query for indexing problems",
  "What changed in the newest ECMAScript proposal?",
];

function timeOfDayGreeting() {
  const hour = new Date().getHours();
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatThinkingDuration(ms: number) {
  const s = ms / 1000;
  return s < 1 ? "a moment" : `${s.toFixed(s < 10 ? 1 : 0)}s`;
}

function formatTimestamp(ts: number) {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === now.toDateString()) return time;
  return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${time}`;
}

function modelTag(modelId?: string) {
  const m = MODELS.find((x) => x.id === modelId);
  return m?.label || "Luca";
}

/* ── collapsible thinking block ── */
function ThinkingBlock({ msg }: { msg: LucaMessage }) {
  const active = !!msg.isStreaming && !!msg.thinkingActive;
  const [open, setOpen] = useState(true);
  const expanded = msg.thinkingExpanded !== undefined ? msg.thinkingExpanded : open;
  return (
    <div
      className={`mb-2 overflow-hidden rounded-xl border transition-colors duration-200 ${
        active ? "border-accent/25 bg-accent/[0.04]" : "border-line bg-panel/50"
      }`}
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
        aria-expanded={expanded}
      >
        {active ? (
          <Loader2 size={13} className="shrink-0 animate-spin text-accent" />
        ) : (
          <ChevronDown
            size={13}
            className={`shrink-0 text-mute transition-transform duration-200 ${expanded ? "" : "-rotate-90"}`}
          />
        )}
        <span className={`text-[12.5px] font-medium ${active ? "shimmer-text" : "text-mute"}`}>
          {active
            ? "Thinking…"
            : `Thought for ${formatThinkingDuration(msg.thinkingMs || 0)}`}
        </span>
      </button>
      {expanded && (msg.reasoning || active) && (
        <div className="anim-fade border-t border-line/60 px-3.5 py-2.5 text-[13px] leading-relaxed text-mute">
          {msg.reasoning}
          {active && <span className="stream-caret !h-[0.95em] !w-[5px]" />}
        </div>
      )}
    </div>
  );
}

/* ── one tool-call round (web_search etc.) ── */
function ToolCallItem({ entry }: { entry: ToolRound }) {
  const [open, setOpen] = useState(false);
  const running = entry.status === "running";
  const label =
    entry.name === "web_search"
      ? `Searching the web for "${(() => {
          try {
            return JSON.parse(entry.argsRaw || "{}").query || "";
          } catch {
            return "";
          }
        })()}"`
      : entry.name === "read_file"
        ? `Reading "${(() => {
            try {
              return JSON.parse(entry.argsRaw || "{}").filename || "";
            } catch {
              return "";
            }
          })()}"`
        : entry.name || "Using a tool";

  let argsPretty = entry.argsRaw;
  try {
    const a = JSON.parse(entry.argsRaw || "{}");
    argsPretty = Object.entries(a)
      .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v, null, 2)}`)
      .join("\n");
  } catch {
    /* keep raw */
  }

  return (
    <div className="mb-1.5 overflow-hidden rounded-xl border border-line bg-panel/50">
      <button
        onClick={() => !running && setOpen(!open)}
        className={`flex w-full items-center gap-2 px-3 py-2 text-left ${running ? "" : "hover:bg-panel"}`}
        aria-expanded={open}
      >
        {running ? (
          <Loader2 size={13} className="shrink-0 animate-spin text-accent" />
        ) : entry.name === "web_search" ? (
          <Search size={13} className="shrink-0 text-mute" />
        ) : (
          <FileText size={13} className="shrink-0 text-mute" />
        )}
        <span className={`flex-1 text-[12.5px] font-medium ${running ? "shimmer-text" : "text-ink/85"}`}>
          {label}
        </span>
        {!running && (
          <ChevronDown
            size={13}
            className={`text-mute transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
          />
        )}
      </button>
      {open && !running && (
        <div className="anim-fade grid gap-2.5 border-t border-line/60 px-3.5 py-3">
          <div>
            <div className="pb-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-mute">Input</div>
            <pre className="whitespace-pre-wrap rounded-lg bg-canvas px-3 py-2 font-mono text-[11.5px] leading-relaxed text-ink/80">
              {argsPretty}
            </pre>
          </div>
          {entry.name === "web_search" && entry.searchResults?.length ? (
            <div>
              <div className="pb-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-mute">Results</div>
              <div className="grid gap-1.5">
                {entry.searchResults.map((r, i) => (
                  <a
                    key={i}
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block rounded-lg border border-line bg-canvas px-3 py-2 transition-colors hover:border-accent/40"
                  >
                    <div className="truncate text-[12.5px] font-medium text-accent group-hover:underline">
                      {r.title || r.url}
                    </div>
                    <div className="truncate text-[11px] text-mute">{r.url}</div>
                    {r.snippet && <div className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-ink/60">{r.snippet}</div>}
                  </a>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div className="pb-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-mute">
                {entry.status === "error" ? "Error" : "Result"}
              </div>
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-canvas px-3 py-2 font-mono text-[11.5px] leading-relaxed text-ink/80">
                {String(entry.result || "").slice(0, 4000)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── a single message row ── */
function MessageRow(props: {
  msg: LucaMessage;
  showTimestamps: boolean;
  editing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: (text: string) => void;
  onRegenerate: () => void;
}) {
  const { msg, showTimestamps } = props;
  const [copied, setCopied] = useState(false);
  const [draft, setDraft] = useState(msg.content);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (props.editing) {
      setDraft(msg.content);
      setTimeout(() => {
        const ta = taRef.current;
        if (ta) {
          ta.focus();
          ta.selectionStart = ta.selectionEnd = ta.value.length;
          ta.style.height = "auto";
          ta.style.height = ta.scrollHeight + "px";
        }
      }, 10);
    }
  }, [props.editing]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* ignore */
    }
  };

  /* ── user message ── */
  if (msg.role === "user") {
    if (props.editing) {
      return (
        <div className="anim-fade mx-auto w-full max-w-[780px] px-4 py-2">
          <div className="rounded-[22px] border border-edge bg-well p-3">
            <textarea
              ref={taRef}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = e.target.scrollHeight + "px";
              }}
              className="w-full resize-none bg-transparent text-[14.5px] leading-relaxed text-ink outline-none"
            />
            <div className="mt-1 flex justify-end gap-2">
              <button
                onClick={props.onCancelEdit}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium text-mute hover:bg-canvas hover:text-ink"
              >
                <X size={13} /> Cancel
              </button>
              <button
                onClick={() => props.onSaveEdit(draft.trim())}
                disabled={!draft.trim()}
                className="flex items-center gap-1.5 rounded-full bg-accent-strong px-3 py-1.5 text-[12.5px] font-semibold text-canvas transition-colors hover:bg-accent disabled:opacity-40"
              >
                <Check size={13} /> Save & submit
              </button>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="group anim-rise mx-auto flex w-full max-w-[780px] justify-end px-4 py-2">
        <div className="relative max-w-[85%]">
          <div className="flex items-center gap-1.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 absolute -left-16 top-1/2 -translate-y-1/2">
            <button onClick={copy} className="rounded-md p-1.5 text-mute hover:bg-panel hover:text-ink" title="Copy">
              {copied ? <Check size={14} className="text-accent" /> : <Copy size={14} />}
            </button>
            <button
              onClick={props.onStartEdit}
              className="rounded-md p-1.5 text-mute hover:bg-panel hover:text-ink"
              title="Edit message"
            >
              <Pencil size={14} />
            </button>
          </div>
          {msg.attachments && msg.attachments.length > 0 && (
            <div className="mb-1.5 flex flex-wrap justify-end gap-1.5">
              {msg.attachments.map((a) => (
                <span
                  key={a.id}
                  className="flex items-center gap-1.5 rounded-lg border border-line bg-panel px-2 py-1 text-[11.5px] text-ink/80"
                >
                  {a.isImage ? (
                    a.dataUrl ? (
                      <img src={a.dataUrl} alt="" className="h-8 w-8 rounded-md object-cover" />
                    ) : (
                      "image"
                    )
                  ) : (
                    <>
                      <FileText size={12} className="text-accent" />
                      <span className="max-w-[120px] truncate">{a.name}</span>
                    </>
                  )}
                </span>
              ))}
            </div>
          )}
          <div className="whitespace-pre-wrap rounded-[22px] rounded-br-md bg-well px-4 py-2.5 text-[14.5px] leading-relaxed text-ink">
            {msg.content}
          </div>
        </div>
      </div>
    );
  }

  /* ── assistant message ── */
  const hasThinking = !!(msg.reasoning || msg.thinkingActive || msg.thinkingMs);
  const isTyping = !!msg.isTyping;
  const isStreaming = !!msg.isStreaming;

  return (
    <div className="group anim-rise mx-auto w-full max-w-[780px] px-4 py-2.5">
      {hasThinking && <ThinkingBlock msg={msg} />}

      {msg.toolRounds?.map((round, ri) => (
        <div key={ri}>
          {round.map((entry) => (
            <ToolCallItem key={entry.id} entry={entry} />
          ))}
        </div>
      ))}

      {isTyping ? (
        <div className="flex items-center gap-1.5 py-2" role="status" aria-label="Luca is thinking">
          <span className="typing-dot" />
          <span className="typing-dot" style={{ animationDelay: "0.15s" }} />
          <span className="typing-dot" style={{ animationDelay: "0.3s" }} />
        </div>
      ) : msg.isError ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-500/25 bg-red-500/[0.06] px-3.5 py-3">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-red-400" />
          <div>
            <div className="text-[13.5px] font-medium text-red-300">Generation failed</div>
            <div className="mt-0.5 text-[12.5px] leading-relaxed text-mute">
              {msg.errorDetail || "Something went wrong while contacting the model pool."}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="text-ink">
            <Markdown text={msg.content} />
            {isStreaming && <span className="stream-caret" />}
          </div>
          {msg.interrupted && (
            <div className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-amber-400/90">
              <AlertTriangle size={12} /> Generation was interrupted before finishing
            </div>
          )}
          {!isStreaming && !msg.isError && msg.content && (
            <div className="mt-1.5 flex items-center gap-1 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100">
              <button onClick={copy} className="rounded-md p-1.5 text-mute hover:bg-panel hover:text-ink" title="Copy">
                {copied ? <Check size={14} className="text-accent" /> : <Copy size={14} />}
              </button>
              <button
                onClick={props.onRegenerate}
                className="rounded-md p-1.5 text-mute hover:bg-panel hover:text-ink"
                title="Regenerate"
              >
                <RefreshCw size={13.5} />
              </button>
              <span className="ml-1.5 flex items-center gap-1.5 text-[11px] text-mute/80">
                <span className="rounded border border-line px-1.5 py-px font-mono text-[9.5px] uppercase tracking-[0.1em]">
                  {modelTag(msg.modelId)}
                </span>
                {showTimestamps && <span>{formatTimestamp(msg.ts)}</span>}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── main chat area ── */
interface Props {
  session: LucaSession | null;
  user: LucaUser | null;
  showTimestamps: boolean;
  editingUid: string | null;
  onSendPrompt: (text: string) => void;
  onStartEdit: (uid: string) => void;
  onCancelEdit: () => void;
  onSaveEdit: (uid: string, text: string) => void;
  onRegenerate: (uid: string) => void;
}

export default function ChatArea(props: Props) {
  const { session, user } = props;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showJump, setShowJump] = useState(false);
  const nearBottomRef = useRef(true);

  const hero = useMemo(() => {
    const name = user?.name && user.name !== "User" ? user.name : null;
    const pool = [
      ...HERO_HEADINGS_QUESTION.map((text) => ({ text, kind: "question" as const })),
      ...HERO_HEADINGS_STATEMENT.map((text) => ({ text, kind: "statement" as const })),
      { text: timeOfDayGreeting(), kind: "statement" as const },
    ];
    const pick = pool[Math.floor(Math.random() * pool.length)];
    const heading = name
      ? pick.kind === "question"
        ? `${pick.text}, ${name}?`
        : `${pick.text}, ${name}`
      : pick.kind === "question"
        ? `${pick.text}?`
        : pick.text;
    const suggestions = HERO_PROMPT_POOL.slice()
      .sort(() => Math.random() - 0.5)
      .slice(0, 4);
    return { heading, suggestions };
    // new hero only when the session changes to/from empty
  }, [session?.id, user?.name]);

  const streamLen = session?.messages.reduce((n, m) => n + (m.content?.length || 0), 0) || 0;

  useEffect(() => {
    const el = scrollRef.current;
    if (el && nearBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [session?.messages.length, streamLen, session?.id]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    nearBottomRef.current = dist < 140;
    setShowJump(dist > 180);
  };

  const isEmpty = !session || session.messages.length === 0;

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center px-6 pb-24">
            <div className="anim-rise w-full max-w-[720px] text-center" style={{ animationDelay: "0.05s" }}>
              <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-2xl border border-line bg-panel">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4a9eff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
                  <path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z" />
                </svg>
              </div>
              <h1 className="font-display text-[30px] font-semibold leading-tight tracking-tight text-ink sm:text-[36px]">
                {hero.heading}
              </h1>
              <p className="mx-auto mt-2.5 max-w-[440px] text-[14px] leading-relaxed text-mute">
                Flash for speed, Pro for depth — with live web search and reasoning you can inspect.
              </p>
            </div>
            <div className="anim-rise mt-8 grid w-full max-w-[620px] grid-cols-1 gap-2 sm:grid-cols-2" style={{ animationDelay: "0.14s" }}>
              {hero.suggestions.map((s, i) => (
                <button
                  key={s}
                  onClick={() => props.onSendPrompt(s)}
                  className="group rounded-xl border border-line bg-panel/60 px-4 py-3 text-left text-[13.5px] leading-snug text-ink/85 transition-all duration-150 hover:-translate-y-0.5 hover:border-accent/40 hover:bg-panel hover:text-ink"
                  style={{ animationDelay: `${0.18 + i * 0.05}s` }}
                >
                  <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-[0.12em] text-accent/80">
                    {i % 2 === 0 ? "Think" : "Write or edit"}
                  </span>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="pb-6 pt-4">
            {session.messages.map((m) => (
              <MessageRow
                key={m.uid}
                msg={m}
                showTimestamps={props.showTimestamps}
                editing={props.editingUid === m.uid}
                onStartEdit={() => props.onStartEdit(m.uid)}
                onCancelEdit={props.onCancelEdit}
                onSaveEdit={(t) => props.onSaveEdit(m.uid, t)}
                onRegenerate={() => props.onRegenerate(m.uid)}
              />
            ))}
          </div>
        )}
      </div>

      {/* scroll to bottom */}
      <button
        onClick={() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })}
        className={`absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full border border-line bg-[#1d1d1d] p-2 text-mute shadow-[0_8px_24px_rgba(0,0,0,0.5)] transition-all duration-200 hover:text-ink ${
          showJump ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
        }`}
        aria-label="Scroll to bottom"
      >
        <ArrowDown size={15} />
      </button>
    </div>
  );
}
