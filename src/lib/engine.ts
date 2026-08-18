/* Luca AI — response engine.
   Talks to the real backend only: POST {getBackendUrl()}/api/chat as SSE
     lines: ` {"reasoning"|"content"|"reply"|"tool_calls"}` … ` [DONE]`
   Tool calls are executed client-side against /api/tools/search and
   /api/tools/images, results fed back as role:"tool" (max 6 iterations).
   There is no simulated fallback — if server.js isn't running, the request
   fails and the message shows the backend error. */

import { getBackendUrl, uid } from "./luca";
import type { Settings, Tier, ToolSource } from "./luca";

export type EngineEvent =
  | { kind: "reasoning"; text: string }
  | { kind: "content"; text: string }
  | { kind: "tool-start"; roundId: string; name: string; query: string }
  | { kind: "tool-end"; roundId: string; sources: ToolSource[]; ms: number }
  | { kind: "done" };

export interface HistoryMsg {
  role: "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
}

interface StreamOpts {
  tier: Tier;
  history: HistoryMsg[];
  settings: Settings;
  signal: AbortSignal;
}

const AGENT_MAX_ITERATIONS = 6;

export function isAbortError(e: unknown): boolean {
  return e instanceof DOMException && e.name === "AbortError";
}

export async function healthCheck(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch(getBackendUrl() + "/api/health", { signal: ctrl.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

export async function nameChat(userMessage: string, assistantReply: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(getBackendUrl() + "/api/name-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userMessage, assistantReply }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const j = await res.json();
    return typeof j.title === "string" && j.title.trim() ? j.title.trim() : null;
  } catch {
    return null;
  }
}

async function fetchToolSources(name: string, query: string, signal: AbortSignal): Promise<ToolSource[]> {
  const path = name === "search_images" ? "/api/tools/images" : "/api/tools/search";
  const res = await fetch(getBackendUrl() + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
    signal,
  });
  if (!res.ok) throw new Error("Tool request failed (" + res.status + ")");
  const j = await res.json();
  const list: ToolSource[] = [];
  for (const r of j.results || []) {
    const url = r.url || r.source || "";
    let host = "";
    try {
      host = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      host = url;
    }
    list.push({ title: r.title || host, url, host: host || "source" });
  }
  return list.slice(0, 4);
}

export async function* streamChat(opts: StreamOpts): AsyncGenerator<EngineEvent> {
  const base = getBackendUrl();
  const userSettings = {
    personality: opts.settings.personality,
    customPrompt: opts.settings.customPrompt,
  };

  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  opts.signal.addEventListener("abort", onAbort, { once: true });

  let messages: HistoryMsg[] = [...opts.history];
  let guard = 0;

  while (guard++ < AGENT_MAX_ITERATIONS) {
    const res = await fetch(base + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        modelTier: opts.tier,
        messages,
        stream: true,
        tools: true,
        userSettings,
      }),
      signal: ctrl.signal,
    });

    if (!res.ok || !res.body) {
      let detail = "Backend error " + res.status;
      try {
        const j = await res.json();
        if (j && typeof j.error === "string" && j.error) detail = j.error;
      } catch {
        /* keep the status-only message */
      }
      throw new Error(detail);
    }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let accContent = "";
    let pendingToolCalls: NonNullable<HistoryMsg["tool_calls"]> = [];
    let sawDone = false;
    const yieldQueue: EngineEvent[] = [];

    const handleLine = (line: string) => {
      const t = line.trim();
      if (!t.startsWith("data:")) return;
      const payload = t.slice(5).trim();
      if (payload === "[DONE]") {
        sawDone = true;
        return;
      }
      try {
        const j = JSON.parse(payload);
        if (typeof j.reasoning === "string" && j.reasoning) {
          yieldQueue.push({ kind: "reasoning", text: j.reasoning });
        }
        const c = typeof j.content === "string" ? j.content : typeof j.reply === "string" ? j.reply : "";
        if (c) {
          accContent += c;
          yieldQueue.push({ kind: "content", text: c });
        }
        if (Array.isArray(j.tool_calls) && j.tool_calls.length) {
          for (const tc of j.tool_calls) {
            if (tc && tc.function) {
              const idx = pendingToolCalls.findIndex((p) => p.id === tc.id);
              if (idx >= 0) {
                pendingToolCalls[idx].function.arguments += tc.function.arguments || "";
              } else {
                pendingToolCalls.push({
                  id: tc.id || "call_" + uid(),
                  type: "function",
                  function: { name: tc.function.name || "", arguments: tc.function.arguments || "" },
                });
              }
            }
          }
        }
      } catch {
        /* partial JSON line — ignore */
      }
    };

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() || "";
      for (const line of lines) handleLine(line);
      while (yieldQueue.length) yield yieldQueue.shift()!;
      if (sawDone) break;
    }
    while (yieldQueue.length) yield yieldQueue.shift()!;

    /* agent loop: execute tool calls, feed results back, go again */
    if (pendingToolCalls.length) {
      messages = [
        ...messages,
        { role: "assistant", content: accContent || "", tool_calls: pendingToolCalls },
      ];
      for (const tc of pendingToolCalls) {
        let args: { query?: string } = {};
        try {
          args = JSON.parse(tc.function.arguments || "{}");
        } catch {
          /* keep empty */
        }
        const query = args.query || "";
        const roundId = uid();
        const started = Date.now();
        yield { kind: "tool-start", roundId, name: tc.function.name, query };
        let sources: ToolSource[] = [];
        try {
          sources = await fetchToolSources(tc.function.name, query, ctrl.signal);
        } catch (e) {
          if (isAbortError(e)) throw e;
        }
        yield { kind: "tool-end", roundId, sources, ms: Date.now() - started };
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify({ results: sources.map((s) => ({ title: s.title, url: s.url, host: s.host })) }),
        });
      }
      pendingToolCalls = [];
      continue;
    }
    break;
  }

  yield { kind: "done" };
}
