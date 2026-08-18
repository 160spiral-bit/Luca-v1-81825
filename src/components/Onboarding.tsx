import { useEffect, useRef, useState } from "react";
import { ArrowRight, Camera, ChevronLeft, ChevronRight, Moon, Sun, X } from "lucide-react";
import type { LucaUser } from "../lib/luca";
import { ONBOARDING_KEY } from "../lib/luca";

const STEP_LABELS: Record<number, string> = { 1: "Welcome", 2: "Persona", 3: "Look & Feel" };
const PERSONAS = [
  { id: "developer", label: "Developer", glyph: "</>" },
  { id: "student", label: "Student", glyph: "∑" },
  { id: "designer", label: "Designer", glyph: "◐" },
  { id: "writer", label: "Writer", glyph: "¶" },
  { id: "researcher", label: "Researcher", glyph: "⌕" },
  { id: "founder", label: "Founder", glyph: "▲" },
];

interface Draft {
  complete: false;
  step: number;
  name: string;
  persona: string | null;
  theme: string;
}

function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(ONBOARDING_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && p.complete === false) return p as Draft;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export default function Onboarding({ onDone }: { onDone: (u: LucaUser) => void }) {
  const draft = useRef(loadDraft());
  const [step, setStep] = useState(Math.min(Math.max(draft.current?.step || 1, 1), 3));
  const [dir, setDir] = useState<"forward" | "back">("forward");
  const [name, setName] = useState(draft.current?.name || "");
  const [persona, setPersona] = useState<string | null>(draft.current?.persona || null);
  const [theme, setTheme] = useState(draft.current?.theme || "dark");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 1) setTimeout(() => nameRef.current?.focus(), 350);
  }, [step]);

  /* persist in-progress draft under the same key, tagged complete:false */
  useEffect(() => {
    try {
      localStorage.setItem(
        ONBOARDING_KEY,
        JSON.stringify({ complete: false, step, name, persona, theme } satisfies Draft),
      );
    } catch {
      /* ignore */
    }
  }, [step, name, persona, theme]);

  const goTo = (next: number) => {
    if (next < 1 || next > 3) return;
    setDir(next > step ? "forward" : "back");
    setStep(next);
  };

  const finish = () => {
    setLeaving(true);
    const payload: LucaUser = {
      name: name.trim() || "User",
      persona,
      theme,
      avatar,
      completedAt: Date.now(),
    };
    setTimeout(() => onDone(payload), 380);
  };

  const pickAvatar = (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 4 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 160 / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
        try {
          setAvatar(canvas.toDataURL("image/jpeg", 0.88));
        } catch {
          setAvatar(String(reader.result));
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const personaLabel = PERSONAS.find((p) => p.id === persona)?.label;

  return (
    <div
      className={`ambient fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4 transition-opacity duration-400 ${
        leaving ? "opacity-0" : "opacity-100"
      }`}
    >
      <div
        className={`anim-pop my-auto grid w-full max-w-[880px] overflow-hidden rounded-2xl border border-line bg-[#121212] shadow-[0_40px_120px_rgba(0,0,0,0.7)] transition-transform duration-400 md:grid-cols-[300px_1fr] ${
          leaving ? "scale-[0.97]" : ""
        }`}
      >
        {/* left rail: brand + live preview */}
        <div className="relative hidden flex-col justify-between border-r border-line bg-canvas p-6 md:flex">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent/15">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a9eff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
                </svg>
              </span>
              <span className="font-display text-[17px] font-semibold tracking-tight text-ink">Luca</span>
            </div>
            <p className="mt-6 text-[12.5px] leading-relaxed text-mute">
              Two tiers of one assistant — <span className="text-accent">Flash</span> answers in a blink,{" "}
              <span className="text-accent">Pro</span> thinks before it speaks. Both remember who you are.
            </p>
          </div>

          {/* live profile preview card */}
          <div className="rounded-xl border border-line bg-panel/70 p-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => fileRef.current?.click()}
                className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full text-[17px] font-bold text-white transition-transform hover:scale-105"
                style={{ background: "#d97a3e" }}
                title="Upload a profile photo"
              >
                {avatar ? (
                  <img src={avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  (name.trim() || "?").charAt(0).toUpperCase()
                )}
                <span className="absolute inset-0 grid place-items-center bg-black/50 opacity-0 transition-opacity hover:opacity-100">
                  <Camera size={15} />
                </span>
              </button>
              <div className="min-w-0">
                <div className="truncate text-[14px] font-semibold text-ink">{name.trim() || "Your Name"}</div>
                <div className="truncate text-[12px] text-mute">{personaLabel || "No role selected"}</div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-mute">
              <span className="flex items-center gap-1 rounded-full border border-line bg-canvas px-2 py-0.5">
                {theme === "dark" ? <Moon size={11} /> : <Sun size={11} />}
                {theme === "dark" ? "Dark" : "Light"}
              </span>
              <span className="rounded-full border border-line bg-canvas px-2 py-0.5 font-mono uppercase tracking-[0.12em] text-[9.5px]">
                Step {step} / 3
              </span>
            </div>
          </div>
        </div>

        {/* right: wizard */}
        <div className="flex min-h-[520px] flex-col p-6 sm:p-8">
          {/* progress */}
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-mute">
              Step {step} of 3 · <span className="text-accent">{STEP_LABELS[step]}</span>
            </div>
            <button
              onClick={() => goTo(3)}
              className={`text-[12px] text-mute transition-colors hover:text-ink ${step === 3 ? "invisible" : ""}`}
            >
              Skip setup
            </button>
          </div>
          <div className="mt-2.5 h-[3px] overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500 ease-out"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => pickAvatar(e.target.files?.[0])}
          />

          {/* steps */}
          <div className="relative mt-7 min-h-0 flex-1 overflow-hidden">
            {/* STEP 1 — Welcome */}
            <section
              key="s1"
              className={`absolute inset-0 flex flex-col transition-all duration-300 ease-out ${
                step === 1
                  ? "translate-x-0 opacity-100"
                  : dir === "forward"
                    ? "-translate-x-8 opacity-0 pointer-events-none"
                    : "translate-x-8 opacity-0 pointer-events-none"
              }`}
            >
              <h2 className="font-display text-[26px] font-semibold leading-tight tracking-tight text-ink">
                What should Luca call you?
              </h2>
              <p className="mt-2 text-[13.5px] leading-relaxed text-mute">
                Your name lands in the greeting and the profile card. You can add a photo now or later.
              </p>
              <input
                ref={nameRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && goTo(2)}
                placeholder="e.g. Alex"
                maxLength={40}
                className="mt-6 w-full max-w-[340px] rounded-xl border border-line bg-canvas px-4 py-3 text-[15px] text-ink outline-none transition-colors placeholder:text-mute/60 focus:border-accent/60"
              />
              <div className="mt-5 flex items-center gap-3">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-2 rounded-full border border-edge bg-line px-4 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-[#333]"
                >
                  <Camera size={14} className="text-mute" /> Upload photo
                </button>
                {avatar && (
                  <button
                    onClick={() => setAvatar(null)}
                    className="flex items-center gap-1.5 rounded-full px-3 py-2 text-[12.5px] text-mute hover:text-ink"
                  >
                    <X size={12} /> Remove
                  </button>
                )}
              </div>
            </section>

            {/* STEP 2 — Persona */}
            <section
              key="s2"
              className={`absolute inset-0 flex flex-col transition-all duration-300 ease-out ${
                step === 2
                  ? "translate-x-0 opacity-100"
                  : dir === "forward"
                    ? "-translate-x-8 opacity-0 pointer-events-none"
                    : "translate-x-8 opacity-0 pointer-events-none"
              }`}
            >
              <h2 className="font-display text-[26px] font-semibold leading-tight tracking-tight text-ink">
                What best describes you?
              </h2>
              <p className="mt-2 text-[13.5px] leading-relaxed text-mute">
                Luca tunes tone and examples to match — code-first for developers, citations for researchers.
              </p>
              <div className="mt-6 grid max-w-[460px] grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Persona">
                {PERSONAS.map((p) => {
                  const sel = persona === p.id;
                  return (
                    <button
                      key={p.id}
                      role="radio"
                      aria-checked={sel}
                      onClick={() => setPersona(p.id)}
                      className={`flex flex-col items-start gap-2 rounded-xl border px-3.5 py-3 text-left transition-all duration-150 active:scale-[0.97] ${
                        sel
                          ? "border-accent/70 bg-accent/[0.08] shadow-[0_0_0_1px_rgba(74,158,255,0.35)]"
                          : "border-line bg-canvas hover:border-edge hover:bg-panel"
                      }`}
                    >
                      <span
                        className={`font-mono text-[13px] ${sel ? "text-accent" : "text-mute"}`}
                      >
                        {p.glyph}
                      </span>
                      <span className="text-[13px] font-medium text-ink">{p.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* STEP 3 — Look & Feel */}
            <section
              key="s3"
              className={`absolute inset-0 flex flex-col transition-all duration-300 ease-out ${
                step === 3
                  ? "translate-x-0 opacity-100"
                  : "-translate-x-8 opacity-0 pointer-events-none"
              }`}
            >
              <h2 className="font-display text-[26px] font-semibold leading-tight tracking-tight text-ink">
                Pick your canvas.
              </h2>
              <p className="mt-2 text-[13.5px] leading-relaxed text-mute">
                Dark is Luca's native habitat. Light works too — you can flip it anytime in Settings.
              </p>
              <div className="mt-6 flex max-w-[460px] gap-3" role="radiogroup" aria-label="Theme">
                {[
                  { id: "dark", label: "Dark", icon: <Moon size={15} />, bg: "#0d0d0d", fg: "#ececec" },
                  { id: "light", label: "Light", icon: <Sun size={15} />, bg: "#f4f4f4", fg: "#1a1a1a" },
                ].map((t) => {
                  const sel = theme === t.id;
                  return (
                    <button
                      key={t.id}
                      role="radio"
                      aria-checked={sel}
                      onClick={() => setTheme(t.id)}
                      className={`flex-1 overflow-hidden rounded-xl border text-left transition-all duration-150 active:scale-[0.98] ${
                        sel ? "border-accent/70 shadow-[0_0_0_1px_rgba(74,158,255,0.35)]" : "border-line hover:border-edge"
                      }`}
                    >
                      <div className="h-20 p-3" style={{ background: t.bg }}>
                        <div className="h-1.5 w-16 rounded-full" style={{ background: t.fg, opacity: 0.85 }} />
                        <div className="mt-1.5 h-1.5 w-24 rounded-full" style={{ background: t.fg, opacity: 0.35 }} />
                        <div className="mt-1.5 h-1.5 w-10 rounded-full bg-accent" />
                      </div>
                      <div className="flex items-center gap-2 border-t border-line bg-canvas px-3 py-2 text-[13px] font-medium text-ink">
                        <span className={sel ? "text-accent" : "text-mute"}>{t.icon}</span>
                        {t.label}
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="mt-5 text-[12px] text-mute">
                Everything else — personality sliders, streaming speed, custom instructions — lives in Settings.
              </p>
            </section>
          </div>

          {/* nav */}
          <div className="mt-6 flex items-center gap-2">
            <button
              onClick={() => goTo(step - 1)}
              className={`flex items-center gap-1 rounded-full px-4 py-2.5 text-[13.5px] font-medium text-mute transition-all hover:bg-panel hover:text-ink ${
                step === 1 ? "invisible" : ""
              }`}
            >
              <ChevronLeft size={15} /> Back
            </button>
            <div className="flex-1" />
            <button
              onClick={() => (step === 3 ? finish() : goTo(step + 1))}
              className="flex items-center gap-2 rounded-full bg-accent-strong px-5 py-2.5 text-[13.5px] font-semibold text-canvas shadow-[0_6px_20px_rgba(90,169,255,0.3)] transition-all duration-150 hover:bg-accent active:scale-[0.97]"
            >
              {step === 3 ? "Enter Chat" : "Continue"}
              {step === 3 ? <ArrowRight size={15} /> : <ChevronRight size={15} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
