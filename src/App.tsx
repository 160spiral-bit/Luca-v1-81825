import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Menu, Pencil, Settings as SettingsIcon, Trash2, X } from "lucide-react";
import Sidebar from "./components/Sidebar";
import ChatArea from "./components/ChatArea";
import Composer from "./components/Composer";
import Onboarding from "./components/Onboarding";
import SettingsModal from "./components/SettingsModal";
import {
  ACTIVE_KEY,
  MODELS,
  SESSIONS_KEY,
  checkBackendHealth,
  finishOnboardingLocal,
  getBackendUrl,
  isBackendReachable,
  loadOnboardedUser,
  loadPersistedTier,
  loadSettings,
  localNameChat,
  nameChat,
  persistTier,
  runLocalGeneration,
  streamChat,
  uid,
} from "./lib/luca";
import type {
  LucaAttachment,
  LucaMessage,
  LucaSession,
  LucaSettings,
  LucaUser,
  ModelTier,
  ToolRound,
} from "./lib/luca";

function loadSessions(): { sessions: LucaSession[]; active: string | null } {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    const sessions: LucaSession[] = raw ? JSON.parse(raw) : [];
    const active = localStorage.getItem(ACTIVE_KEY) || null;
    return { sessions, active: active && sessions.some((s) => s.id === active) ? active : null };
  } catch {
    return { sessions: [], active: null };
  }
}

export default function App() {
  const initial = useRef(loadSessions());
  const [user, setUser] = useState<LucaUser | null>(() => loadOnboardedUser());
  const [settings, setSettings] = useState<LucaSettings>(() => loadSettings());
  const [sessions, setSessions] = useState<LucaSession[]>(initial.current.sessions);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(initial.current.active);
  const [tier, setTier] = useState<ModelTier>(() => loadPersistedTier());
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [topMenu, setTopMenu] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingSessionId, setGeneratingSessionId] = useState<string | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);
  const [renamingTop, setRenamingTop] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const tierRef = useRef(tier);
  tierRef.current = tier;
  const userRef = useRef(user);
  userRef.current = user;
  const genRef = useRef<{ ctrl: AbortController; sessionId: string; msgUid: string } | null>(null);
  const topMenuRef = useRef<HTMLDivElement>(null);

  /* ── persistence ── */
  const persist = useCallback((next: LucaSession[], active: string | null) => {
    try {
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(next));
      localStorage.setItem(ACTIVE_KEY, active || "");
    } catch {
      /* quota — keep running in memory */
    }
  }, []);

  /* ── theme attribute (matches data-theme behavior of the original) ── */
  useEffect(() => {
    const t = settings.theme || user?.theme || "dark";
    document.documentElement.setAttribute("data-theme", t);
  }, [settings.theme, user?.theme]);

  /* ── backend health ── */
  useEffect(() => {
    let live = true;
    checkBackendHealth().then((ok) => live && setOnline(ok));
    const iv = setInterval(async () => {
      const ok = await checkBackendHealth();
      if (live) setOnline(ok);
    }, 20000);
    return () => {
      live = false;
      clearInterval(iv);
    };
  }, []);

  /* ── close top-bar menu on outside click ── */
  useEffect(() => {
    if (!topMenu) return;
    const close = (e: MouseEvent) => {
      if (topMenuRef.current && !topMenuRef.current.contains(e.target as Node)) setTopMenu(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [topMenu]);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) || null,
    [sessions, activeSessionId],
  );

  /* ── message mutator: mutate in place, bump array ref, persist ── */
  const updateMsg = useCallback(
    (sessionId: string, msgUid: string, fn: (m: LucaMessage) => void) => {
      const next = [...sessionsRef.current];
      const s = next.find((x) => x.id === sessionId);
      const m = s?.messages.find((x) => x.uid === msgUid);
      if (!s || !m) return;
      fn(m);
      setSessions(next);
      persist(next, activeSessionId);
    },
    [persist, activeSessionId],
  );

  const patchSession = useCallback(
    (sessionId: string, fn: (s: LucaSession) => void) => {
      const next = [...sessionsRef.current];
      const s = next.find((x) => x.id === sessionId);
      if (!s) return;
      fn(s);
      setSessions(next);
      persist(next, activeSessionId);
    },
    [persist, activeSessionId],
  );

  /* ── generation ── */
  const generate = useCallback(
    async (session: LucaSession, userText: string) => {
      const modelId = "luca-" + tierRef.current;
      const msgUid = uid();
      const typing: LucaMessage = {
        uid: msgUid,
        role: "assistant",
        content: "",
        reasoning: "",
        isTyping: true,
        modelId,
        ts: Date.now(),
      };
      patchSession(session.id, (s) => s.messages.push(typing));
      setGenerating(true);
      setGeneratingSessionId(session.id);

      const ctrl = new AbortController();
      genRef.current = { ctrl, sessionId: session.id, msgUid };
      let startedThinking = 0;
      let gotContent = false;

      const apiMessages = session.messages
        .filter((m) => !m.isError && !m.isTyping && typeof m.content === "string")
        .map((m) => ({ role: m.role, content: m.content }));

      const onReasoning = (text: string) =>
        updateMsg(session.id, msgUid, (m) => {
          if (!startedThinking) startedThinking = Date.now();
          m.isTyping = false;
          m.isStreaming = true;
          m.thinkingActive = true;
          m.reasoning = text;
        });

      const onContent = (full: string) => {
        gotContent = true;
        updateMsg(session.id, msgUid, (m) => {
          if (m.thinkingActive) {
            m.thinkingActive = false;
            m.thinkingExpanded = false;
            m.thinkingMs = Date.now() - (startedThinking || Date.now());
          }
          m.isTyping = false;
          m.isStreaming = true;
          m.content = full;
        });
      };

      const onToolStart = (round: ToolRound[]) =>
        updateMsg(session.id, msgUid, (m) => {
          m.isTyping = false;
          m.isStreaming = true;
          m.toolRounds = [...(m.toolRounds || []), round];
        });
      const onToolDone = (round: ToolRound[]) =>
        updateMsg(session.id, msgUid, (m) => {
          const rounds = m.toolRounds || [];
          rounds[rounds.length - 1] = round;
          m.toolRounds = [...rounds];
        });

      try {
        let usedBackend = false;
        if (isBackendReachable()) {
          try {
            await streamChat({
              tier: tierRef.current,
              messages: apiMessages,
              hasAttachments: apiMessages.some((m) => Array.isArray(m.content)),
              userSettings: { ...settingsRef.current, profile: userRef.current },
              signal: ctrl.signal,
              onChunk: (c) => {
                if (c.error) throw new Error(c.error);
                if (c.reasoning) {
                  if (!startedThinking) startedThinking = Date.now();
                  updateMsg(session.id, msgUid, (m) => {
                    m.isTyping = false;
                    m.isStreaming = true;
                    m.thinkingActive = true;
                    m.reasoning = (m.reasoning || "") + c.reasoning;
                  });
                }
                if (c.content) {
                  gotContent = true;
                  updateMsg(session.id, msgUid, (m) => {
                    if (m.thinkingActive) {
                      m.thinkingActive = false;
                      m.thinkingExpanded = false;
                      m.thinkingMs = Date.now() - (startedThinking || Date.now());
                    }
                    m.isTyping = false;
                    m.isStreaming = true;
                    m.content = (m.content || "") + c.content;
                  });
                }
              },
            });
            usedBackend = true;
          } catch (e: any) {
            if (e?.name === "AbortError") throw e;
            /* backend failed mid-way — fall through to local engine only if nothing streamed yet */
            if (gotContent) throw e;
          }
        }
        if (!usedBackend) {
          await runLocalGeneration({
            userText,
            settings: settingsRef.current,
            signal: ctrl.signal,
            onReasoning,
            onToolStart,
            onToolDone,
            onContent,
          });
        }

        /* finalize */
        updateMsg(session.id, msgUid, (m) => {
          m.isStreaming = false;
          m.isTyping = false;
          if (m.thinkingActive) {
            m.thinkingActive = false;
            m.thinkingMs = Date.now() - (startedThinking || Date.now());
          }
        });

        /* chat-naming agent (maybeNameChat equivalent) */
        const s = sessionsRef.current.find((x) => x.id === session.id);
        if (s && s.messages.length <= 2) {
          const firstUser = s.messages.find((m) => m.role === "user")?.content || userText;
          const reply = s.messages.find((m) => m.uid === msgUid)?.content || "";
          const setTitle = (t: string) => patchSession(session.id, (ss) => void (ss.title = t));
          if (isBackendReachable()) {
            nameChat(firstUser, reply).then((t) => t && setTitle(t));
          } else if (!s.title || s.title === "New chat") {
            setTitle(localNameChat(firstUser));
          }
        }
      } catch (e: any) {
        if (e?.name === "AbortError") {
          /* Stop clicked: drop the placeholder if nothing arrived, else keep as interrupted */
          const s = sessionsRef.current.find((x) => x.id === session.id);
          const m = s?.messages.find((x) => x.uid === msgUid);
          if (m) {
            if (m.isTyping && !m.content) {
              patchSession(session.id, (ss) => {
                const idx = ss.messages.findIndex((x) => x.uid === msgUid);
                if (idx !== -1) ss.messages.splice(idx, 1);
              });
            } else {
              updateMsg(session.id, msgUid, (mm) => {
                mm.isStreaming = false;
                mm.isTyping = false;
                mm.thinkingActive = false;
                if (mm.content) mm.interrupted = true;
              });
            }
          }
        } else {
          updateMsg(session.id, msgUid, (m) => {
            if (m.content) {
              m.interrupted = true;
              m.isStreaming = false;
            } else {
              m.isTyping = false;
              m.isStreaming = false;
              m.isError = true;
              m.errorDetail = String(e?.message || e);
            }
          });
        }
      } finally {
        genRef.current = null;
        setGenerating(false);
        setGeneratingSessionId(null);
        setOnline(isBackendReachable());
      }
    },
    [patchSession, updateMsg],
  );

  /* ── send (handleSend equivalent) ── */
  const sendMessage = useCallback(
    (text: string, attachments: LucaAttachment[]) => {
      if (generating) return;
      if (!text && !attachments.length) return;
      setEditingUid(null);

      let session = activeSessionId ? sessionsRef.current.find((s) => s.id === activeSessionId) : undefined;
      if (!session) {
        const now = Date.now();
        const fallback = attachments.length
          ? (attachments[0].isImage ? "Image" : attachments[0].name) +
            (attachments.length > 1 ? ` +${attachments.length - 1} more` : "")
          : "New chat";
        session = {
          id: uid(),
          title: text ? (text.length > 30 ? text.slice(0, 30) + "…" : text) : fallback,
          messages: [],
          createdAt: now,
          updatedAt: now,
          pinned: false,
        };
        const next = [session, ...sessionsRef.current].slice(0, 500); // MAX_SESSIONS
        setSessions(next);
        setActiveSessionId(session.id);
        persist(next, session.id);
      } else {
        patchSession(session.id, (s) => void (s.updatedAt = Date.now()));
      }

      const userMsg: LucaMessage = {
        uid: uid(),
        role: "user",
        content: text,
        ts: Date.now(),
        attachments,
      };
      patchSession(session.id, (s) => s.messages.push(userMsg));

      const snapshot = sessionsRef.current.find((s) => s.id === session!.id);
      if (snapshot) void generate(snapshot, text);
    },
    [activeSessionId, generating, generate, patchSession, persist],
  );

  const stopStreaming = useCallback(() => {
    genRef.current?.ctrl.abort();
  }, []);

  /* ── regenerate / edit (same semantics as luca-app.js) ── */
  const regenerate = useCallback(
    (msgUid: string) => {
      if (!activeSession) return;
      const idx = activeSession.messages.findIndex((m) => m.uid === msgUid);
      if (idx === -1) return;
      let userText = "";
      for (let i = idx - 1; i >= 0; i--) {
        if (activeSession.messages[i].role === "user") {
          userText = activeSession.messages[i].content;
          break;
        }
      }
      patchSession(activeSession.id, (s) => s.messages.splice(idx));
      const snapshot = sessionsRef.current.find((s) => s.id === activeSession.id);
      if (snapshot) void generate(snapshot, userText);
    },
    [activeSession, generate, patchSession],
  );

  const saveEdit = useCallback(
    (msgUid: string, newText: string) => {
      if (!activeSession || !newText) return;
      const idx = activeSession.messages.findIndex((m) => m.uid === msgUid);
      if (idx === -1) return;
      patchSession(activeSession.id, (s) => {
        s.messages[idx].content = newText;
        s.messages[idx].ts = Date.now();
        s.messages.splice(idx + 1);
        s.updatedAt = Date.now();
      });
      setEditingUid(null);
      const snapshot = sessionsRef.current.find((s) => s.id === activeSession.id);
      if (snapshot) void generate(snapshot, newText);
    },
    [activeSession, generate, patchSession],
  );

  /* ── sidebar ops ── */
  const newChat = useCallback(() => {
    setActiveSessionId(null);
    setSidebarOpen(false);
    persist(sessionsRef.current, null);
  }, [persist]);

  const selectSession = useCallback(
    (id: string) => {
      setActiveSessionId(id);
      setSidebarOpen(false);
      setEditingUid(null);
      persist(sessionsRef.current, id);
    },
    [persist],
  );

  const deleteSession = useCallback(
    (id: string) => {
      const next = sessionsRef.current.filter((s) => s.id !== id);
      setSessions(next);
      if (activeSessionId === id) {
        setActiveSessionId(null);
        persist(next, null);
      } else persist(next, activeSessionId);
    },
    [activeSessionId, persist],
  );

  const togglePin = useCallback(
    (id: string) => patchSession(id, (s) => void (s.pinned = !s.pinned)),
    [patchSession],
  );
  const renameSession = useCallback(
    (id: string, title: string) => patchSession(id, (s) => void (s.title = title)),
    [patchSession],
  );

  const exportChat = useCallback(() => {
    if (!activeSession) return;
    const blob = new Blob([JSON.stringify(activeSession, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (activeSession.title || "chat").replace(/[^\w\- ]+/g, "").trim() + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setTopMenu(false);
  }, [activeSession]);

  const tierLabel = MODELS.find((m) => m.id === "luca-" + tier)?.label || "Pro";

  /* ── onboarding gate ── */
  if (!user) {
    return (
      <Onboarding
        onDone={(payload) => {
          finishOnboardingLocal(payload);
          setUser(payload);
          setSettings((prev) => {
            const next = { ...prev, theme: (payload.theme === "light" ? "light" : "dark") as LucaSettings["theme"] };
            return next;
          });
        }}
      />
    );
  }

  return (
    <div className="ambient flex h-full overflow-hidden">
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        generatingSessionId={generatingSessionId}
        searchQuery={searchQuery}
        user={user}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNew={newChat}
        onSelect={selectSession}
        onDelete={deleteSession}
        onTogglePin={togglePin}
        onRename={renameSession}
        onSearch={setSearchQuery}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        {/* top bar */}
        <header className="flex items-center gap-2 border-b border-line px-4 py-2.5">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-md p-1.5 text-mute hover:bg-panel hover:text-ink md:hidden"
            aria-label="Open sidebar"
          >
            <Menu size={17} />
          </button>

          {/* title + menu (topBarMenu equivalent) */}
          <div className="relative min-w-0" ref={topMenuRef}>
            {renamingTop ? (
              <input
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={() => {
                  if (activeSession && titleDraft.trim()) renameSession(activeSession.id, titleDraft.trim());
                  setRenamingTop(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  if (e.key === "Escape") setRenamingTop(false);
                }}
                className="w-56 rounded-md border border-edge bg-canvas px-2 py-1 text-[13.5px] text-ink outline-none focus:border-accent/60"
              />
            ) : (
              <button
                onClick={() => activeSession && setTopMenu((m) => !m)}
                className="flex max-w-[46vw] items-center gap-1.5 rounded-lg px-2 py-1 text-[13.5px] font-medium text-ink transition-colors hover:bg-panel"
                aria-haspopup="menu"
                aria-expanded={topMenu}
              >
                <span className="truncate">{activeSession?.title || "New chat"}</span>
                {activeSession && <span className="text-[10px] text-mute">▾</span>}
              </button>
            )}
            {topMenu && activeSession && (
              <div
                className="anim-pop absolute left-0 top-9 z-40 w-44 overflow-hidden rounded-xl border border-line bg-[#1d1d1d] py-1 shadow-[0_12px_32px_rgba(0,0,0,0.55)]"
                role="menu"
              >
                <button
                  onClick={() => {
                    setTitleDraft(activeSession.title);
                    setRenamingTop(true);
                    setTopMenu(false);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-[13px] text-ink/90 hover:bg-row"
                >
                  <Pencil size={13} className="text-mute" /> Rename
                </button>
                <button
                  onClick={exportChat}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-[13px] text-ink/90 hover:bg-row"
                >
                  <Download size={13} className="text-mute" /> Export chat
                </button>
                <button
                  onClick={() => {
                    deleteSession(activeSession.id);
                    setTopMenu(false);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-[13px] text-red-400 hover:bg-row"
                >
                  <Trash2 size={13} /> Delete chat
                </button>
              </div>
            )}
          </div>

          <div className="flex-1" />

          {/* backend status */}
          <div
            className={`hidden items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[11px] font-medium sm:flex ${
              online === false ? "text-amber-400/90" : "text-mute"
            }`}
            title={online === false ? `Can't reach ${getBackendUrl()} — simulated engine active` : "server.js reachable"}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                online === false ? "bg-amber-400" : online ? "bg-emerald-400" : "bg-mute animate-pulse"
              }`}
            />
            {online === false ? "Simulated" : online ? "Live" : "Checking…"}
          </div>

          <span className="rounded-full border border-line px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-accent">
            {tierLabel}
          </span>

          <button
            onClick={() => setSettingsOpen(true)}
            className="rounded-md p-1.5 text-mute transition-colors hover:bg-panel hover:text-ink"
            aria-label="Settings"
          >
            <SettingsIcon size={16} />
          </button>
        </header>

        <ChatArea
          session={activeSession}
          user={user}
          showTimestamps={!!settings.showTimestamps}
          editingUid={editingUid}
          onSendPrompt={(t) => sendMessage(t, [])}
          onStartEdit={(uidVal) => setEditingUid(uidVal)}
          onCancelEdit={() => setEditingUid(null)}
          onSaveEdit={saveEdit}
          onRegenerate={regenerate}
        />

        {online === false && (
          <div className="anim-rise mx-auto mb-1 flex w-fit items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/[0.07] px-3 py-1 text-[11.5px] text-amber-300/90">
            <X size={11} className="opacity-0" />
            Can't reach the Luca backend at {getBackendUrl()} — answers are simulated locally
          </div>
        )}

        <Composer
          generating={generating && generatingSessionId === activeSessionId}
          enterToSend={!!settings.enterToSend}
          tier={tier}
          onTierChange={(t) => {
            setTier(t);
            persistTier(t);
          }}
          onSend={sendMessage}
          onStop={stopStreaming}
        />
      </main>

      {settingsOpen && (
        <SettingsModal
          settings={settings}
          onClose={() => setSettingsOpen(false)}
          onSave={setSettings}
          onReplayOnboarding={() => {
            setSettingsOpen(false);
            setUser(null);
          }}
        />
      )}
    </div>
  );
}
