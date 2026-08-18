/* Luca AI — response engine.
   Real path: POST {getBackendUrl()}/api/chat as SSE
     lines: `data: {"reasoning"|"content"|"reply"|"tool_calls"}` … `data: [DONE]`
   Tool calls are executed client-side against /api/tools/search and
   /api/tools/images, results fed back as role:"tool" (max 6 iterations).
   If the backend is unreachable (fetch throws), a local engine streams a
   reply so the product stays usable — the UI labels the mode honestly. */

import { getBackendUrl, uid } from "./luca";
import type { Settings, Tier, ToolSource } from "./luca";

export type EngineEvent =
  | { kind: "mode"; mode: "live" | "simulated" }
  | { kind: "reasoning"; text: string }
  | { kind: "content"; text: string }
  | { kind: "tool-start"; roundId: string; name: string; query: string }
  | { kind: "tool-end"; roundId: string; sources: ToolSource[]; ms: number }
  | { kind: "error"; message: string }
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
  think: boolean;
  settings: Settings;
  signal: AbortSignal;
}

const AGENT_MAX_ITERATIONS = 6;

export function isAbortError(e: unknown): boolean {
  return e instanceof DOMException && e.name === "AbortError";
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const t = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
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

  /* ---- try the real backend first ---- */
  let realFailed = false;
  try {
    const ctrl = new AbortController();
    const onAbort = () => ctrl.abort();
    opts.signal.addEventListener("abort", onAbort, { once: true });

    let messages: HistoryMsg[] = [...opts.history];
    let guard = 0;
    let firstIteration = true;

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
        if (firstIteration) {
          yield { kind: "error", message: "Backend error " + res.status + " — all models may be offline." };
          yield { kind: "done" };
          return;
        }
        break;
      }

      if (firstIteration) yield { kind: "mode", mode: "live" };
      firstIteration = false;

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let accContent = "";
      let pendingToolCalls: NonNullable<HistoryMsg["tool_calls"]> = [];
      let sawDone = false;

      const handleLine = async (line: string) => {
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
      const yieldQueue: EngineEvent[] = [];

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) await handleLine(line);
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
            yield { kind: "tool-end", roundId, sources, ms: Date.now() - started };
          } catch (e) {
            if (isAbortError(e)) throw e;
            yield { kind: "tool-end", roundId, sources: [], ms: Date.now() - started };
          }
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
    return;
  } catch (e) {
    if (isAbortError(e)) throw e;
    realFailed = true;
  }

  if (!realFailed) return;

  /* ---- backend unreachable: local engine ---- */
  yield { kind: "mode", mode: "simulated" };
  const lastUser = [...opts.history].reverse().find((m) => m.role === "user");
  const prompt = lastUser ? lastUser.content : "";
  const plan = composeReply(prompt, opts.think, opts.tier);

  if (plan.reasoning) {
    await sleep(650, opts.signal);
    for (const chunk of chunkWords(plan.reasoning, 4)) {
      await sleep(18, opts.signal);
      yield { kind: "reasoning", text: chunk };
    }
  }

  if (plan.toolQuery) {
    const roundId = uid();
    const started = Date.now();
    await sleep(500, opts.signal);
    yield { kind: "tool-start", roundId, name: "web_search", query: plan.toolQuery };
    await sleep(900 + Math.random() * 500, opts.signal);
    yield { kind: "tool-end", roundId, sources: plan.toolSources || [], ms: Date.now() - started };
  }

  const perTick = [2, 3, 5, 8].includes(opts.settings.streamSpeed) ? opts.settings.streamSpeed : 3;
  for (const chunk of chunkWords(plan.text, perTick)) {
    await sleep(12 + Math.random() * 16, opts.signal);
    yield { kind: "content", text: chunk };
  }

  yield { kind: "done" };
}

function chunkWords(text: string, size: number): string[] {
  const out: string[] = [];
  const parts = text.split(/(?<=\s)/);
  let cur = "";
  for (const p of parts) {
    cur += p;
    if (cur.length >= size) {
      out.push(cur);
      cur = "";
    }
  }
  if (cur) out.push(cur);
  return out;
}

/* ---------- local reply composer ---------- */

function hostOf(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
}

interface ReplyPlan {
  reasoning?: string;
  text: string;
  toolQuery?: string;
  toolSources?: ToolSource[];
}

function composeReply(prompt: string, think: boolean, tier: Tier): ReplyPlan {
  const p = prompt.toLowerCase();
  const wantsSearch =
    /(search|look up|check the docs|latest|news|current|weather|find (me )?(a )?source|cite)/.test(p);

  const reasoning = think
    ? [
        "Parsing the request and deciding what a complete answer needs.",
        "Breaking it into sub-parts so nothing gets skipped.",
        tier === "pro" ? "Weighing a couple of approaches before committing to one." : "Keeping it lean — the fast tier favors a direct answer.",
        "Drafting, then tightening the wording before streaming it out.",
      ].join("\n")
    : undefined;

  let text: string;
  let toolQuery: string | undefined;
  let toolSources: ToolSource[] | undefined;

  if (wantsSearch) {
    toolQuery = prompt.replace(/\s+/g, " ").trim().slice(0, 90);
    toolSources = [
      { title: "MDN Web Docs — reference", url: "https://developer.mozilla.org", host: "developer.mozilla.org" },
      { title: "Official documentation", url: "https://docs.github.com", host: "docs.github.com" },
      { title: "Discussion thread", url: "https://stackoverflow.com", host: "stackoverflow.com" },
    ].map((s) => ({ ...s, host: hostOf(s.url) }));
    text = `I pulled a few sources on that (chips above — the links are illustrative in this offline mode).\n\nThe short version:\n\n- **Start with the primary docs** — they settle most questions without guessing.\n- **Cross-check dates.** Anything older than ~12 months on a fast-moving tool deserves a second source.\n- **If two sources disagree**, the one with a reproducible example usually wins.\n\nWant me to go deeper on any specific point?`;
  } else if (/(hook|component|function|code|react|typescript|python|javascript|sql|regex|css|api|debug|script)/.test(p)) {
    text = [
      "Here's a compact implementation you can drop in:",
      "",
      "```tsx",
      "import { useEffect, useState } from \"react\";",
      "",
      "export function useDebouncedValue<T>(value: T, delay = 300): T {",
      "  const [settled, setSettled] = useState(value);",
      "",
      "  useEffect(() => {",
      "    const id = setTimeout(() => setSettled(value), delay);",
      "    return () => clearTimeout(id); // cancel-on-unmount + on re-run",
      "  }, [value, delay]);",
      "",
      "  return settled;",
      "}",
      "```",
      "",
      "Notes:",
      "",
      "- One timer, **zero dependencies** — every keystroke resets the window.",
      "- Cleanup runs on unmount *and* whenever `value` or `delay` changes.",
      "- Read the returned value in your fetch effect; the raw input stays instant for the UI.",
      "",
      "Tell me which part you'd like adapted and I'll rework it.",
    ].join("\n");
  } else if (/(plan|steps|how (do|to)|explain|difference|compare|why)/.test(p)) {
    text = [
      "Good question — here's the shape of it:",
      "",
      "1. **Start from the outcome.** Write one sentence describing what \"done\" looks like before touching any details.",
      "2. **List the constraints.** Time, tools, people — most plans fail on a constraint nobody wrote down.",
      "3. **Cut the first version in half.** Whatever step 1 is, there's a smaller step 0 that de-risks it.",
      "4. **Set a checkpoint, not a deadline.** A date you *review progress* is more useful than a date you *owe the result*.",
      "",
      "The pattern behind all four: make the next action obvious, so starting costs nothing.",
      "",
      "If you tell me the specifics, I'll turn this into a concrete plan rather than a template.",
    ].join("\n");
  } else if (/(write|draft|email|message|letter|caption|story|poem)/.test(p)) {
    text = [
      "Here's a first pass you can edit from:",
      "",
      "> Hi — wanted to circle back on this while it's still warm. I've got a clear picture of what's needed and a couple of options for how to get there. If you've got fifteen minutes this week, I'll bring a short summary and we can decide the next step together. If not, I'll send the summary by email and you can react async — either works for me.",
      "",
      "A few things I assumed, so flag if any are wrong:",
      "",
      "- Tone is **warm but brief** — no filler, no over-apologizing.",
      "- The ask is a *decision*, not a meeting for its own sake.",
      "- There's an async fallback, so it never blocks on calendars.",
      "",
      "Say the word and I'll tune the tone (more formal, more casual, shorter, punchier).",
    ].join("\n");
  } else {
    text = [
      "Here's how I'd think about it:",
      "",
      "The core idea is simpler than it looks. Strip away the surrounding noise and you're left with **one decision** and a few mechanics that follow from it. Get the decision right and the mechanics mostly sort themselves out — get it wrong and no amount of polish helps.",
      "",
      "Two things worth checking before you commit:",
      "",
      "- *What would change your mind?* If nothing would, you're not deciding — you're confirming.",
      "- *What's the smallest test?* Most questions like this have a cheap experiment that beats a long debate.",
      "",
      "Give me a bit more context — what you're optimizing for, what's already tried — and I'll get specific instead of general.",
    ].join("\n");
  }

  return { reasoning, text, toolQuery, toolSources };
}
