import { useEffect } from "react";
import { Moon, Sun, X } from "lucide-react";
import type { Settings } from "../lib/luca";

interface Props {
  open: boolean;
  settings: Settings;
  backendLive: boolean;
  onChange: (patch: Partial<Settings>) => void;
  onClose: () => void;
}

function Toggle({ checked, onToggle, label, hint }: { checked: boolean; onToggle: () => void; label: string; hint: string }) {
  return (
    <button onClick={onToggle} role="switch" aria-checked={checked} className="flex w-full items-center gap-3 py-2.5 text-left">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-mute">{hint}</span>
      </span>
      <span
        className={`relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors duration-150 ${checked ? "bg-accent" : "bg-surface3"}`}
      >
        <span
          className={`absolute top-[3px] h-4 w-4 rounded-full bg-white shadow transition-all duration-150 ${checked ? "left-[17px]" : "left-[3px]"}`}
        />
      </span>
    </button>
  );
}

function Slider({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="py-1.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[13px] font-medium">{label}</span>
        <span className="font-mono text-[11.5px] text-mute">{value}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface3 accent-[var(--color-accent)]"
        aria-label={label}
      />
    </div>
  );
}

export default function SettingsModal({ open, settings, backendLive, onChange, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-[3px]" onMouseDown={onClose}>
      <div
        className="anim-pop max-h-[86vh] w-full max-w-[520px] overflow-y-auto rounded-2xl border border-linestrong bg-surface1 shadow-[0_24px_60px_rgba(0,0,0,0.6)]"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Settings"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-display text-[17px] font-semibold">Settings</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-mute hover:bg-surface3 hover:text-ink" aria-label="Close settings">
            <X size={17} />
          </button>
        </div>

        <div className="px-5 py-4">
          <div className="mb-5">
            <label htmlFor="backend-url" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.05em] text-mute">
              Backend URL
            </label>
            <div className="flex gap-2">
              <input
                id="backend-url"
                value={settings.backendUrl}
                onChange={(e) => onChange({ backendUrl: e.target.value })}
                placeholder="http://localhost:3000"
                className="min-w-0 flex-1 rounded-lg border border-linestrong bg-surface2 px-3 py-2 font-mono text-[13px] text-ink outline-none placeholder:text-mute/70 focus:border-accent"
              />
              <span
                className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[11.5px] font-semibold ${
                  backendLive ? "border-ok/40 text-ok" : "border-line text-mute"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${backendLive ? "bg-ok" : "bg-mute"}`} />
                {backendLive ? "Reachable" : "Offline"}
              </span>
            </div>
            <p className="mt-1.5 text-xs text-mute">
              Stored in <code className="rounded bg-surface3 px-1 py-px font-mono text-[11px]">luca-settings</code> — same key the
              original <code className="rounded bg-surface3 px-1 py-px font-mono text-[11px]">getBackendUrl()</code> reads.
            </p>
          </div>

          <div className="mb-4">
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-[0.05em] text-mute">Theme</div>
            <div className="flex gap-2">
              {(["dark", "light"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => onChange({ theme: t })}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors ${
                    settings.theme === t ? "border-accent bg-accent/10 text-ink" : "border-line bg-surface2 text-mute hover:text-ink"
                  }`}
                >
                  {t === "dark" ? <Moon size={14} className={settings.theme === t ? "text-accent" : ""} /> : <Sun size={14} className={settings.theme === t ? "text-accent" : ""} />}
                  {t === "dark" ? "Dark" : "Light"}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-line/70">
            <Toggle
              checked={settings.enterToSend}
              onToggle={() => onChange({ enterToSend: !settings.enterToSend })}
              label="Enter to send"
              hint="Off = Enter makes a new line, Ctrl/⌘+Enter sends"
            />
            <Toggle
              checked={settings.showTimestamps}
              onToggle={() => onChange({ showTimestamps: !settings.showTimestamps })}
              label="Show timestamps"
              hint="Display the time under each message"
            />
          </div>

          <div className="mb-4 mt-4">
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-[0.05em] text-mute">Simulated stream speed</div>
            <div className="flex gap-2">
              {[2, 3, 5, 8].map((v) => (
                <button
                  key={v}
                  onClick={() => onChange({ streamSpeed: v })}
                  className={`flex-1 rounded-lg border px-2 py-1.5 font-mono text-[12.5px] transition-colors ${
                    settings.streamSpeed === v ? "border-accent bg-accent/10 text-accent" : "border-line bg-surface2 text-mute hover:text-ink"
                  }`}
                >
                  {v === 2 ? "Calm" : v === 3 ? "Normal" : v === 5 ? "Quick" : "Fast"}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-mute">Used by the local engine when the backend is offline.</p>
          </div>

          <div className="mb-4 rounded-xl border border-line bg-surface2/60 px-4 py-2.5">
            <div className="mb-1 text-xs font-semibold uppercase tracking-[0.05em] text-mute">Personality</div>
            <Slider
              value={settings.personality.creativity}
              onChange={(v) => onChange({ personality: { ...settings.personality, creativity: v } })}
              label="Creativity"
            />
            <Slider
              value={settings.personality.formality}
              onChange={(v) => onChange({ personality: { ...settings.personality, formality: v } })}
              label="Formality"
            />
            <Slider
              value={settings.personality.verbosity}
              onChange={(v) => onChange({ personality: { ...settings.personality, verbosity: v } })}
              label="Verbosity"
            />
          </div>

          <div>
            <label htmlFor="custom-prompt" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.05em] text-mute">
              Custom instructions
            </label>
            <textarea
              id="custom-prompt"
              value={settings.customPrompt}
              onChange={(e) => onChange({ customPrompt: e.target.value })}
              rows={3}
              placeholder="Always answer concisely. Prefer TypeScript examples…"
              className="w-full resize-none rounded-lg border border-linestrong bg-surface2 px-3 py-2 text-[13.5px] text-ink outline-none placeholder:text-mute/70 focus:border-accent"
            />
            <p className="mt-1.5 text-xs text-mute">Sent to the backend as <code className="rounded bg-surface3 px-1 py-px font-mono text-[11px]">userSettings.customPrompt</code>.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
