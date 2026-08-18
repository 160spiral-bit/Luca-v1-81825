import { useEffect, useState } from "react";
import Logo from "./Logo";

const PHASES = ["Restoring your chats…", "Warming up the models…", "Polishing the pixels…"];

export default function LoadingScreen({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const [phaseIdx, setPhaseIdx] = useState(0);

  useEffect(() => {
    const t1 = window.setTimeout(() => setPhaseIdx(1), 650);
    const t2 = window.setTimeout(() => setPhaseIdx(2), 1250);
    const t3 = window.setTimeout(() => setLeaving(true), 1650);
    const t4 = window.setTimeout(onDone, 2150);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.clearTimeout(t4);
    };
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-[80] flex flex-col items-center justify-center bg-canvas transition-opacity duration-500 ${
        leaving ? "opacity-0" : "opacity-100"
      }`}
      style={{
        background:
          "radial-gradient(760px 420px at 50% 34%, rgba(240,179,92,0.07), transparent 70%), radial-gradient(640px 480px at 80% 100%, rgba(217,122,62,0.05), transparent 70%), var(--bg)",
      }}
    >
      <div className="anim-scale-in relative grid h-[76px] w-[76px] place-items-center">
        <span
          className="absolute inset-0 rounded-[22px] border border-accent/40"
          style={{ animation: "ring-pulse 1.8s var(--ease-out) infinite" }}
        />
        <span
          className="absolute inset-0 rounded-[22px] border border-accent/25"
          style={{ animation: "ring-pulse 1.8s var(--ease-out) infinite", animationDelay: "0.55s" }}
        />
        <span
          className="grid h-[58px] w-[58px] place-items-center rounded-[18px] border border-linestrong bg-surface2 text-accent shadow-[0_12px_34px_rgba(0,0,0,0.5)]"
          style={{ animation: "breathe 1.8s var(--ease-out) infinite" }}
        >
          <Logo size={30} />
        </span>
      </div>

      <div className="anim-rise mt-7 text-center" style={{ animationDelay: "120ms" }}>
        <div className="font-display text-[19px] font-semibold tracking-tight">
          Getting Luca ready
          <span className="typing-dot ml-1.5" style={{ background: "var(--color-accent)" }} />
          <span className="typing-dot" style={{ background: "var(--color-accent)" }} />
          <span className="typing-dot" style={{ background: "var(--color-accent)" }} />
        </div>
        <div key={phaseIdx} className="anim-fade mt-1.5 text-[13px] text-mute">
          {PHASES[phaseIdx]}
        </div>
      </div>

      <div
        className="anim-rise shimmer-track mt-6 h-[3px] w-[220px] overflow-hidden rounded-full bg-surface3"
        style={{ animationDelay: "200ms" }}
      >
        <div className="h-full w-[42%] rounded-full bg-gradient-to-r from-accent/70 to-accent" />
      </div>
    </div>
  );
}
