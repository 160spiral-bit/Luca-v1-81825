import { useEffect, useState } from "react";
import { Moon, RotateCcw, Server, Sun, X } from "lucide-react";
import type { LucaSettings } from "../lib/luca";
import { ONBOARDING_KEY, saveSettings } from "../lib/luca";

interface Props {
  settings: LucaSettings;
  onClose: () => void;
  onSave: (s: LucaSettings) => void;
  onReplayOnboarding: () => void;
}

function Toggle(props: { on: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <button
      onClick={() => props.onChange(!props.on)}
      className="flex w-full items-center justify-between gap-4 rounded-xl border border-line bg-canvas px-4 py-3 text-left transition-colors hover:border-edge"
      role="switch"
      aria-checked={props.on}
    >
      <span>
        <span className="block text-[13.5px] font-medium text-ink">{props.label}</span>
        <span className="block text-[11.5px] text-mute">{props.hint}</span>
      </span>
      <span
        className={`relative h-[22px] w-[40px] shrink-0 rounded-full transition-colors duration-200 ${
          props.on ? "bg-accent" : "bg-well"
        }`}
      >
        <span
          className={`absolute top-[3px] h-4 w-4 rounded-full bg-white transition-all duration-200 ${
            props.on ? "left-[21px]" : "left-[3px]"
          }`}
        />
      </span>
    </button>
  );
}

function Slider(props: {
  label: string;
  left: string;
  right: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="rounded-xl border border-line bg-canvas px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="text-[13.5px] font-medium text-ink">{props.label}</span>
        <span className="rounded-md border border-line px-1.5 py-px font-mono text-[10.5px] text-accent">
          {props.value}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className="mt-2.5 w-full accent-[#4a9eff]"
      />
      <div className="mt-1 flex justify-between text-[10.5px] text-mute">
        <span>{props.left}</span>
        <span>{props.right}</span>
      </div>
    </div>
  );
}

export default function SettingsModal({ settings, onClose, onSave, onReplayOnboarding }: Props) {
  const [s, setS] = useState<LucaSettings>(JSON.parse(JSON.stringify(settings)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const setP = (k: "creativity" | "formality" | "verbosity", v: number) =>
    setS((prev) => ({ ...prev, personality: { ...(prev.personality || { creativity: 50, formality: 50, verbosity: 50 }), [k]: v } }));

  const p = s.personality || { creativity: 50, formality: 50, verbosity: 50 };

  return (
    <div className="anim-fade fixed inset-0 z-50 grid place-items-center bg-black/65 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="anim-pop flex max-h-[88vh] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl border border-line bg-[#141414] shadow-[0_40px_110px_rgba(0,0,0,0.7)]">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-display text-[17px] font-semibold tracking-tight text-ink">Settings</h2>
          <button onClick={onClose} className="rounded-md p-1.5 text-mute hover:bg-panel hover:text-ink" aria-label="Close settings">
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="grid gap-4">
            {/* appearance */}
            <section>
              <h3 className="pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-mute">Appearance</h3>
              <div className="flex gap-2">
                {(["dark", "light"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setS({ ...s, theme: t })}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-[13.5px] font-medium capitalize transition-all ${
                      s.theme === t
                        ? "border-accent/70 bg-accent/[0.08] text-accent"
                        : "border-line bg-canvas text-ink/80 hover:border-edge"
                    }`}
                  >
                    {t === "dark" ? <Moon size={14} /> : <Sun size={14} />} {t}
                  </button>
                ))}
              </div>
            </section>

            {/* behaviour */}
            <section className="grid gap-2">
              <h3 className="pb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-mute">Behaviour</h3>
              <Toggle
                on={!!s.enterToSend}
                onChange={(v) => setS({ ...s, enterToSend: v })}
                label="Enter to send"
                hint="Off = Enter inserts a new line; send with the button"
              />
              <Toggle
                on={!!s.showTimestamps}
                onChange={(v) => setS({ ...s, showTimestamps: v })}
                label="Show timestamps"
                hint="Print the time under each assistant reply"
              />
              <div className="flex items-center justify-between gap-4 rounded-xl border border-line bg-canvas px-4 py-3">
                <span>
                  <span className="block text-[13.5px] font-medium text-ink">Streaming speed</span>
                  <span className="block text-[11.5px] text-mute">How fast replies pour in (simulated offline)</span>
                </span>
                <div className="flex gap-1">
                  {[
                    { v: 2, l: "Slow" },
                    { v: 3, l: "Norm" },
                    { v: 5, l: "Fast" },
                    { v: 8, l: "Max" },
                  ].map((o) => (
                    <button
                      key={o.v}
                      onClick={() => setS({ ...s, streamSpeed: o.v })}
                      className={`rounded-lg px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
                        s.streamSpeed === o.v ? "bg-accent text-canvas" : "bg-well text-mute hover:text-ink"
                      }`}
                    >
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* personality */}
            <section className="grid gap-2">
              <h3 className="pb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-mute">Personality</h3>
              <Slider label="Creativity" left="Precise" right="Inventive" value={p.creativity} onChange={(v) => setP("creativity", v)} />
              <Slider label="Formality" left="Casual" right="Formal" value={p.formality} onChange={(v) => setP("formality", v)} />
              <Slider label="Verbosity" left="Concise" right="Thorough" value={p.verbosity} onChange={(v) => setP("verbosity", v)} />
            </section>

            {/* custom instructions */}
            <section>
              <h3 className="pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-mute">Custom instructions</h3>
              <textarea
                value={s.customPrompt || ""}
                onChange={(e) => setS({ ...s, customPrompt: e.target.value })}
                rows={3}
                placeholder="e.g. Always answer in bullet points. Prefer TypeScript examples."
                className="w-full resize-none rounded-xl border border-line bg-canvas px-4 py-3 text-[13.5px] leading-relaxed text-ink outline-none transition-colors placeholder:text-mute/60 focus:border-accent/60"
              />
            </section>

            {/* backend */}
            <section>
              <h3 className="pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-mute">Backend</h3>
              <div className="flex items-center gap-2 rounded-xl border border-line bg-canvas px-4 py-3">
                <Server size={15} className="shrink-0 text-mute" />
                <input
                  value={s.backendUrl || ""}
                  onChange={(e) => setS({ ...s, backendUrl: e.target.value })}
                  placeholder="http://localhost:3000"
                  className="w-full bg-transparent font-mono text-[12.5px] text-ink outline-none placeholder:text-mute/50"
                />
              </div>
              <p className="pt-1.5 text-[11px] leading-relaxed text-mute">
                Read by <code className="font-mono text-[10.5px] text-accent">getBackendUrl()</code> in luca-shared.js. Leave
                empty for the default. Offline, Luca answers with a built-in engine.
              </p>
            </section>

            {/* danger-ish */}
            <section>
              <button
                onClick={() => {
                  try {
                    localStorage.removeItem(ONBOARDING_KEY);
                  } catch {
                    /* ignore */
                  }
                  onReplayOnboarding();
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-edge bg-line px-4 py-2.5 text-[13px] font-medium text-ink transition-colors hover:bg-[#333]"
              >
                <RotateCcw size={14} className="text-mute" /> Replay onboarding
              </button>
            </section>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3.5">
          <button onClick={onClose} className="rounded-full px-4 py-2 text-[13px] font-medium text-mute hover:bg-panel hover:text-ink">
            Cancel
          </button>
          <button
            onClick={() => {
              saveSettings(s);
              onSave(s);
              onClose();
            }}
            className="rounded-full bg-accent-strong px-5 py-2 text-[13px] font-semibold text-canvas transition-all hover:bg-accent active:scale-[0.97]"
          >
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}
