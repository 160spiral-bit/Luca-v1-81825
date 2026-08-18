/* Luca AI — response engine.
   Primary path: POST {getBackendUrl()}/api/chat as SSE
     lines: ` {"reasoning"|"content"|"reply"|"tool_calls"}` … ` [DONE]`
   Tool calls execute client-side against /api/tools/search and
   /api/tools/images, results fed back as role:"tool" (max 6 iterations).
   If the backend can't be reached (or errors), a built-in simulation
   streams a representative reply through the exact same event pipeline,
   so the full UI — thinking, tool rounds, markdown, code — is visible. */

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
  /* ---- try the real backend first ---- */
  let backendFailed = false;
  try {
    yield* realStream(opts);
    return;
  } catch (e) {
    if (isAbortError(e)) throw e;
    backendFailed = true;
  }

  if (!backendFailed) return;

  /* ---- backend unavailable: stream a simulated reply ---- */
  const lastUser = [...opts.history].reverse().find((m) => m.role === "user");
  const prompt = lastUser ? lastUser.content : "";
  const plan = composeReply(prompt, opts.tier);

  if (plan.reasoning) {
    await sleep(620, opts.signal);
    for (const chunk of chunkWords(plan.reasoning, 4)) {
      await sleep(14 + Math.random() * 14, opts.signal);
      yield { kind: "reasoning", text: chunk };
    }
    await sleep(380, opts.signal);
  }

  if (plan.toolQuery) {
    const roundId = uid();
    const started = Date.now();
    await sleep(480, opts.signal);
    yield { kind: "tool-start", roundId, name: "web_search", query: plan.toolQuery };
    await sleep(900 + Math.random() * 500, opts.signal);
    yield { kind: "tool-end", roundId, sources: plan.toolSources || [], ms: Date.now() - started };
    await sleep(420, opts.signal);
  }

  for (const chunk of chunkWords(plan.text, 3)) {
    await sleep(11 + Math.random() * 17, opts.signal);
    yield { kind: "content", text: chunk };
  }

  yield { kind: "done" };
}

async function* realStream(opts: StreamOpts): AsyncGenerator<EngineEvent> {
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

    if (!res.ok || !res.body) throw new Error("Backend error " + res.status);

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let accContent = "";
    let pendingToolCalls: NonNullable<HistoryMsg["tool_calls"]> = [];
    let sawDone = false;
    const yieldQueue: EngineEvent[] = [];

    const handleLine = (line: string) => {
      const t = line.trim();
      if (!t.startsWith("")) return;
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

    if (pendingToolCalls.length) {
      messages = [...messages, { role: "assistant", content: accContent || "", tool_calls: pendingToolCalls }];
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

/* ---------- simulation helpers ---------- */

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

interface ReplyPlan {
  reasoning?: string;
  text: string;
  toolQuery?: string;
  toolSources?: ToolSource[];
}

function composeReply(prompt: string, tier: Tier): ReplyPlan {
  const p = prompt.toLowerCase();
  const wantsSearch = /(search|look up|check the docs|latest|news|current|weather|find (me )?(a )?source|cite)/.test(p);

  const reasoning = [
    "Parsing the request — figuring out what a complete answer actually needs here.",
    "Breaking it into sub-parts so nothing gets skipped or hand-waved.",
    tier === "pro"
      ? "Weighing two or three approaches and picking the one that will age best."
      : "Keeping it lean — favoring the most direct path to the answer.",
    "Drafting the response, then tightening the wording before streaming it out.",
  ].join("\n");

  if (wantsSearch) {
    const query = prompt.replace(/\s+/g, " ").trim().slice(0, 90);
    return {
      reasoning,
      toolQuery: query,
      toolSources: [
        { title: "MDN Web Docs — reference", url: "https://developer.mozilla.org", host: "developer.mozilla.org" },
        { title: "Official documentation", url: "https://docs.github.com", host: "docs.github.com" },
        { title: "Discussion thread", url: "https://stackoverflow.com", host: "stackoverflow.com" },
      ],
      text: `I pulled a few sources on that — the chips above link out to them.\n\nThe short version:\n\n- **Start with the primary docs.** They settle most questions without any guesswork.\n- **Check the dates.** Anything older than ~12 months on a fast-moving tool deserves a second source.\n- **When two sources disagree**, the one with a reproducible example usually wins.\n\nWant me to go deeper on any specific point?`,
    };
  }

  if (/(hook|component|function|code|react|typescript|python|javascript|sql|regex|css|api|debug|script)/.test(p)) {
    return {
      reasoning,
      text: [
        "Here's a compact implementation you can drop straight in:",
        "",
        "```tsx",
        'import { useEffect, useState } from "react";',
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
        "Tell me which part you'd like adapted and I'll rework it for your exact case.",
      ].join("\n"),
    };
  }

  if (/(plan|steps|how (do|to)|explain|difference|compare|why)/.test(p)) {
    return {
      reasoning,
      text: [
        "Good question — here's the shape of it:",
        "",
        "1. **Start from the outcome.** Write one sentence describing what \"done\" looks like before touching any details.",
        "2. **List the constraints.** Time, tools, people — most plans fail on a constraint nobody wrote down.",
        "3. **Cut the first version in half.** Whatever step 1 is, there's a smaller step 0 that de-risks it.",
        "4. **Set a checkpoint, not a deadline.** A date you *review progress* beats a date you *owe the result*.",
        "",
        "The pattern behind all four: make the next action obvious, so starting costs nothing.",
        "",
        "Give me the specifics and I'll turn this from a template into a concrete plan.",
      ].join("\n"),
    };
  }

  if (/(write|draft|email|message|letter|caption|story|poem)/.test(p)) {
    return {
      reasoning,
      text: [
        "Here's a first pass you can edit from:",
        "",
        "> Hi — wanted to circle back on this while it's still warm. I've got a clear picture of what's needed and a couple of options for how to get there. If you've got fifteen minutes this week, I'll bring a short summary and we can decide the next step together. If not, I'll send it by email and you can react async — either works for me.",
        "",
        "A few things I assumed, so flag me if any are wrong:",
        "",
        "- Tone is **warm but brief** — no filler, no over-apologizing.",
        "- The ask is a *decision*, not a meeting for its own sake.",
        "- There's an async fallback, so it never blocks on calendars.",
        "",
        "Say the word and I'll tune it — more formal, more casual, shorter, punchier.",
      ].join("\n"),
    };
  }

  return {
    text: [
      "Here's how I'd think about it:",
      "",
      "The core idea is simpler than it looks. Strip away the surrounding noise and you're left with **one decision** and a few mechanics that follow from it. Get the decision right and the mechanics mostly sort themselves out — get it wrong and no amount of polish helps.",
      "",
      "Two things worth checking before you commit:",
      "",
      "- *What would change your mind?* If nothing would, you're not deciding — you're confirming.",
      "- *What's the smallest test?* Most questions like this have a cheap experiment that beats a long debate.",
      "",
      "Give me a bit more context — what you're optimizing for, what's already been tried — and I'll get specific instead of general.",
    ].join("\n"),
  };
}
