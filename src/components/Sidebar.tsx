import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Check,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import type { LucaSession, LucaUser } from "../lib/luca";

/* dayBucket(): same grouping logic as renderSidebar() in luca-app.js */
function dayBucket(ts: number): string {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86400000;
  const startOfWeek = startOfToday - 6 * 86400000;
  if (ts >= startOfToday) return "Today";
  if (ts >= startOfYesterday) return "Yesterday";
  if (ts >= startOfWeek) return "Previous 7 days";
  return "Older";
}

interface Props {
  sessions: LucaSession[];
  activeSessionId: string | null;
  generatingSessionId: string | null;
  searchQuery: string;
  user: LucaUser | null;
  open: boolean;
  onClose: () => void;
  onNew: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onSearch: (q: string) => void;
  onOpenSettings: () => void;
}

function SessionRow(props: {
  s: LucaSession;
  active: boolean;
  generating: boolean;
  renaming: boolean;
  onCommitRename: (title: string) => void;
  onCancelRename: () => void;
  onSelect: () => void;
  onDelete: () => void;
  onPin: () => void;
  onStartRename: () => void;
}) {
  const { s, active, generating } = props;
  const [menu, setMenu] = useState(false);
  const [draft, setDraft] = useState(s.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (props.renaming) {
      setDraft(s.title);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 10);
    }
  }, [props.renaming]);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  const commit = () => {
    const t = draft.trim();
    if (t && t !== s.title) props.onCommitRename(t);
    else props.onCancelRename();
  };

  if (props.renaming) {
    return (
      <div className="flex items-center gap-1 rounded-lg bg-row px-2 py-1.5">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") props.onCancelRename();
          }}
          onBlur={commit}
          className="w-full rounded-md border border-edge bg-canvas px-2 py-1 text-[13px] text-ink outline-none focus:border-accent/60"
        />
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={commit}
          className="rounded-md p-1 text-mute hover:bg-panel hover:text-ink"
          aria-label="Save name"
        >
          <Check size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={props.onSelect}
        className={`group flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors duration-150 ${
          active ? "bg-row text-ink" : "text-ink/80 hover:bg-panel"
        }`}
      >
        {s.pinned && <Pin size={12} className="shrink-0 text-mute" />}
        <span className="flex-1 truncate text-[13px] leading-snug">{s.title}</span>
        {generating && (
          <span className="flex gap-[3px]">
            <span className="typing-dot !h-[4px] !w-[4px]" />
            <span className="typing-dot !h-[4px] !w-[4px]" style={{ animationDelay: "0.15s" }} />
            <span className="typing-dot !h-[4px] !w-[4px]" style={{ animationDelay: "0.3s" }} />
          </span>
        )}
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            setMenu((m) => !m);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.stopPropagation();
              setMenu((m) => !m);
            }
          }}
          className={`rounded-md p-1 text-mute transition-opacity hover:bg-well hover:text-ink ${
            menu ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
          aria-label="Chat options"
        >
          <MoreHorizontal size={14} />
        </span>
      </button>

      {menu && (
        <div
          ref={menuRef}
          className="anim-pop absolute right-1 top-9 z-40 w-40 overflow-hidden rounded-xl border border-line bg-[#1d1d1d] py-1 shadow-[0_12px_32px_rgba(0,0,0,0.55)]"
          role="menu"
        >
          <button
            onClick={() => {
              props.onPin();
              setMenu(false);
            }}
            className="flex w-full items-center gap-2.5 px-3 py-1.5 text-[13px] text-ink/90 hover:bg-row"
          >
            {s.pinned ? <PinOff size={14} className="text-mute" /> : <Pin size={14} className="text-mute" />}
            {s.pinned ? "Unpin" : "Pin"}
          </button>
          <button
            onClick={() => {
              props.onStartRename();
              setMenu(false);
            }}
            className="flex w-full items-center gap-2.5 px-3 py-1.5 text-[13px] text-ink/90 hover:bg-row"
          >
            <Pencil size={14} className="text-mute" /> Rename
          </button>
          <button
            onClick={() => {
              props.onDelete();
              setMenu(false);
            }}
            className="flex w-full items-center gap-2.5 px-3 py-1.5 text-[13px] text-red-400 hover:bg-row"
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

export default function Sidebar(props: Props) {
  const { sessions, searchQuery, user } = props;
  const q = searchQuery.trim().toLowerCase();
  const filtered = q
    ? sessions.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          (s.messages || []).some((m) => m.content && m.content.toLowerCase().includes(q)),
      )
    : sessions;

  const groups: Record<string, LucaSession[]> = {
    Pinned: [],
    Today: [],
    Yesterday: [],
    "Previous 7 days": [],
    Older: [],
  };
  [...filtered]
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .forEach((s) => {
      if (s.pinned && !q) groups.Pinned.push(s);
      else groups[dayBucket(s.updatedAt || s.createdAt || Date.now())].push(s);
    });

  const [renamingId, setRenamingId] = useState<string | null>(null);

  return (
    <>
      {/* mobile backdrop */}
      {props.open && (
        <div
          className="anim-fade fixed inset-0 z-30 bg-black/60 md:hidden"
          onClick={props.onClose}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[268px] shrink-0 flex-col border-r border-line bg-canvas transition-transform duration-200 md:static md:translate-x-0 ${
          props.open ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Sidebar"
      >
        {/* brand + new chat */}
        <div className="flex items-center justify-between px-3 pb-1 pt-3.5">
          <div className="flex items-center gap-2 px-1">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-accent/15">
              <Sparkles size={14} className="text-accent" />
            </span>
            <span className="font-display text-[15px] font-semibold tracking-tight text-ink">Luca</span>
            <span className="rounded border border-line px-1 py-px font-mono text-[9px] uppercase tracking-[0.14em] text-mute">
              ai
            </span>
          </div>
          <button
            onClick={props.onClose}
            className="rounded-md p-1.5 text-mute hover:bg-panel hover:text-ink md:hidden"
            aria-label="Close sidebar"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-3 pb-2 pt-1">
          <button
            onClick={props.onNew}
            className="flex w-full items-center gap-2.5 rounded-full bg-row px-3.5 py-2 text-[13.5px] font-medium text-ink transition-all duration-150 hover:bg-[#2a2a2a] active:scale-[0.985]"
          >
            <Pencil size={15} className="text-mute" />
            New chat
          </button>
        </div>

        {/* search */}
        <div className="px-3 pb-2">
          <div className="flex items-center gap-2 rounded-lg border border-transparent bg-panel px-2.5 py-1.5 transition-colors focus-within:border-edge">
            <Search size={13} className="shrink-0 text-mute" />
            <input
              value={searchQuery}
              onChange={(e) => props.onSearch(e.target.value)}
              placeholder="Search chats"
              className="w-full bg-transparent text-[13px] text-ink outline-none placeholder:text-mute/70"
            />
            {searchQuery && (
              <button onClick={() => props.onSearch("")} className="text-mute hover:text-ink" aria-label="Clear search">
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* recents */}
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          <div className="px-1 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-mute">
            Recents
          </div>

          {sessions.length === 0 && (
            <p className="px-1 pt-2 text-[12.5px] leading-relaxed text-mute">
              No chats yet — start one and it'll show up here.
            </p>
          )}
          {sessions.length > 0 && filtered.length === 0 && (
            <p className="px-1 pt-2 text-[12.5px] text-mute">No chats match "{searchQuery.trim()}"</p>
          )}

          {(["Pinned", "Today", "Yesterday", "Previous 7 days", "Older"] as const).map((g) =>
            groups[g].length ? (
              <div key={g} className="mb-1.5">
                <div className="px-1 pb-1 pt-2.5 text-[11px] font-medium text-mute/80">
                  {g === "Pinned" ? "Pinned" : g}
                </div>
                <div className="flex flex-col gap-px">
                  {groups[g].map((s) => (
                    <SessionRow
                      key={s.id}
                      s={s}
                      active={s.id === props.activeSessionId}
                      generating={props.generatingSessionId === s.id}
                      renaming={renamingId === s.id}
                      onCommitRename={(t) => {
                        props.onRename(s.id, t);
                        setRenamingId(null);
                      }}
                      onCancelRename={() => setRenamingId(null)}
                      onSelect={() => props.onSelect(s.id)}
                      onDelete={() => props.onDelete(s.id)}
                      onPin={() => props.onTogglePin(s.id)}
                      onStartRename={() => setRenamingId(s.id)}
                    />
                  ))}
                </div>
              </div>
            ) : null,
          )}
        </div>

        {/* footer: upgrade pill + avatar */}
        <div className="flex items-center gap-2 border-t border-line px-3 py-3">
          <button
            onClick={props.onOpenSettings}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-full border border-edge bg-line px-3 py-1.5 transition-all duration-150 hover:bg-[#333333] active:scale-[0.985]"
            title="Settings"
          >
            <span
              className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10.5px] font-bold text-white"
              style={{ background: "#d97a3e" }}
            >
              {user?.avatar ? (
                <img src={user.avatar} alt="" className="h-6 w-6 rounded-full object-cover" />
              ) : (
                (user?.name || "U").slice(0, 2).toUpperCase()
              )}
            </span>
            <span className="truncate text-[13px] font-medium text-ink">{user?.name || "User"}</span>
          </button>
          <button
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-edge bg-line px-3 py-2 text-[12.5px] font-semibold text-ink transition-all duration-150 hover:border-accent/50 hover:text-accent active:scale-[0.97]"
            title="Upgrade plan"
          >
            <ArrowUpRight size={13} />
            Upgrade
          </button>
        </div>
      </aside>
    </>
  );
}
