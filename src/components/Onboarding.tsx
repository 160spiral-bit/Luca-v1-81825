import { useEffect, useRef, useState } from "react";
import { ArrowRight, Camera, ChevronLeft, ChevronRight, Code, Feather, GraduationCap, Microscope, Moon, PenTool, Rocket, Sun, Upload, X } from "lucide-react";
import Logo from "./Logo";
import { downscaleImage, saveOnboardDraft, saveProfile } from "../lib/luca";
import type { Profile } from "../lib/luca";

const PERSONAS = [
  { id: "developer", label: "Developer", icon: Code },
  { id: "student", label: "Student", icon: GraduationCap },
  { id: "designer", label: "Designer", icon: PenTool },
  { id: "writer", label: "Writer", icon: Feather },
  { id: "researcher", label: "Researcher", icon: Microscope },
  { id: "founder", label: "Founder", icon: Rocket },
];

const STEP_LABELS: Record<number, string> = { 1: "Welcome", 2: "Persona", 3: "Look & feel" };

interface Props {
  draft: Profile | null;
  onComplete: (p: Profile) => void;
}

export default function Onboarding({ draft, onComplete }: Props) {
  const [step, setStep] = useState(draft?.step && draft.step >= 1 && draft.step <= 3 ? draft.step : 1);
  const [name, setName] = useState(draft?.name || "");
  const [persona, setPersona] = useState<string | null>(draft?.persona || null);
  const [theme, setTheme] = useState<"dark" | "light">(draft?.theme === "light" ? "light" : "dark");
  const [avatar, setAvatar] = useState<string | null>(draft?.avatar || null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  /* apply theme live, same as the original wizard */
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  /* auto-save the in-progress draft (complete:false) on every change */
  useEffect(() => {
    saveOnboardDraft({ name, persona, theme, avatar, step, complete: false });
  }, [name, persona, theme, avatar, step]);

  const go = (next: number) => {
    if (next < 1 || next > 3) return;
    setStep(next);
  };

  const finish = () => {
    const payload: Profile = {
      name: name.trim() || "User",
      persona,
      theme,
      avatar,
      completedAt: Date.now(),
      complete: true,
    };
    saveProfile(payload);
    onComplete(payload);
  };

  const pickAvatar = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 4 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => {
      downscaleImage(String(reader.result), 160).then(setAvatar);
    };
    reader.readAsDataURL(file);
  };

  const personaLabel = PERSONAS.find((p) => p.id === persona)?.label || null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto px-4 py-8"
      style={{
        background:
          "radial-gradient(1000px 520px at 50% -160px, rgba(74,158,255,0.07), transparent 70%), radial-gradient(760px 520px at 88% 112%, rgba(217,122,62,0.05), transparent 70%), var(--color-canvas)",
      }}
    >
      <div className="anim-rise w-full max-w-[660px] overflow-hidden rounded-[20px] border border-line bg-[#161616] shadow-[0_30px_80px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.03)]">
        <header className="px-7 pt-5">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="grid h-[26px] w-[26px] place-items-center rounded-lg border border-linestrong bg-gradient-to-b from-surface2 to-surface1 text-accent">
                <Logo size={15} />
              </span>
              <span className="font-display text-[17px] font-semibold">Luca</span>
            </div>
            <div className="flex items-baseline gap-2.5">
              <span className="font-mono text-xs text-mute">
                <span className="font-medium text-accent">{step}</span> / 3
              </span>
              <span className="text-[12.5px] font-semibold uppercase tracking-[0.06em] text-mute">
                {STEP_LABELS[step]}
              </span>
            </div>
          </div>
          <div className="h-[3px] overflow-hidden rounded-full bg-surface3">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent to-accent2 transition-[width] duration-500 ease-out"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>
        </header>

        <div className="relative min-h-[330px] px-7 pb-3 pt-7">
          {/* Step 1 — Welcome */}
          <section
            className={`absolute inset-x-7 bottom-3 top-7 transition-all duration-300 ease-out ${
              step === 1 ? "translate-x-0 opacity-100" : step > 1 ? "pointer-events-none -translate-x-7 opacity-0" : "pointer-events-none translate-x-7 opacity-0"
            }`}
          >
            <h2 className="font-display text-2xl font-semibold leading-snug tracking-tight">
              First things first — what should we call you?
            </h2>
            <p className="mb-6 mt-2 text-sm text-mute">This is how Luca greets you. You can skip it and add a name later.</p>

            <div className="mb-6 flex items-center gap-4">
              <button
                onClick={() => fileRef.current?.click()}
                aria-label="Choose a profile photo"
                className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border-[1.5px] border-dashed border-avatar/55 bg-avatar/15 text-avatar transition-all hover:scale-105 hover:border-avatar hover:bg-avatar/20"
              >
                {avatar ? (
                  <img src={avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Camera size={20} />
                )}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickAvatar(e.target.files?.[0])} />
              <div className="flex flex-col items-start gap-1.5">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13.5px] font-medium text-mute transition-colors hover:bg-surface3 hover:text-ink"
                >
                  <Upload size={14} /> Upload photo
                </button>
                {avatar && (
                  <button
                    onClick={() => setAvatar(null)}
                    className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13.5px] font-medium text-mute transition-colors hover:bg-surface3 hover:text-danger"
                  >
                    <X size={14} /> Remove
                  </button>
                )}
              </div>
            </div>

            <label htmlFor="ob-name" className="mb-2 block text-xs font-semibold uppercase tracking-[0.05em] text-mute">
              Your name
            </label>
            <input
              id="ob-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  go(2);
                }
              }}
              placeholder="e.g. Alex"
              maxLength={40}
              autoFocus
              className="w-full rounded-xl border border-linestrong bg-surface2 px-4 py-3 text-[16px] text-ink outline-none transition-colors placeholder:text-mute/70 md:text-[15px]"
            />
          </section>

          {/* Step 2 — Persona */}
          <section
            className={`absolute inset-x-7 bottom-3 top-7 transition-all duration-300 ease-out ${
              step === 2 ? "translate-x-0 opacity-100" : step > 2 ? "pointer-events-none -translate-x-7 opacity-0" : "pointer-events-none translate-x-7 opacity-0"
            }`}
          >
            <h2 className="font-display text-2xl font-semibold leading-snug tracking-tight">What kind of work do you do?</h2>
            <p className="mb-6 mt-2 text-sm text-mute">Luca tunes its tone and defaults to match. Nothing here locks you in.</p>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3" role="radiogroup" aria-label="Persona">
              {PERSONAS.map((p) => {
                const Icon = p.icon;
                const selected = persona === p.id;
                return (
                  <button
                    key={p.id}
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setPersona(selected ? null : p.id)}
                    className={`flex flex-col items-center gap-2.5 rounded-xl border px-3 py-[17px] text-[13.5px] font-medium transition-all duration-150 ${
                      selected
                        ? "border-accent bg-accent/10 text-ink shadow-[0_0_0_3px_rgba(74,158,255,0.12)]"
                        : "border-line bg-surface2 text-mute hover:-translate-y-0.5 hover:bg-[#262626] hover:text-ink"
                    }`}
                  >
                    <Icon size={19} className={selected ? "text-accent" : ""} />
                    {p.label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Step 3 — Look & feel */}
          <section
            className={`absolute inset-x-7 bottom-3 top-7 transition-all duration-300 ease-out ${
              step === 3 ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-7 opacity-0"
            }`}
          >
            <h2 className="font-display text-2xl font-semibold leading-snug tracking-tight">Make it yours</h2>
            <p className="mb-6 mt-2 text-sm text-mute">The theme applies immediately — and here's your profile card.</p>

            <div className="mb-6 flex gap-2.5" role="radiogroup" aria-label="Theme">
              {(["dark", "light"] as const).map((t) => (
                <button
                  key={t}
                  role="radio"
                  aria-checked={theme === t}
                  onClick={() => setTheme(t)}
                  className={`flex flex-1 items-center justify-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
                    theme === t
                      ? "border-accent bg-accent/10 text-ink"
                      : "border-line bg-surface2 text-mute hover:bg-[#262626] hover:text-ink"
                  }`}
                >
                  {t === "dark" ? <Moon size={16} className={theme === t ? "text-accent" : ""} /> : <Sun size={16} className={theme === t ? "text-accent" : ""} />}
                  {t === "dark" ? "Dark" : "Light"}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3.5 rounded-[18px] border border-linestrong bg-surface2 px-4 py-3.5">
              <span
                className="grid h-[46px] w-[46px] shrink-0 place-items-center overflow-hidden rounded-full bg-avatar text-[17px] font-bold text-[#1a0e05] shadow-[0_0_0_3px_rgba(217,122,62,0.2)]"
                style={avatar ? { backgroundImage: `url(${avatar})`, backgroundSize: "cover" } : undefined}
              >
                {!avatar && (name.trim() ? name.trim().charAt(0).toUpperCase() : "?")}
              </span>
              <div className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{name.trim() || "Your Name"}</span>
                <span className="mt-px block text-[12.5px] text-mute">{personaLabel || "No role selected"}</span>
              </div>
              <span className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-surface3 px-3 py-1.5 text-xs font-semibold text-mute">
                {theme === "dark" ? <Moon size={13} className="text-accent" /> : <Sun size={13} className="text-accent" />}
                {theme === "dark" ? "Dark" : "Light"}
              </span>
            </div>
          </section>
        </div>

        <footer className="flex items-center gap-2 border-t border-line bg-canvas/40 px-7 py-4">
          {step > 1 ? (
            <button
              onClick={() => go(step - 1)}
              className="flex items-center gap-1.5 rounded-lg px-3.5 py-2.5 text-sm font-medium text-mute transition-colors hover:bg-surface3 hover:text-ink"
            >
              <ChevronLeft size={15} /> Back
            </button>
          ) : (
            <span />
          )}
          {step < 3 ? (
            <button onClick={() => go(3)} className="ml-auto rounded-lg px-3 py-2.5 text-[13.5px] text-mute transition-colors hover:text-ink hover:underline hover:underline-offset-4">
              Skip for now
            </button>
          ) : (
            <span className="ml-auto" />
          )}
          <button
            onClick={() => (step === 3 ? finish() : go(step + 1))}
            className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-[14.5px] font-semibold text-[#06131f] shadow-[0_4px_18px_rgba(74,158,255,0.25)] transition-all hover:bg-accent2 hover:shadow-[0_6px_22px_rgba(74,158,255,0.35)] active:scale-[0.97]"
          >
            {step === 3 ? "Enter chat" : "Continue"}
            {step === 3 ? <ArrowRight size={16} /> : <ChevronRight size={16} />}
          </button>
        </footer>
      </div>
    </div>
  );
}
