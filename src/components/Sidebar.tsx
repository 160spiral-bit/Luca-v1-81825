import { useEffect, useRef, useState } from "react";
import { Check, Pencil, Pin, PinOff, Plus, Search, Settings as SettingsIcon, Trash2, X } from "lucide-react";
import Logo from "./Logo";
import { dayBucket } from "../lib/luca";
import type { Profile, Session } from "../lib/luca";

interface Props {
  sessions: Session[];
  activeId: string | null;
  generatingId: string | null;
  search: string;
  onSearch: (q: string) => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onTogglePin: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenSettings: () => void;
  profile: Profile | null;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const GROUPS = ["Pinned", "Today", "Yesterday", "Previous 7 days", "Older"] as const;

export default function Sidebar({
  sessions,
  activeId,
  generatingId,
  search,
  onSearch,
  onSelect,
  onNew,
  onRename,
  onTogglePin,
  onDelete,
  onOpenSettings,
  profile,
  mobileOpen,
  onCloseMobile,
}: Props) {
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const renameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!menuFor) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuFor(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuFor(null);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuFor]);

  useEffect(() => {
    if (renamingId) {
      renameRef.current?.focus();
      renameRef.current?.select();
    }
  }, [renamingId]);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? sessions.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.messages.some((m) => m.content && m.content.toLowerCase().includes(q)),
      )
    : sessions;

  const groups: Record<string, Session[]> = {};
  for (const g of GROUPS) groups[g] = [];
  for (const s of [...filtered].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))) {
    const key = s.pinned && !q ? "Pinned" : dayBucket(s.updatedAt || s.createdAt);
    groups[key].push(s);
  }

  const commitRename = () => {
    if (renamingId) {
      const t = renameValue.trim();
      if (t) onRename(renamingId, t);
    }
    setRenamingId(null);
  };

  const initials = profile?.name ? profile.name.trim().charAt(0).toUpperCase() : "?";

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/55 md:hidden" onClick={onCloseMobile} aria-hidden="true" />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[272px] flex-col border-r border-line bg-canvas transition-transform duration-200 ease-out md:static md:z-auto md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-3 pb-2.5 pt-3.5">
          <div className="flex items-center gap-2.5 pl-1">
            <span className="grid h-[26px] w-[26px] place-items-center rounded-lg border border-linestrong bg-gradient-to-b from-surface2 to-surface1 text-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <Logo size={15} />
            </span>
            <span className="font-display text-[17px] font-semibold tracking-tight">Luca</span>
          </div>
          <button
            className="grid h-8 w-8 place-items-center rounded-lg text-mute transition-colors hover:bg-surface1 hover:text-ink md:hidden"
            onClick={onCloseMobile}
            aria-label="Close sidebar"
          >
            <X size={17} />
          </button>
        </div>

        <div className="grid gap-2 px-3">
          <button
            onClick={() => {
              onNew();
              onCloseMobile();
            }}
            className="flex w-full items-center gap-2.5 rounded-xl border border-transparent bg-surface2 px-3 py-[9px] text-left text-sm font-medium transition-all hover:border-line hover:bg-[#262626] active:scale-[0.985]"
          >
            <Plus size={16} className="text-mute" />
            New chat
          </button>

          <div className="relative flex items-center">
            <Search size={15} className="pointer-events-none absolute left-3 text-mute" />
            <input
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Search chats"
              className="w-full rounded-xl border border-transparent bg-surface1 py-2.5 pl-9 pr-8 text-[16px] text-ink outline-none transition-colors placeholder:text-mute focus:border-linestrong focus:bg-surface2 md:py-2 md:text-[13.5px]"
            />
            {search && (
              <button
                onClick={() => onSearch("")}
                className="absolute right-1.5 grid h-[22px] w-[22px] place-items-center rounded-md text-mute hover:bg-surface3 hover:text-ink"
                aria-label="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-2 pt-3.5" aria-label="Recent chats">
          <div className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.09em] text-mute">
            Recents
          </div>

          {sessions.length === 0 && (
            <div className="px-3 py-6 text-center text-[13.5px] leading-relaxed text-mute">
              No chats yet — start one and it'll show up here.
            </div>
          )}
          {sessions.length > 0 && filtered.length === 0 && (
            <div className="px-3 py-6 text-center text-[13.5px] text-mute">
              No chats match “{search.trim()}”
            </div>
          )}

          {GROUPS.map((g) =>
            groups[g].length ? (
              <div key={g}>
                <div className="flex items-center gap-1.5 px-2 pb-1 pt-3 text-xs font-semibold text-mute">
                  {g === "Pinned" && <Pin size={12} />}
                  {g}
                </div>
                {groups[g].map((s) => {
                  const isGen = generatingId !== null && s.messages.some((m) => m.streaming);
                  return (
                    <div key={s.id} className="relative">
                      {renamingId === s.id ? (
                        <div className="flex items-center gap-1 rounded-lg bg-surface2 px-1.5 py-1">
                          <input
                            ref={renameRef}
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                commitRename();
                              }
                              if (e.key === "Escape") setRenamingId(null);
                            }}
                            onBlur={commitRename}
                            aria-label="Rename chat"
                            className="min-w-0 flex-1 rounded-md border border-linestrong bg-surface3 px-2 py-1 text-sm text-ink outline-none"
                          />
                          <button
                            className="grid h-7 w-7 place-items-center rounded-md text-ok hover:bg-surface3"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              commitRename();
                            }}
                            aria-label="Save name"
                          >
                            <Check size={15} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            onSelect(s.id);
                            onCloseMobile();
                          }}
                          className={`group flex w-full items-center gap-2 rounded-lg py-2 pl-2.5 pr-9 text-left text-sm transition-colors ${
                            s.id === activeId ? "bg-surface2" : "hover:bg-surface1"
                          }`}
                        >
                          <span className="min-w-0 flex-1 truncate">{s.title}</span>
                          {s.pinned && <Pin size={12} className="shrink-0 text-mute" />}
                          {isGen && <span className="pulse-dot shrink-0" aria-hidden="true" />}
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuFor(menuFor === s.id ? null : s.id);
                              setConfirmDelete(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                e.stopPropagation();
                                setMenuFor(menuFor === s.id ? null : s.id);
                              }
                            }}
                            aria-label="Chat options"
                            className={`absolute right-1 grid h-[26px] w-[26px] place-items-center rounded-md text-mute transition-all hover:bg-surface3 hover:text-ink ${
                              menuFor === s.id ? "bg-surface3 text-ink opacity-100" : "opacity-0 group-hover:opacity-100"
                            }`}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                              <circle cx="5" cy="12" r="1.6" />
                              <circle cx="12" cy="12" r="1.6" />
                              <circle cx="19" cy="12" r="1.6" />
                            </svg>
                          </span>
                        </button>
                      )}

                      {menuFor === s.id && (
                        <div
                          ref={menuRef}
                          className="anim-pop absolute right-0 top-9 z-50 w-[178px] rounded-xl border border-linestrong bg-surface2 p-1 shadow-[0_14px_38px_rgba(0,0,0,0.55)]"
                          role="menu"
                        >
                          {confirmDelete === s.id ? (
                            <div className="p-1.5">
                              <div className="px-1 pb-2 text-[12.5px] text-mute">Delete this chat?</div>
                              <div className="flex gap-1.5">
                                <button
                                  className="flex-1 rounded-md bg-danger/15 px-2 py-1.5 text-xs font-semibold text-danger hover:bg-danger/25"
                                  onClick={() => {
                                    onDelete(s.id);
                                    setMenuFor(null);
                                    setConfirmDelete(null);
                                  }}
                                >
                                  Delete
                                </button>
                                <button
                                  className="flex-1 rounded-md bg-surface3 px-2 py-1.5 text-xs text-ink hover:bg-surface4"
                                  onClick={() => setConfirmDelete(null)}
                                >
                                  Keep
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <button
                                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] hover:bg-surface3"
                                role="menuitem"
                                onClick={() => {
                                  onTogglePin(s.id);
                                  setMenuFor(null);
                                }}
                              >
                                {s.pinned ? <PinOff size={15} className="text-mute" /> : <Pin size={15} className="text-mute" />}
                                {s.pinned ? "Unpin" : "Pin"}
                              </button>
                              <button
                                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] hover:bg-surface3"
                                role="menuitem"
                                onClick={() => {
                                  setRenamingId(s.id);
                                  setRenameValue(s.title);
                                  setMenuFor(null);
                                }}
                              >
                                <Pencil size={15} className="text-mute" />
                                Rename
                              </button>
                              <button
                                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] text-danger hover:bg-danger/10"
                                role="menuitem"
                                onClick={() => setConfirmDelete(s.id)}
                              >
                                <Trash2 size={15} />
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : null,
          )}
        </nav>

        <div className="flex items-center gap-2.5 border-t border-line px-3 py-2.5 pb-[max(10px,env(safe-area-inset-bottom))]">
          <span
            className="grid h-[30px] w-[30px] shrink-0 place-items-center overflow-hidden rounded-full bg-avatar text-[11px] font-bold text-[#1a0e05] shadow-[0_0_0_2px_rgba(217,122,62,0.22)]"
            style={profile?.avatar ? { backgroundImage: `url(${profile.avatar})`, backgroundSize: "cover" } : undefined}
            aria-hidden="true"
          >
            {!profile?.avatar && initials}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13.5px] font-semibold leading-tight">{profile?.name || "Guest"}</div>
            <div className="text-[11.5px] leading-tight text-mute">Free plan</div>
          </div>
          <button
            onClick={onOpenSettings}
            className="ml-auto grid h-9 w-9 place-items-center rounded-lg text-mute transition-colors hover:bg-surface1 hover:text-ink"
            aria-label="Open settings"
          >
            <SettingsIcon size={16} />
          </button>
        </div>
      </aside>
    </>
  );
}
