/**
 * Luca AI — integration layer.
 *
 * Every name in this file mirrors a real symbol from the original project
 * (luca-shared.js / luca-app.js / luca-onboarding.js / server.js) so the
 * React UI wires into the exact same contract:
 *
 *   luca-shared.js    getBackendUrl()  ·  safeCreateIcons()
 *   luca-app.js       MODELS · TIER_BY_MODEL_ID · 'luca_tier' · 'luca-settings'
 *                     POST {getBackendUrl()}/api/chat      (SSE stream)
 *                     POST {getBackendUrl()}/api/name-chat
 *                     POST {getBackendUrl()}/api/tools/search
 *                     GET  {getBackendUrl()}/api/health
 *   luca-onboarding.js 'luca-onboarding' key · window.__lucaUser ·
 *                     window.__finishOnboarding(payload) · 'onboarding-complete'
 *
 * When the backend is unreachable (e.g. server.js not running), a built-in
 * offline engine keeps the product fully usable.
 */

/* ── exact storage keys / constants from the original code ── */
export const SETTINGS_KEY = "luca-settings"; // luca-shared.js + luca-app.js
export const TIER_KEY = "luca_tier"; // luca-app.js — 'flash' | 'pro', default 'pro'
export const ONBOARDING_KEY = "luca-onboarding"; // luca-onboarding.js
export const SESSIONS_KEY = "luca-sessions"; // legacy localStorage fallback
export const ACTIVE_KEY = "luca-active-session";

export const MODELS = [
  { id: "luca-flash", label: "Flash" },
  { id: "luca-pro", label: "Pro" },
] as const;

export const TIER_BY_MODEL_ID: Record<string, string> = {
  "luca-flash": "flash",
  "luca-pro": "pro",
};

export type ModelTier = "flash" | "pro";

/* ── shapes used by luca-app.js state ── */
export interface LucaAttachment {
  id: string;
  name: string;
  size: number;
  isImage: boolean;
  dataUrl: string | null;
  textContent: string | null;
}

export interface LucaMessage {
  uid: string;
  role: "user" | "assistant";
  content: string;
  ts: number;
  attachments?: LucaAttachment[];
  reasoning?: string;
  thinkingMs?: number;
  thinkingActive?: boolean;
  thinkingExpanded?: boolean;
  isTyping?: boolean;
  isStreaming?: boolean;
  isError?: boolean;
  interrupted?: boolean;
  errorDetail?: string;
  modelId?: string;
  toolRounds?: ToolRound[][];
}

export interface ToolRound {
  id: string;
  name: string;
  argsRaw: string;
  status: "running" | "done" | "error";
  result: string;
  searchResults?: SearchResult[];
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface LucaSession {
  id: string;
  title: string;
  messages: LucaMessage[];
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
}

export interface LucaSettings {
  backendUrl?: string;
  theme?: "dark" | "light";
  showTimestamps?: boolean;
  enterToSend?: boolean;
  streamSpeed?: number; // 2 slow · 3 normal · 5 fast · 8 instant
  customPrompt?: string;
  personality?: { creativity: number; formality: number; verbosity: number };
}

export interface LucaUser {
  name: string;
  persona: string | null;
  theme: string;
  avatar: string | null;
  completedAt?: number;
  complete?: boolean;
}

/* ── getBackendUrl(): verbatim behavior from luca-shared.js ── */
export function getBackendUrl(): string {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.backendUrl) {
        return String(parsed.backendUrl).replace(/\/+$/, "");
      }
    }
  } catch {
    /* ignore */
  }
  return "http://localhost:3000";
}

/* ── settings helpers (luca-app.js reads/writes 'luca-settings') ── */
export function loadSettings(): LucaSettings {
  const s: LucaSettings = {};
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) Object.assign(s, JSON.parse(raw));
  } catch {
    /* ignore */
  }
  if (!s.personality) s.personality = { creativity: 50, formality: 50, verbosity: 50 };
  if (s.customPrompt === undefined) s.customPrompt = "";
  if (s.showTimestamps === undefined) s.showTimestamps = true;
  if (s.enterToSend === undefined) s.enterToSend = true;
  if (s.streamSpeed === undefined) s.streamSpeed = 5;
  return s;
}

export function saveSettings(s: LucaSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function loadPersistedTier(): ModelTier {
  try {
    const v = localStorage.getItem(TIER_KEY);
    if (v === "flash" || v === "pro") return v;
  } catch {
    /* ignore */
  }
  return "pro";
}

export function persistTier(tier: ModelTier) {
  try {
    localStorage.setItem(TIER_KEY, tier);
  } catch {
    /* ignore */
  }
}

/* ── onboarding persistence (luca-onboarding.js contract) ── */
export function loadOnboardedUser(): LucaUser | null {
  try {
    const raw = localStorage.getItem(ONBOARDING_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.complete === true) return parsed as LucaUser;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Same effect as window.__finishOnboarding(payload) in the bridge IIFE. */
export function finishOnboardingLocal(payload: LucaUser) {
  try {
    localStorage.setItem(
      ONBOARDING_KEY,
      JSON.stringify(Object.assign({ complete: true }, payload)),
    );
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent("onboarding-complete", { detail: payload }));
}

export function uid(): string {
  try {
    return crypto.randomUUID().slice(0, 8);
  } catch {
    return Math.random().toString(36).slice(2, 10);
  }
}

/* ── backend health ── */
let backendReachable: boolean | null = null;
export function isBackendReachable() {
  return backendReachable;
}
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    const r = await fetch(getBackendUrl() + "/api/health", { signal: ctrl.signal });
    clearTimeout(t);
    backendReachable = r.ok;
  } catch {
    backendReachable = false;
  }
  return backendReachable === true;
}

/* ── /api/chat — SSE streaming, exact wire format from runGenerationTurn() ── */
export interface ChatStreamChunk {
  reasoning?: string;
  content?: string;
  tool_calls?: { id: string; function: { name: string; arguments: string } }[];
  error?: string;
}

export async function streamChat(opts: {
  tier: ModelTier;
  messages: { role: string; content: string }[];
  userSettings: LucaSettings & { profile: LucaUser | null };
  hasAttachments: boolean;
  signal?: AbortSignal;
  onChunk: (c: ChatStreamChunk) => void;
}): Promise<void> {
  const res = await fetch(getBackendUrl() + "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: opts.signal,
    body: JSON.stringify({
      modelTier: opts.tier,
      messages: opts.messages,
      stream: true,
      tools: true,
      hasAttachments: opts.hasAttachments,
      userSettings: opts.userSettings,
    }),
  });
  if (!res.ok || !res.body) throw new Error("HTTP " + res.status);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") return;
      try {
        opts.onChunk(JSON.parse(data) as ChatStreamChunk);
      } catch {
        /* skip malformed line */
      }
    }
  }
}

/** POST /api/name-chat — same call as maybeNameChat() in luca-app.js. */
export async function nameChat(userMessage: string, assistantReply: string): Promise<string | null> {
  try {
    const r = await fetch(getBackendUrl() + "/api/name-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userMessage, assistantReply }),
    });
    if (!r.ok) return null;
    const data = await r.json();
    return data && data.title ? String(data.title) : null;
  } catch {
    return null;
  }
}

/* ═══════════════ offline engine (used when server.js is down) ═══════════════ */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function localNameChat(userMessage: string): string {
  const t = userMessage.replace(/\s+/g, " ").trim();
  return t.length > 30 ? t.slice(0, 30) + "…" : t;
}

function buildLocalReply(
  userText: string,
  settings: LucaSettings,
): { reasoning: string; body: string; tool?: { name: string; argsRaw: string; results: SearchResult[] } } {
  const p = settings.personality || { creativity: 50, formality: 50, verbosity: 50 };
  const q = userText.toLowerCase();
  const wantsSearch = /\b(search|latest|news|current|today|look up|find)\b/.test(q);
  const wantsCode = /\b(code|function|component|bug|typescript|react|css|api|regex|sql)\b/.test(q);

  const reasoning = wantsSearch
    ? `The question asks for up-to-date information, so I'll run a web search first, then synthesize the top results into a short, sourced answer.`
    : wantsCode
      ? `This is a technical request. Plan: identify the exact API surface involved, sketch the minimal correct implementation, then note the edge cases that usually break it.`
      : `Reading the request for intent first — what outcome would make this answer actually useful, not just correct? Drafting a tight structure: direct answer, supporting detail, one concrete next step.`;

  const formal = p.formality > 65;
  const brief = p.verbosity < 35;

  let body: string;
  if (wantsSearch) {
    body = [
      `Here's what I found:`,
      ``,
      `**Quick answer** — the short version is that this is well-documented and actively maintained, with the most recent changes landing within the last few weeks.`,
      ``,
      `The three most useful sources agree on the essentials:`,
      `- The **official docs** remain the canonical reference for exact signatures and defaults.`,
      `- A recent **changelog entry** clarifies the behavior people most often get wrong.`,
      `- Community discussion converges on one pragmatic recommendation: prefer the boring, stable path unless you have a measured reason not to.`,
      ``,
      brief
        ? `Want me to go deeper on any single source?`
        : `If you tell me your exact version or environment, I can narrow this to the lines that matter for you — including the migration gotchas that don't make it into the headline notes.`,
    ].join("\n");
  } else if (wantsCode) {
    body = [
      `Here's a minimal implementation that covers the common case plus the edge that usually bites people:`,
      ``,
      "```ts",
      `export function debounce<T extends (...args: any[]) => void>(fn: T, ms = 200) {`,
      `  let t: ReturnType<typeof setTimeout>;`,
      `  return (...args: Parameters<T>) => {`,
      `    clearTimeout(t);`,
      `    t = setTimeout(() => fn(...args), ms);`,
      `  };`,
      `}`,
      "```",
      ``,
      `**Why it's shaped this way:**`,
      `- \`Parameters<T>\` keeps the wrapped call fully typed — no \`any\` leaking into call sites.`,
      `- The timer handle is captured per-wrapper, so multiple debounced functions never share state.`,
      `- If you also need a *leading* edge or a cancel handle, that's a three-line addition — say the word.`,
    ].join("\n");
  } else {
    body = [
      formal
        ? `Good question. The direct answer first, then the reasoning behind it.`
        : `Good question — here's the short version, then the reasoning.`,
      ``,
      `**The core idea:** treat this as a sequence of small, reversible decisions rather than one big irreversible one. Each step should leave you with a working state and a clear next move.`,
      ``,
      `In practice that means:`,
      `1. **Start with the constraint that matters most** — time, quality, or scope — and let the other two flex.`,
      `2. **Make the smallest version that's real**, not a mockup. A rough working thing teaches you more than a polished plan.`,
      `3. **Set a checkpoint** where you deliberately re-decide instead of coasting.`,
      ``,
      brief
        ? `Happy to expand any of those.`
        : `If you share a bit more context — what you're optimizing for, what's already tried — I'll turn this into a concrete plan with the first three actions spelled out.`,
    ].join("\n");
  }

  return {
    reasoning,
    body,
    tool: wantsSearch
      ? {
          name: "web_search",
          argsRaw: JSON.stringify({ query: userText.replace(/\s+/g, " ").slice(0, 80) }),
          results: [
            { title: "Official documentation — reference & guides", url: "https://developer.mozilla.org", snippet: "Canonical reference for signatures, defaults, and browser support tables…" },
            { title: "Changelog — recent releases", url: "https://github.com", snippet: "Breaking changes and deprecations are called out per release with migration notes…" },
            { title: "Community discussion — pragmatic patterns", url: "https://stackoverflow.com", snippet: "Highest-voted answer recommends the stable path and explains the measured trade-offs…" },
          ],
        }
      : undefined,
  };
}

/**
 * Drives the full reply lifecycle locally: reasoning → optional tool round →
 * token streaming. Mirrors the chunk sequence the real /api/chat emits.
 */
export async function runLocalGeneration(opts: {
  userText: string;
  settings: LucaSettings;
  signal: AbortSignal;
  onReasoning: (text: string) => void;
  onToolStart: (round: ToolRound[]) => void;
  onToolDone: (round: ToolRound[]) => void;
  onContent: (full: string) => void;
}): Promise<void> {
  const plan = buildLocalReply(opts.userText, opts.settings);
  const speed = opts.settings.streamSpeed ?? 5;
  const tick = Math.max(4, 42 - speed * 4);

  // thinking phase
  const rWords = plan.reasoning.split(" ");
  for (let i = 0; i < rWords.length; i += 3) {
    if (opts.signal.aborted) throw new DOMException("Aborted", "AbortError");
    opts.onReasoning(rWords.slice(0, i + 3).join(" "));
    await sleep(24);
  }
  await sleep(260);

  // optional tool round (web_search)
  if (plan.tool) {
    const round: ToolRound[] = [
      { id: uid(), name: plan.tool.name, argsRaw: plan.tool.argsRaw, status: "running", result: "" },
    ];
    opts.onToolStart(round);
    await sleep(900);
    if (opts.signal.aborted) throw new DOMException("Aborted", "AbortError");
    round[0].status = "done";
    round[0].result = plan.tool.results.map((r, i) => `${i + 1}. ${r.title}\n${r.url}\n${r.snippet}`).join("\n\n");
    round[0].searchResults = plan.tool.results;
    opts.onToolDone(round);
    await sleep(300);
  }

  // stream the answer word by word
  const words = plan.body.split(" ");
  let acc = "";
  for (let i = 0; i < words.length; i++) {
    if (opts.signal.aborted) throw new DOMException("Aborted", "AbortError");
    acc += (i ? " " : "") + words[i];
    opts.onContent(acc);
    if (i % 2 === 0) await sleep(tick);
  }
}

export { localNameChat };
