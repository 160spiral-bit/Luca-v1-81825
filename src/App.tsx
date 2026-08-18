import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Menu, Settings as SettingsIcon } from "lucide-react";
import Sidebar from "./components/Sidebar";
import ChatArea from "./components/ChatArea";
import Composer from "./components/Composer";
import Onboarding from "./components/Onboarding";
import SettingsModal from "./components/SettingsModal";
import SourceModal from "./components/SourceModal";
import LoadingScreen from "./components/LoadingScreen";
import { isAbortError, nameChat, streamChat } from "./lib/engine";
import type { EngineEvent, HistoryMsg } from "./lib/engine";
import {
  loadActiveId,
  loadProfile,
  loadSessions,
  loadSettings,
  loadTier,
  resetAll,
  saveActiveId,
  saveSessions,
  saveSettings,
  saveTier,
  titleFromMessage,
  uid,
} from "./lib/luca";
import type { Attachment, LucaMessage, Profile, Session, Settings, Tier, ToolRound } from "./lib/luca";

interface Toast {
  id: string;
  text: string;
}

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(() => loadProfile());
  const [sessions, setSessions] = useState<Session[]>(() => loadSessions());
  const [activeId, setActiveId] = useState<string | null>(() => {
    const id = loadActiveId();
    return id && loadSessions().some((s) => s.id === id) ? id : null;
  });
  const [tier, setTier] = useState<Tier>(() => loadTier());
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [ready, setReady] = useState(true);
  const [streaming, setStreaming] = useState<{ sessionId: string; msgUid: string } | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [search, setSearch] = useState("");

  const abortRef = useRef<AbortController | null>(null);
  const saveTimer = useRef<number | undefined>(undefined);

  const activeSession = sessions.find((s) => s.id === activeId) || null;
  const isStreaming = streaming !== null;

  const toast = useCallback((text: string) => {
    const id = uid();
    setToasts((prev) => [...prev.slice(-2), { id, text }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2400);
  }, []);

  /* ---------- persistence (debounced — streams update state often) ---------- */
  useEffect(() => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => saveSessions(sessions), 350);
    return () => window.clearTimeout(saveTimer.current);
  }, [sessions]);

  useEffect(() => saveActiveId(activeId), [activeId]);
  useEffect(() => saveTier(tier), [tier]);
  useEffect(() => {
    saveSettings(settings);
    document.documentElement.setAttribute("data-theme", settings.theme);
  }, [settings]);

  /* ---------- message patching ---------- */
  const patchMsg = useCallback((sessionId: string, msgUid: string, patch: Partial<LucaMessage>) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? { ...s, updatedAt: Date.now(), messages: s.messages.map((m) => (m.uid === msgUid ? { ...m, ...patch } : m)) }
          : s,
      ),
    );
  }, []);

  const patchRound = useCallback(
    (sessionId: string, msgUid: string, roundId: string, patch: Partial<ToolRound>) => {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                updatedAt: Date.now(),
                messages: s.messages.map((m) => {
                  if (m.uid !== msgUid) return m;
                  const rounds = m.toolRounds || [];
                  const exists = rounds.some((r) => r.id === roundId);
                  return {
                    ...m,
                    toolRounds: exists
                      ? rounds.map((r) => (r.id === roundId ? { ...r, ...patch } : r))
                      : [...rounds, { id: roundId, name: "web_search", query: "", sources: [], status: "running" as const, ...patch }],
                  };
                }),
              }
            : s,
        ),
      );
    },
    [],
  );

  /* ---------- the streaming runner ---------- */
  const runStream = useCallback(
    async (
      sessionId: string,
      assistantUid: string,
      history: HistoryMsg[],
      userText: string,
      currentTier: Tier,
      firstExchange: boolean,
    ) => {
      const controller = new AbortController();
      abortRef.current = controller;
      setStreaming({ sessionId, msgUid: assistantUid });

      let acc = "";
      let reasoning = "";
      const startedAt = Date.now();
      let firstContentAt: number | null = null;

      try {
        const gen = streamChat({ tier: currentTier, history, settings, signal: controller.signal });
        for await (const ev of gen as AsyncGenerator<EngineEvent>) {
          switch (ev.kind) {
            case "reasoning":
              reasoning += ev.text;
              patchMsg(sessionId, assistantUid, { reasoning });
              break;
            case "content":
              if (!firstContentAt) firstContentAt = Date.now();
              acc += ev.text;
              patchMsg(sessionId, assistantUid, { content: acc });
              break;
            case "tool-start":
              patchRound(sessionId, assistantUid, ev.roundId, { name: ev.name, query: ev.query, status: "running" });
              break;
            case "tool-end":
              patchRound(sessionId, assistantUid, ev.roundId, { sources: ev.sources, status: "done", ms: ev.ms });
              break;
            case "done":
              break;
          }
        }
        patchMsg(sessionId, assistantUid, {
          streaming: false,
          thinkingMs: reasoning ? (firstContentAt || Date.now()) - startedAt : undefined,
        });
      } catch (e) {
        if (isAbortError(e)) {
          patchMsg(sessionId, assistantUid, { streaming: false, interrupted: true });
        } else {
          const raw = e instanceof Error && e.message ? e.message : "Something went wrong while generating.";
          const friendly = /failed to fetch|networkerror|load failed|typeerror/i.test(raw)
            ? "Backend not reachable — start server.js (node server.js) and try again."
            : raw;
          patchMsg(sessionId, assistantUid, { streaming: false, error: friendly });
        }
      } finally {
        setStreaming(null);
        abortRef.current = null;
      }

      /* name the chat after its first exchange — real endpoint, local fallback */
      if (firstExchange) {
        const title = (await nameChat(userText, acc)) || titleFromMessage(userText);
        setSessions((cur) => cur.map((x) => (x.id === sessionId && x.title === "New chat" ? { ...x, title } : x)));
      }
    },
    [settings, patchMsg, patchRound],
  );

  /* ---------- actions ---------- */
  const buildHistory = (msgs: LucaMessage[], withAttachments?: Attachment[]): HistoryMsg[] => {
    const hist: HistoryMsg[] = msgs
      .filter((m) => (m.role === "user" ? m.content : m.content || m.toolRounds?.length))
      .map((m) => ({
        role: m.role,
        content:
          m.role === "user"
            ? m.content +
              (m.attachments?.length ? "\n[Attached: " + m.attachments.map((a) => a.name).join(", ") + "]" : "")
            : m.content,
      }));
    void withAttachments;
    return hist;
  };

  const sendMessage = useCallback(
    (text: string, attachments: Attachment[]) => {
      if (isStreaming) return;

      let sessionId = activeId;
      let baseMessages: LucaMessage[] = [];
      if (!sessionId || activeSession?.messages.length) {
        sessionId = uid();
        const session: Session = { id: sessionId, title: "New chat", createdAt: Date.now(), updatedAt: Date.now(), messages: [] };
        setSessions((prev) => [session, ...prev].slice(0, 500));
        setActiveId(sessionId);
      } else {
        baseMessages = activeSession?.messages || [];
      }

      const userMsg: LucaMessage = {
        uid: uid(),
        role: "user",
        content: text,
        ts: Date.now(),
        attachments: attachments.length ? attachments : undefined,
      };
      const assistantMsg: LucaMessage = {
        uid: uid(),
        role: "assistant",
        content: "",
        ts: Date.now(),
        tier,
        streaming: true,
        toolRounds: [],
      };

      const sid = sessionId;
      setSessions((prev) =>
        prev.map((s) => (s.id === sid ? { ...s, updatedAt: Date.now(), messages: [...s.messages, userMsg, assistantMsg] } : s)),
      );

      const history = [...buildHistory(baseMessages), { role: "user" as const, content: userMsg.content }];
      void runStream(sid, assistantMsg.uid, history, text, tier, baseMessages.length === 0);
    },
    [activeId, activeSession, isStreaming, tier, runStream],
  );

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const regenerate = useCallback(
    (sessionId: string, msgUid: string) => {
      if (isStreaming) return;
      const session = sessions.find((s) => s.id === sessionId);
      if (!session) return;
      const idx = session.messages.findIndex((m) => m.uid === msgUid);
      if (idx < 0) return;
      const before = session.messages.slice(0, idx);
      const lastUser = [...before].reverse().find((m) => m.role === "user");
      if (!lastUser) return;

      const history = buildHistory(before);
      const assistantMsg: LucaMessage = {
        uid: msgUid,
        role: "assistant",
        content: "",
        ts: Date.now(),
        tier,
        streaming: true,
        toolRounds: [],
      };
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId ? { ...s, updatedAt: Date.now(), messages: [...before, assistantMsg] } : s,
        ),
      );
      void runStream(sessionId, msgUid, history, lastUser.content, tier, false);
    },
    [sessions, isStreaming, tier, runStream],
  );

  const editAndResend = useCallback(
    (sessionId: string, msgUid: string, text: string) => {
      if (isStreaming) return;
      const session = sessions.find((s) => s.id === sessionId);
      if (!session) return;
      const idx = session.messages.findIndex((m) => m.uid === msgUid);
      if (idx < 0) return;
      const before = session.messages.slice(0, idx);
      const userMsg: LucaMessage = { ...session.messages[idx], content: text, ts: Date.now() };
      const assistantMsg: LucaMessage = {
        uid: uid(),
        role: "assistant",
        content: "",
        ts: Date.now(),
        tier,
        streaming: true,
        toolRounds: [],
      };
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId ? { ...s, updatedAt: Date.now(), messages: [...before, userMsg, assistantMsg] } : s,
        ),
      );
      const history = [...buildHistory(before), { role: "user" as const, content: text }];
      void runStream(sessionId, assistantMsg.uid, history, text, tier, false);
    },
    [sessions, isStreaming, tier, runStream],
  );

  const newChat = useCallback(() => {
    setActiveId(null);
    setSearch("");
  }, []);

  /* full reset: abort anything running, wipe storage, drop back to onboarding */
  const resetEverything = useCallback(() => {
    abortRef.current?.abort();
    resetAll();
    setSessions([]);
    setActiveId(null);
    setSettingsOpen(false);
    setMobileNav(false);
    setSearch("");
    setTier("pro");
    document.documentElement.setAttribute("data-theme", "dark");
    setProfile(null);
  }, []);

  const deleteSession = useCallback(
    (id: string) => {
      if (streaming?.sessionId === id) abortRef.current?.abort();
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (activeId === id) setActiveId(null);
      toast("Chat deleted");
    },
    [activeId, streaming, toast],
  );

  const togglePin = useCallback((id: string) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, pinned: !s.pinned } : s)));
  }, []);

  const renameSession = useCallback((id: string, title: string) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, title } : s)));
  }, []);

  const onBoarded = useCallback((p: Profile) => {
    setProfile(p);
    setSettings((s) => ({ ...s, theme: p.theme }));
    setReady(false); /* show the interstitial, then reveal the app */
  }, []);

  /* ---------- onboarding ---------- */
  if (!profile) {
    return <Onboarding onComplete={onBoarded} />;
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-canvas text-ink">
      <Sidebar
        sessions={sessions}
        activeId={activeId}
        generatingId={streaming?.sessionId || null}
        search={search}
        onSearch={setSearch}
        onSelect={setActiveId}
        onNew={newChat}
        onRename={renameSession}
        onTogglePin={togglePin}
        onDelete={deleteSession}
        onOpenSettings={() => setSettingsOpen(true)}
        profile={profile}
        mobileOpen={mobileNav}
        onCloseMobile={() => setMobileNav(false)}
      />

      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="chat-ambient" aria-hidden="true" />

        <header className="relative z-20 flex h-[52px] shrink-0 items-center gap-1.5 border-b border-line bg-canvas/70 px-3.5 backdrop-blur-md">
          <button
            onClick={() => setMobileNav(true)}
            className="grid h-9 w-9 place-items-center rounded-lg text-mute transition-all duration-200 hover:bg-surface1 hover:text-ink active:scale-90 md:hidden"
            aria-label="Open sidebar"
          >
            <Menu size={17} />
          </button>

          <h1 className="max-w-[46ch] truncate text-sm font-semibold">
            {activeSession ? activeSession.title : "New chat"}
          </h1>

          <div className="flex-1" />

          <button
            onClick={() => setSourceOpen(true)}
            className="group flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-mute transition-all duration-200 hover:bg-surface1 hover:text-ink active:scale-95"
            aria-label="Download source code"
            title="Download source code"
          >
            <Download size={15} className="transition-transform duration-200 group-hover:translate-y-0.5" />
            <span className="hidden text-[13px] font-medium sm:inline">Source</span>
          </button>

          <button
            onClick={() => setSettingsOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-lg text-mute transition-all duration-200 hover:bg-surface1 hover:text-ink active:scale-90"
            aria-label="Open settings"
          >
            <SettingsIcon size={16} />
          </button>
        </header>

        <ChatArea
          session={activeSession}
          profile={profile}
          settings={settings}
          onSuggestion={(t) => sendMessage(t, [])}
          onRegenerate={regenerate}
          onEditResend={editAndResend}
          onToast={toast}
        />

        <Composer
          streaming={isStreaming}
          onSend={sendMessage}
          onStop={stopGeneration}
          tier={tier}
          onTierChange={setTier}
          settings={settings}
          onToast={toast}
        />
      </div>

      <SettingsModal
        open={settingsOpen}
        settings={settings}
        onChange={(patch) => setSettings((s) => ({ ...s, ...patch }))}
        onClose={() => setSettingsOpen(false)}
        onReset={resetEverything}
      />

      <SourceModal open={sourceOpen} onClose={() => setSourceOpen(false)} onToast={toast} />

      {/* interstitial between onboarding and the app */}
      {!ready && <LoadingScreen onDone={() => setReady(true)} />}

      {/* toasts */}
      <div className="pointer-events-none fixed bottom-5 left-5 z-[70] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="anim-toast pointer-events-auto flex items-center gap-2.5 rounded-xl border border-linestrong bg-surface2 px-4 py-2.5 text-[13px] shadow-[0_12px_32px_rgba(0,0,0,0.5)]"
            role="status"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
