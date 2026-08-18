import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowDown, Check, ChevronRight, Copy, Globe, Image as ImageIcon, Pencil, RotateCcw, X } from "lucide-react";
import Logo from "./Logo";
import Markdown from "./Markdown";
import { copyText, formatTime, timeOfDayGreeting } from "../lib/luca";
import type { LucaMessage, Profile, Session, Settings, ToolRound } from "../lib/luca";

interface Props {
  session: Session | null;
  profile: Profile | null;
  settings: Settings;
  onSuggestion: (text: string) => void;
  onRegenerate: (sessionId: string, msgUid: string) => void;
  onEditResend: (sessionId: string, msgUid: string, text: string) => void;
  onToast: (msg: string) => void;
}

const SUGGESTION_POOL = [
  "Explain how mixture-of-experts routing works",
  "Write a debounced search hook in React",
  "Draft a friendly follow-up email to a client",
  "Plan a focused 3-day trip to Kyoto",
  "Debug this SQL join that returns duplicates",
  "Compare Luca Flash vs Pro for my use case",
  "Brainstorm ten names for a coffee app",
  "Summarize the trade-offs of server components",
];

function useSampled(count: number): string[] {
  return useMemo(() => {
    const pool = [...SUGGESTION_POOL];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, count);
  }, [count]);
}

function ThinkingBlock({ msg }: { msg: LucaMessage }) {
  const [open, setOpen] = useState(!!msg.streaming);
  useEffect(() => {
    if (msg.streaming) setOpen(true);
  }, [msg.streaming]);

  const seconds = msg.thinkingMs ? Math.max(1, Math.round(msg.thinkingMs / 1000)) : 0;
  const label = msg.streaming && !msg.content ? "Thinking" : `Thought for ${seconds}s`;

  return (
    <div className="mb-3">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-md py-0.5 text-[13.5px] font-medium text-accent transition-colors hover:text-accent2"
      >
        <ChevronRight size={13} className={`transition-transform duration-200 ${open ? "rotate-90" : ""}`} />
        {msg.streaming && !msg.content ? (
          <span className="flex items-center gap-1.5">
            {label}
            <span className="flex items-center gap-[3px]">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </span>
          </span>
        ) : (
          label
        )}
      </button>
      {open && msg.reasoning && (
        <div className="anim-fade-in mt-1.5 whitespace-pre-wrap border-l-2 border-accent/30 pl-3.5 text-[13.5px] leading-relaxed text-mute">
          {msg.reasoning}
        </div>
      )}
    </div>
  );
}

function ToolRoundView({ round }: { round: ToolRound }) {
  const [open, setOpen] = useState(false);
  const label =
    round.name === "search_images" ? "Searched images" : round.name === "read_file" ? "Read a file" : "Searched the web";
  return (
    <div className="mb-3.5 rounded-xl border border-line bg-surface1/60 px-3.5 py-2.5">
      <div className="flex items-center gap-2 text-[13.5px] font-medium">
        <Globe size={14} className="text-accent" />
        {label}
        {round.query && <span className="truncate font-normal text-mute">· “{round.query}”</span>}
        {round.status === "done" && round.ms !== undefined && (
          <span className="shrink-0 font-normal text-mute">· {(round.ms / 1000).toFixed(1)}s</span>
        )}
        {round.status === "running" ? (
          <span className="ml-1 flex items-center gap-[3px]">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </span>
        ) : (
          round.sources.length > 0 && (
            <button
              onClick={() => setOpen((v) => !v)}
              className="ml-auto grid h-6 w-6 place-items-center rounded-md text-mute hover:bg-surface3 hover:text-ink"
              aria-label="Toggle sources"
            >
              <ChevronRight size={14} className={`transition-transform duration-150 ${open ? "rotate-90" : ""}`} />
            </button>
          )
        )}
      </div>
      {open && round.sources.length > 0 && (
        <div className="anim-fade-in mt-2.5 flex flex-wrap gap-2">
          {round.sources.map((s, i) => (
            <a
              key={i}
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-full border border-line bg-surface2 py-1 pl-1.5 pr-3 text-[12.5px] transition-colors hover:border-linestrong hover:bg-[#262626]"
            >
              <span className="grid h-[19px] w-[19px] place-items-center rounded-[5px] bg-surface4 text-[10px] font-bold text-mute">
                {s.host.charAt(0).toUpperCase()}
              </span>
              {s.host}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function AssistantRow({
  msg,
  session,
  settings,
  onRegenerate,
  onToast,
}: {
  msg: LucaMessage;
  session: Session;
  settings: Settings;
  onRegenerate: (sessionId: string, msgUid: string) => void;
  onToast: (m: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const showThinking = !!(msg.reasoning || (msg.streaming && !msg.content));
  const isLastAssistant = [...session.messages].reverse().find((m) => m.role === "assistant")?.uid === msg.uid;

  return (
    <div className="anim-msg group flex gap-3.5">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-[9px] border border-linestrong bg-gradient-to-b from-[#1d1d21] to-[#131316] text-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        <Logo size={16} />
      </span>

      <div className="min-w-0 flex-1">
        {showThinking && <ThinkingBlock msg={msg} />}
        {msg.toolRounds?.map((r) => <ToolRoundView key={r.id} round={r} />)}

        {msg.content ? (
          <div className="min-w-0">
            <Markdown text={msg.content} />
            {msg.streaming && <span className="stream-cursor" aria-hidden="true" />}
          </div>
        ) : (
          !showThinking && msg.streaming && (
            <span className="flex items-center gap-[4px] py-1">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </span>
          )
        )}

        {msg.error && (
          <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-[13px] text-danger">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            <span>{msg.error}</span>
          </div>
        )}
        {msg.interrupted && !msg.streaming && (
          <div className="mt-2.5 flex items-center gap-1.5 text-xs text-warn">
            <AlertTriangle size={12} /> Generation was stopped early
          </div>
        )}

        {!msg.streaming && (msg.content || msg.error) && (
          <div className="mt-2 flex min-h-[26px] items-center gap-2">
            {settings.showTimestamps && <span className="text-[11.5px] text-mute">{formatTime(msg.ts)}</span>}
            {msg.tier && (
              <span className="rounded-full border border-line bg-surface1 px-2 py-px text-[11px] font-semibold tracking-wide text-mute">
                Luca {msg.tier === "flash" ? "Flash" : "Pro"}
              </span>
            )}
            <div className="ml-auto flex gap-0.5 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100">
              <button
                onClick={async () => {
                  if (await copyText(msg.content)) {
                    setCopied(true);
                    onToast("Copied to clipboard");
                    setTimeout(() => setCopied(false), 1400);
                  }
                }}
                className="grid h-[27px] w-[27px] place-items-center rounded-md text-mute transition-colors hover:bg-surface2 hover:text-ink"
                aria-label="Copy message"
              >
                {copied ? <Check size={15} className="text-ok" /> : <Copy size={15} />}
              </button>
              {isLastAssistant && !msg.error && (
                <button
                  onClick={() => onRegenerate(session.id, msg.uid)}
                  className="grid h-[27px] w-[27px] place-items-center rounded-md text-mute transition-colors hover:bg-surface2 hover:text-ink"
                  aria-label="Regenerate response"
                >
                  <RotateCcw size={14} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function UserRow({
  msg,
  session,
  settings,
  onEditResend,
  onToast,
  streamingSomewhere,
}: {
  msg: LucaMessage;
  session: Session;
  settings: Settings;
  onEditResend: (sessionId: string, msgUid: string, text: string) => void;
  onToast: (m: string) => void;
  streamingSomewhere: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(msg.content);
  const [copied, setCopied] = useState(false);

  return (
    <div className="anim-msg group flex justify-end">
      <div className="max-w-[86%] sm:max-w-[72%]">
        {editing ? (
          <div className="rounded-2xl border border-accent/50 bg-surface2 p-2 shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-accent)_9%,transparent)]">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={Math.min(6, Math.max(2, draft.split("\n").length))}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (draft.trim()) {
                    onEditResend(session.id, msg.uid, draft.trim());
                    setEditing(false);
                  }
                }
                if (e.key === "Escape") setEditing(false);
              }}
              className="block w-full resize-none rounded-lg bg-transparent px-2 py-1.5 text-[16px] leading-relaxed text-ink outline-none md:text-[15px]"
            />
            <div className="flex justify-end gap-1.5 px-1 pb-0.5">
              <button
                onClick={() => setEditing(false)}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-mute hover:bg-surface3 hover:text-ink"
              >
                <X size={13} /> Cancel
              </button>
              <button
                onClick={() => {
                  if (draft.trim()) {
                    onEditResend(session.id, msg.uid, draft.trim());
                    setEditing(false);
                  }
                }}
                disabled={!draft.trim() || streamingSomewhere}
                className="flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-canvas transition-opacity hover:bg-ink/85 disabled:opacity-40"
              >
                <Check size={13} /> Save & send
              </button>
            </div>
          </div>
        ) : (
          <>
            {msg.attachments && msg.attachments.length > 0 && (
              <div className="mb-1.5 flex flex-wrap justify-end gap-2">
                {msg.attachments.map((a) =>
                  a.type.startsWith("image/") ? (
                    <img
                      key={a.id}
                      src={a.dataUrl}
                      alt={a.name}
                      className="h-20 max-w-[180px] rounded-xl border border-line object-cover"
                    />
                  ) : (
                    <span key={a.id} className="flex items-center gap-1.5 rounded-lg border border-line bg-surface2 px-2.5 py-1.5 text-xs text-mute">
                      <ImageIcon size={13} /> {a.name}
                    </span>
                  ),
                )}
              </div>
            )}
            <div className="whitespace-pre-wrap rounded-[18px] rounded-br-md border border-line bg-surface2 px-4 py-3 text-[16px] leading-relaxed transition-colors hover:border-linestrong md:py-2.5 md:text-[15px]">
              {msg.content}
            </div>
            <div className="mt-1.5 flex items-center justify-end gap-2">
              {settings.showTimestamps && <span className="text-[11.5px] text-mute opacity-0 transition-opacity group-hover:opacity-100">{formatTime(msg.ts)}</span>}
              <div className="flex gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                <button
                  onClick={async () => {
                    if (await copyText(msg.content)) {
                      setCopied(true);
                      onToast("Copied to clipboard");
                      setTimeout(() => setCopied(false), 1400);
                    }
                  }}
                  className="grid h-[27px] w-[27px] place-items-center rounded-md text-mute transition-colors hover:bg-surface2 hover:text-ink"
                  aria-label="Copy message"
                >
                  {copied ? <Check size={15} className="text-ok" /> : <Copy size={15} />}
                </button>
                <button
                  onClick={() => {
                    setDraft(msg.content);
                    setEditing(true);
                  }}
                  className="grid h-[27px] w-[27px] place-items-center rounded-md text-mute transition-colors hover:bg-surface2 hover:text-ink"
                  aria-label="Edit message"
                >
                  <Pencil size={14} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function ChatArea({ session, profile, settings, onSuggestion, onRegenerate, onEditResend, onToast }: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [showJump, setShowJump] = useState(false);
  const nearBottomRef = useRef(true);
  const suggestions = useSampled(4);

  const messages = session?.messages || [];
  const streaming = messages.some((m) => m.streaming);
  const isEmpty = messages.length === 0;

  useEffect(() => {
    const el = scrollRef.current;
    if (el && nearBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages, session?.id]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 130;
    nearBottomRef.current = near;
    setShowJump(!near);
  };

  const greeting = timeOfDayGreeting();
  const firstName = profile?.name && profile.name !== "User" ? profile.name.split(" ")[0] : null;

  return (
    <div className="relative z-10 min-h-0 flex-1">
      <div ref={scrollRef} onScroll={onScroll} className="h-full overflow-y-auto">
        {isEmpty ? (
          <div className="mx-auto max-w-[780px] px-5 pt-[10vh]">
            <h2 className="anim-fade-up font-display text-[clamp(24px,3.4vw,32px)] font-semibold leading-tight tracking-tight">
              {greeting}
              {firstName ? `, ${firstName}` : ""}
            </h2>
            <p className="anim-fade-up mt-2 text-[15px] text-mute" style={{ ["--d" as string]: "70ms" }}>
              Where should we start?
            </p>
            <div className="mt-7 grid gap-2.5 sm:grid-cols-2">
              {suggestions.map((s, i) => (
                <button
                  key={s}
                  onClick={() => onSuggestion(s)}
                  className="anim-fade-up rounded-xl border border-line bg-surface1 px-4 py-3 text-left text-[13.5px] leading-snug transition-all duration-200 hover:-translate-y-0.5 hover:border-linestrong hover:bg-surface2 active:scale-[0.98]"
                  style={{ ["--d" as string]: `${140 + i * 60}ms` }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-[780px] flex-col gap-6 px-4 pb-4 pt-6 sm:px-5">
            {messages.map((m) =>
              m.role === "user" ? (
                <UserRow
                  key={m.uid}
                  msg={m}
                  session={session!}
                  settings={settings}
                  onEditResend={onEditResend}
                  onToast={onToast}
                  streamingSomewhere={streaming}
                />
              ) : (
                <AssistantRow key={m.uid} msg={m} session={session!} settings={settings} onRegenerate={onRegenerate} onToast={onToast} />
              ),
            )}
          </div>
        )}
      </div>

      {showJump && !isEmpty && (
        <button
          onClick={() => {
            const el = scrollRef.current;
            if (el) {
              nearBottomRef.current = true;
              el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
            }
          }}
          aria-label="Scroll to bottom"
          className="anim-pop absolute bottom-4 right-5 z-10 grid h-8 w-8 place-items-center rounded-full border border-linestrong bg-surface2 text-mute shadow-[0_6px_18px_rgba(0,0,0,0.45)] transition-all hover:-translate-y-0.5 hover:text-ink"
        >
          <ArrowDown size={16} />
        </button>
      )}

    </div>
  );
}
