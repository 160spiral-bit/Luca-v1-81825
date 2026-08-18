import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  Code,
  Feather,
  GraduationCap,
  Microscope,
  PenTool,
  Rocket,
  Upload,
  X,
} from "lucide-react";
import Logo from "./Logo";
import { downscaleImage, loadOnboardDraft, saveOnboardDraft, saveProfile } from "../lib/luca";
import type { Profile } from "../lib/luca";

const PERSONAS = [
  { id: "developer", label: "Developer", icon: Code },
  { id: "student", label: "Student", icon: GraduationCap },
  { id: "designer", label: "Designer", icon: PenTool },
  { id: "writer", label: "Writer", icon: Feather },
  { id: "researcher", label: "Researcher", icon: Microscope },
  { id: "founder", label: "Founder", icon: Rocket },
] as const;

const STEP_META = [
  { n: "01", label: "You" },
  { n: "02", label: "Work" },
  { n: "03", label: "Canvas" },
];

export default function Onboarding({ onComplete }: { onComplete: (p: Profile) => void }) {
  const draft = useRef(loadOnboardDraft());
  const [step, setStep] = useState(() => Math.min(3, Math.max(1, draft.current?.step || 1)));
  const [dir, setDir] = useState<"fwd" | "back">("fwd");
  const [name, setName] = useState(draft.current?.name || "");
  const [persona, setPersona] = useState<string | null>(draft.current?.persona || null);
  const [theme, setTheme] = useState<"dark" | "light">(draft.current?.theme || "dark");
  const [avatar, setAvatar] = useState<string | null>(draft.current?.avatar || null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  /* live theme preview + draft persistence */
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    saveOnboardDraft({ name, persona, theme, avatar, step, complete: false });
  }, [name, persona, theme, avatar, step]);

  const go = (next: number) => {
    setDir(next > step ? "fwd" : "back");
    setStep(next);
  };

  const finish = () => {
    const profile: Profile = {
      name: name.trim() || "User",
      persona,
      theme,
      avatar,
      complete: true,
      completedAt: Date.now(),
    };
    saveProfile(profile);
    onComplete(profile);
  };

  const next = () => {
    if (step === 1 && !name.trim()) return;
    if (step < 3) go(step + 1);
    else finish();
  };

  const onFile = async (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const scaled = await downscaleImage(String(reader.result), 256);
      setAvatar(scaled);
    };
    reader.readAsDataURL(file);
  };

  const personaLabel = PERSONAS.find((p) => p.id === persona)?.label || null;

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-canvas">
      {/* layered ember ambience */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(900px 480px at 18% -12%, color-mix(in srgb, var(--color-accent) 8%, transparent), transparent 70%)," +
            "radial-gradient(760px 520px at 92% 112%, color-mix(in srgb, var(--color-avatar) 7%, transparent), transparent 70%)," +
            "radial-gradient(1200px 700px at 50% 120%, rgba(0,0,0,0.5), transparent 75%)",
        }}
        aria-hidden="true"
      />

      <div className="relative mx-auto flex h-full w-full max-w-[640px] flex-col px-6 sm:px-8">
        {/* header */}
        <header className="anim-fade-in flex items-center justify-between pt-6 sm:pt-8">
          <div className="flex items-center gap-2.5">
            <span className="grid h-[30px] w-[30px] place-items-center rounded-[10px] border border-linestrong bg-gradient-to-b from-surface2 to-surface1 text-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <Logo size={17} />
            </span>
            <span className="font-display text-lg font-semibold tracking-tight">Luca</span>
          </div>
          <span className="font-mono text-[11.5px] tracking-[0.14em] text-mute">
            {STEP_META[step - 1].n} <span className="text-linestrong">/</span> 03
          </span>
        </header>

        {/* stepper */}
        <div className="anim-fade-up mt-7" style={{ ["--d" as string]: "60ms" }}>
          <div className="flex items-center gap-2">
            {STEP_META.map((s, i) => {
              const state = i + 1 < step ? "done" : i + 1 === step ? "active" : "todo";
              return (
                <button
                  key={s.n}
                  onClick={() => i + 1 < step && go(i + 1)}
                  disabled={i + 1 >= step}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-[5px] text-[12px] font-semibold transition-all duration-300 ${
                    state === "active"
                      ? "border-accent/60 bg-accent/10 text-accent"
                      : state === "done"
                        ? "border-line text-mute hover:border-linestrong hover:text-ink"
                        : "border-line/60 text-mute/60"
                  }`}
                >
                  {state === "done" ? <Check size={12} className="text-accent" /> : <span className="font-mono text-[10px]">{s.n}</span>}
                  {s.label}
                </button>
              );
            })}
            <div className="relative ml-1 h-[3px] flex-1 overflow-hidden rounded-full bg-surface3">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(step / 3) * 100}%`,
                  background: "linear-gradient(90deg, var(--color-accent), var(--color-accent2))",
                  transitionTimingFunction: "var(--ease-spring)",
                }}
              />
            </div>
          </div>
        </div>

        {/* step body */}
        <main className="grid min-h-0 flex-1 content-center overflow-y-auto py-7">
          <div key={step} className={dir === "fwd" ? "anim-step-fwd" : "anim-step-back"}>
            {step === 1 && (
              <>
                <h1 className="font-display text-[clamp(30px,6vw,42px)] font-semibold leading-[1.08] tracking-tight">
                  Hey — I'm Luca.
                  <br />
                  <span className="text-mute">Let's get acquainted.</span>
                </h1>
                <p className="mt-3.5 max-w-[46ch] text-[15px] leading-relaxed text-mute">
                  First things first: what should I call you? This is how I'll greet you from now on.
                </p>

                <div className="mt-9 flex items-center gap-5">
                  <button
                    onClick={() => (avatar ? setAvatar(null) : fileRef.current?.click())}
                    className="group relative grid h-[72px] w-[72px] shrink-0 place-items-center overflow-hidden rounded-full transition-transform duration-300 hover:scale-[1.04] active:scale-95"
                    style={{
                      background: avatar ? undefined : "color-mix(in srgb, var(--color-avatar) 14%, transparent)",
                      border: avatar ? "2px solid var(--color-linestrong)" : "1.5px dashed color-mix(in srgb, var(--color-avatar) 60%, transparent)",
                    }}
                    aria-label={avatar ? "Remove photo" : "Add a profile photo"}
                  >
                    {avatar ? (
                      <img src={avatar} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Camera size={24} className="text-avatar transition-transform duration-300 group-hover:scale-110" />
                    )}
                    {avatar && (
                      <span className="absolute inset-0 grid place-items-center bg-black/55 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                        <X size={20} className="text-white" />
                      </span>
                    )}
                  </button>
                  <input type="file" ref={fileRef} accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />

                  <div className="min-w-0 flex-1">
                    <label htmlFor="ob-name" className="mb-1.5 block text-[11.5px] font-semibold uppercase tracking-[0.08em] text-mute">
                      Your name
                    </label>
                    <input
                      id="ob-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && next()}
                      placeholder="e.g. Harper"
                      maxLength={40}
                      autoFocus
                      autoComplete="off"
                      className="w-full rounded-xl border border-linestrong bg-surface2 px-4 py-3 text-[16px] text-ink transition-colors duration-200 placeholder:text-mute/60 hover:border-[#484848] focus:border-linestrong focus:bg-surface3 md:text-[15px]"
                    />
                  </div>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <h1 className="font-display text-[clamp(30px,6vw,42px)] font-semibold leading-[1.08] tracking-tight">
                  What kind of work
                  <br />
                  <span className="text-mute">do you do?</span>
                </h1>
                <p className="mt-3.5 max-w-[48ch] text-[15px] leading-relaxed text-mute">
                  I'll tune my tone and defaults to match — code-heavy, study-friendly, or something else. Nothing locks you in.
                </p>

                <div className="mt-9 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {PERSONAS.map((p, i) => {
                    const Icon = p.icon;
                    const selected = persona === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => setPersona(p.id)}
                        className={`anim-fade-up group relative flex flex-col items-center gap-2.5 rounded-2xl border px-3 py-5 transition-all duration-200 ${
                          selected
                            ? "border-accent/70 bg-accent/[0.09] shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-accent)_14%,transparent)]"
                            : "border-line bg-surface1/60 hover:-translate-y-1 hover:border-linestrong hover:bg-surface2"
                        }`}
                        style={{ ["--d" as string]: `${90 + i * 45}ms` }}
                        aria-pressed={selected}
                      >
                        <Icon
                          size={20}
                          className={`transition-colors duration-200 ${selected ? "text-accent" : "text-mute group-hover:text-ink"}`}
                        />
                        <span className={`text-[13.5px] font-semibold ${selected ? "text-ink" : "text-mute group-hover:text-ink"}`}>
                          {p.label}
                        </span>
                        {selected && (
                          <span className="anim-scale-in absolute right-2 top-2 grid h-[18px] w-[18px] place-items-center rounded-full bg-accent text-accent-ink">
                            <Check size={11} strokeWidth={3.2} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <h1 className="font-display text-[clamp(30px,6vw,42px)] font-semibold leading-[1.08] tracking-tight">
                  Pick your canvas.
                </h1>
                <p className="mt-3.5 max-w-[48ch] text-[15px] leading-relaxed text-mute">
                  The theme applies everywhere, instantly — and you can flip it later in settings.
                </p>

                <div className="mt-9 grid grid-cols-2 gap-3">
                  {(["dark", "light"] as const).map((t, i) => {
                    const selected = theme === t;
                    return (
                      <button
                        key={t}
                        onClick={() => setTheme(t)}
                        className={`anim-fade-up rounded-2xl border p-2.5 text-left transition-all duration-200 ${
                          selected
                            ? "border-accent/70 shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-accent)_14%,transparent)]"
                            : "border-line hover:-translate-y-1 hover:border-linestrong"
                        }`}
                        style={{ ["--d" as string]: `${90 + i * 70}ms` }}
                        aria-pressed={selected}
                      >
                        {/* miniature app preview */}
                        <span
                          className="block overflow-hidden rounded-xl border"
                          style={{
                            background: t === "dark" ? "#131313" : "#f1efe9",
                            borderColor: t === "dark" ? "#2a2a2a" : "#ddd8d0",
                          }}
                        >
                          <span className="flex gap-2 p-3">
                            <span className="hidden w-9 shrink-0 flex-col gap-1.5 sm:flex">
                              <span className="h-1.5 w-full rounded-full" style={{ background: t === "dark" ? "#2f2f2f" : "#ddd8d0" }} />
                              <span className="h-1.5 w-3/4 rounded-full" style={{ background: t === "dark" ? "#262626" : "#e4e0d8" }} />
                              <span className="h-1.5 w-full rounded-full" style={{ background: t === "dark" ? "#262626" : "#e4e0d8" }} />
                            </span>
                            <span className="flex flex-1 flex-col gap-1.5">
                              <span className="h-1.5 w-2/3 rounded-full" style={{ background: t === "dark" ? "#3a3a3a" : "#d4cfc6" }} />
                              <span className="h-1.5 w-full rounded-full" style={{ background: t === "dark" ? "#2a2a2a" : "#e0dcd4" }} />
                              <span className="h-1.5 w-1/2 rounded-full" style={{ background: t === "dark" ? "#6ba2ff" : "#2f6fdd" }} />
                              <span className="h-1.5 w-5/6 rounded-full" style={{ background: t === "dark" ? "#2a2a2a" : "#e0dcd4" }} />
                            </span>
                          </span>
                        </span>
                        <span className="mt-2.5 flex items-center justify-between px-1 pb-0.5">
                          <span className={`text-[13.5px] font-semibold ${selected ? "text-ink" : "text-mute"}`}>
                            {t === "dark" ? "Dark" : "Light"}
                          </span>
                          <span
                            className={`grid h-[17px] w-[17px] place-items-center rounded-full border transition-all duration-200 ${
                              selected ? "border-accent bg-accent text-accent-ink" : "border-linestrong"
                            }`}
                          >
                            {selected && <Check size={10} strokeWidth={3.5} />}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* ready summary */}
                <div className="anim-fade-up mt-7 flex items-center gap-3 rounded-2xl border border-line bg-surface1/70 px-4 py-3.5" style={{ ["--d" as string]: "220ms" }}>
                  <span
                    className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-avatar text-[12px] font-bold text-white"
                    style={avatar ? { backgroundImage: `url(${avatar})`, backgroundSize: "cover" } : undefined}
                  >
                    {!avatar && (name.trim() ? name.trim().charAt(0).toUpperCase() : "?")}
                  </span>
                  <span className="min-w-0 text-[13.5px] text-mute">
                    Ready as <span className="font-semibold text-ink">{name.trim() || "you"}</span>
                    {personaLabel && (
                      <>
                        {" · "}
                        <span className="font-semibold text-ink">{personaLabel}</span>
                      </>
                    )}
                    {" · "}
                    <span className="font-semibold text-accent">{theme === "dark" ? "Dark" : "Light"} theme</span>
                  </span>
                </div>
              </>
            )}
          </div>
        </main>

        {/* footer nav */}
        <footer className="flex items-center gap-2 pb-[max(20px,env(safe-area-inset-bottom))] pt-2">
          {step > 1 ? (
            <button
              onClick={() => go(step - 1)}
              className="flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-[13.5px] font-medium text-mute transition-all duration-200 hover:bg-surface2 hover:text-ink active:scale-95"
            >
              <ArrowLeft size={15} />
              Back
            </button>
          ) : (
            <span />
          )}

          {step < 3 && (
            <button
              onClick={finish}
              className="ml-auto rounded-xl px-3 py-2.5 text-[13px] text-mute transition-colors duration-200 hover:text-ink hover:underline hover:underline-offset-4"
            >
              Skip for now
            </button>
          )}

          <button
            onClick={next}
            disabled={step === 1 && !name.trim()}
            className={`group flex items-center gap-2 rounded-xl px-5 py-2.5 text-[14px] font-semibold transition-all duration-200 active:scale-95 ${
              step === 1 && !name.trim()
                ? "cursor-not-allowed bg-surface3 text-mute/60"
                : "bg-ink text-canvas shadow-[0_6px_22px_rgba(0,0,0,0.4)] hover:bg-ink/85"
            } ${step === 3 && step > 1 ? "" : step <= 1 ? "ml-auto" : ""}`}
          >
            {step === 3 ? "Enter Luca" : "Continue"}
            <ArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-0.5" />
          </button>
        </footer>
      </div>
    </div>
  );
}
