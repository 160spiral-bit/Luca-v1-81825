import { useEffect, useState } from "react";
import Logo from "./Logo";

export default function LoadingScreen({ onDone }: { onDone: () => void }) {
  const [progress, setProgress] = useState(0);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const started = performance.now();
    const duration = 1250;
    let raf = 0;
    let t1 = 0;
    let t2 = 0;

    const tick = (t: number) => {
      const k = Math.min(1, (t - started) / duration);
      /* ease-out curve so it feels like it snaps into place */
      setProgress(1 - Math.pow(1 - k, 3));
      if (k < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        t1 = window.setTimeout(() => setLeaving(true), 180);
        t2 = window.setTimeout(onDone, 680);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-[80] grid place-items-center bg-canvas transition-all duration-500 ${
        leaving ? "pointer-events-none scale-[1.03] opacity-0" : "opacity-100"
      }`}
      aria-label="Getting Luca ready"
      role="status"
    >
      {/* ambient ember glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(620px 380px at 50% 38%, color-mix(in srgb, var(--color-accent) 9%, transparent), transparent 70%)",
        }}
      />

      <div className="relative flex flex-col items-center px-6">
        <div className="relative mb-7 grid place-items-center">
          <span
            className="anim-glow absolute inset-[-26px] rounded-full"
            style={{
              background:
                "radial-gradient(circle, color-mix(in srgb, var(--color-accent) 26%, transparent), transparent 68%)",
            }}
            aria-hidden="true"
          />
          <span className="anim-breathe relative grid h-[74px] w-[74px] place-items-center rounded-[22px] border border-linestrong bg-gradient-to-b from-surface2 to-surface1 text-accent shadow-[0_18px_50px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)]">
            <Logo size={38} />
          </span>
        </div>

        <div className="anim-fade-up font-display text-[19px] font-semibold tracking-tight">
          Getting Luca ready
          <span className="ml-2 inline-flex items-end gap-[3px] pb-[3px]">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </span>
        </div>

        <div className="anim-fade-up mt-6 h-[3px] w-44 overflow-hidden rounded-full bg-surface3" style={{ ["--d" as string]: "120ms" }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${progress * 100}%`,
              background: "linear-gradient(90deg, var(--color-accent), var(--color-accent2))",
              boxShadow: "0 0 12px color-mix(in srgb, var(--color-accent) 55%, transparent)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
