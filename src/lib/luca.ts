/* Luca AI — types, storage contract & helpers.
   Storage keys mirror the original project exactly:
   'luca-settings' · 'luca_tier' · 'luca-sessions' · 'luca-active-session' · 'luca-onboarding' */

export type Tier = "flash" | "pro";

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string;
}

export interface ToolSource {
  title: string;
  url: string;
  host: string;
}

export interface ToolRound {
  id: string;
  name: string;
  query: string;
  sources: ToolSource[];
  status: "running" | "done" | "error";
  ms?: number;
}

export interface LucaMessage {
  uid: string;
  role: "user" | "assistant";
  content: string;
  ts: number;
  tier?: Tier;
  reasoning?: string;
  thinkingMs?: number;
  toolRounds?: ToolRound[];
  attachments?: Attachment[];
  error?: string;
  interrupted?: boolean;
  streaming?: boolean;
}

export interface Session {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
  messages: LucaMessage[];
}

export interface Settings {
  theme: "dark" | "light";
  enterToSend: boolean;
  showTimestamps: boolean;
  backendUrl: string;
  customPrompt: string;
  personality: { creativity: number; formality: number; verbosity: number };
}

export interface Profile {
  name: string;
  persona: string | null;
  theme: "dark" | "light";
  avatar: string | null;
  completedAt?: number;
  complete?: boolean;
  step?: number;
}

export const MODELS: { id: string; label: string; tier: Tier; desc: string }[] = [
  { id: "luca-flash", label: "Flash", tier: "flash", desc: "Fast tier — quick, efficient, low-latency" },
  { id: "luca-pro", label: "Pro", tier: "pro", desc: "Deeper reasoning for complex tasks" },
];

export const MAX_SESSIONS = 500;
export const COMPOSER_MAX_LEN = 200000;

const SETTINGS_KEY = "luca-settings";
const SESSIONS_KEY = "luca-sessions";
const ACTIVE_KEY = "luca-active-session";
const TIER_KEY = "luca_tier";
const ONBOARD_KEY = "luca-onboarding";

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/* Same semantics as the original getBackendUrl(): read 'luca-settings',
   strip trailing slashes, fall back to http://localhost:3000. */
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
    /* storage unavailable */
  }
  return "http://localhost:3000";
}

const DEFAULT_SETTINGS: Settings = {
  theme: "dark",
  enterToSend: true,
  showTimestamps: true,
  backendUrl: "",
  customPrompt: "",
  personality: { creativity: 50, formality: 50, verbosity: 50 },
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return {
        ...DEFAULT_SETTINGS,
        ...p,
        personality: { ...DEFAULT_SETTINGS.personality, ...(p.personality || {}) },
      };
    }
  } catch {
    /* fall through */
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function loadTier(): Tier {
  try {
    const v = localStorage.getItem(TIER_KEY);
    if (v === "flash" || v === "pro") return v;
  } catch {
    /* ignore */
  }
  return "pro";
}

export function saveTier(t: Tier): void {
  try {
    localStorage.setItem(TIER_KEY, t);
  } catch {
    /* ignore */
  }
}

export function loadSessions(): Session[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) return list as Session[];
    }
  } catch {
    /* ignore */
  }
  return [];
}

export function saveSessions(list: Session[]): void {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(list.slice(0, MAX_SESSIONS)));
  } catch {
    /* quota / private mode */
  }
}

export function loadActiveId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

export function saveActiveId(id: string | null): void {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch {
    /* ignore */
  }
}

export function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(ONBOARD_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && p.complete === true) return p as Profile;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/* In-progress wizard draft (complete:false), same key as the finished profile. */
export function loadOnboardDraft(): Profile | null {
  try {
    const raw = localStorage.getItem(ONBOARD_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && p.complete === false) return p as Profile;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function saveOnboardDraft(d: Profile): void {
  try {
    localStorage.setItem(ONBOARD_KEY, JSON.stringify({ ...d, complete: false }));
  } catch {
    /* ignore */
  }
}

export function saveProfile(p: Profile): void {
  try {
    localStorage.setItem(ONBOARD_KEY, JSON.stringify({ ...p, complete: true }));
  } catch {
    /* ignore */
  }
}

export function dayBucket(ts: number): "Pinned" | "Today" | "Yesterday" | "Previous 7 days" | "Older" {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86400000;
  const startOfWeek = startOfToday - 6 * 86400000;
  if (ts >= startOfToday) return "Today";
  if (ts >= startOfYesterday) return "Yesterday";
  if (ts >= startOfWeek) return "Previous 7 days";
  return "Older";
}

export function timeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === now.toDateString()) return time;
  return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${time}`;
}

export function titleFromMessage(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= 44) return clean || "New chat";
  return clean.slice(0, 44).replace(/\s+\S*$/, "") + "…";
}

/* Downscale to a small JPEG — same approach as the original avatar picker. */
export function downscaleImage(dataUrl: string, maxSize: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(dataUrl);
      ctx.drawImage(img, 0, 0, w, h);
      try {
        resolve(canvas.toDataURL("image/jpeg", 0.88));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      return true;
    } catch {
      return false;
    }
  }
}
