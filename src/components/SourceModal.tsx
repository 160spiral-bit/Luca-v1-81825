import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Download, FileCode2, Terminal, X } from "lucide-react";
import JSZip from "jszip";
import Logo from "./Logo";
import { copyText } from "../lib/luca";
import { SOURCE_FILES, downloadTextFile, sourceStats } from "../lib/sources";

const QUICK_START = ["npm install", "npm run dev", "node server.js   # your existing backend"];

export default function SourceModal({ open, onClose, onToast }: { open: boolean; onClose: () => void; onToast: (m: string) => void }) {
  const [zipping, setZipping] = useState(false);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const stats = useMemo(() => sourceStats(), []);

  if (!open) return null;

  const downloadZip = async () => {
    setZipping(true);
    try {
      const zip = new JSZip();
      for (const f of SOURCE_FILES) zip.file(f.path, f.content);
      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "luca-ai-ui.zip";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      onToast("luca-ai-ui.zip downloaded");
    } catch {
      onToast("Couldn't build the zip");
    } finally {
      setZipping(false);
    }
  };

  const copyFile = async (path: string, content: string) => {
    if (await copyText(content)) {
      setCopiedPath(path);
      setTimeout(() => setCopiedPath(null), 1400);
    }
  };

  return (
    <div
      className="anim-fade-in fixed inset-0 z-50 grid place-items-center bg-black/60 p-3 backdrop-blur-[3px] sm:p-5"
      style={{ animationDuration: "0.25s" }}
      onMouseDown={onClose}
    >
      <div
        className="anim-scale-in flex max-h-[88vh] w-full max-w-[600px] flex-col overflow-hidden rounded-2xl border border-linestrong bg-surface1 shadow-[0_24px_60px_rgba(0,0,0,0.6)]"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Download source code"
      >
        {/* header */}
        <div className="flex items-center gap-3 border-b border-line px-5 py-4">
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-linestrong bg-gradient-to-b from-surface2 to-surface1 text-accent">
            <Logo size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[16px] font-semibold leading-tight">Source code</h2>
            <p className="text-xs text-mute">
              {stats.files} files · {(stats.bytes / 1024).toFixed(0)} KB — exactly what's running right now
            </p>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-mute transition-all duration-150 hover:bg-surface3 hover:text-ink active:scale-90"
            aria-label="Close"
          >
            <X size={17} />
          </button>
        </div>

        {/* zip action */}
        <div className="border-b border-line px-5 py-4">
          <button
            onClick={downloadZip}
            disabled={zipping}
            className="group flex w-full items-center gap-3 rounded-xl bg-ink px-4 py-3 text-left text-canvas transition-all duration-200 hover:bg-ink/85 active:scale-[0.99] disabled:opacity-60"
          >
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-canvas/10 transition-transform duration-200 group-hover:scale-105">
              {zipping ? <span className="anim-spin inline-block"><Download size={17} /></span> : <Download size={17} />}
            </span>
            <span className="flex-1">
              <span className="block text-sm font-semibold">{zipping ? "Building archive…" : "Download luca-ai-ui.zip"}</span>
              <span className="block text-xs opacity-70">Full project — unzip, npm install, npm run dev</span>
            </span>
            <Download size={16} className="opacity-70 transition-transform duration-200 group-hover:translate-y-0.5" />
          </button>

          {/* quick start */}
          <div className="mt-3.5">
            <div className="mb-1.5 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-mute">
              <Terminal size={11} />
              Quick start
            </div>
            <div className="overflow-hidden rounded-xl border border-line bg-[#131316]">
              {QUICK_START.map((cmd, i) => (
                <div key={cmd} className={`flex items-center gap-2 px-3.5 ${i > 0 ? "border-t border-line/60" : ""}`}>
                  <span className="select-none font-mono text-[12px] text-mute/70">$</span>
                  <code className="flex-1 py-[7px] font-mono text-[12.5px] text-ink/90">{cmd}</code>
                  <button
                    onClick={async () => {
                      if (await copyText(cmd.split("#")[0].trim())) {
                        setCopiedCmd(i);
                        setTimeout(() => setCopiedCmd(null), 1200);
                      }
                    }}
                    className="grid h-7 w-7 place-items-center rounded-md text-mute transition-colors hover:bg-surface3 hover:text-ink"
                    aria-label={`Copy ${cmd}`}
                  >
                    {copiedCmd === i ? <Check size={13} className="text-ok" /> : <Copy size={13} />}
                  </button>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11.5px] leading-relaxed text-mute">
              The UI runs on <span className="font-mono text-ink/80">:5173</span> and finds your{" "}
              <span className="font-mono text-ink/80">server.js</span> on{" "}
              <span className="font-mono text-ink/80">:3000</span> automatically. Without it, responses are simulated so you can
              preview the rendering.
            </p>
          </div>
        </div>

        {/* file list */}
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2.5">
          <div className="px-2 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-mute">Files</div>
          {SOURCE_FILES.map((f, i) => (
            <div
              key={f.path}
              className="anim-fade-up group flex items-center gap-2.5 rounded-lg px-2 py-[7px] transition-colors hover:bg-surface2"
              style={{ ["--d" as string]: `${Math.min(i * 22, 300)}ms` }}
            >
              <FileCode2 size={14} className="shrink-0 text-mute/70" />
              <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-ink/90">{f.path}</span>
              <span className="shrink-0 font-mono text-[10.5px] text-mute/70">{(f.content.length / 1024).toFixed(1)} KB</span>
              <button
                onClick={() => copyFile(f.path, f.content)}
                className="grid h-7 w-7 place-items-center rounded-md text-mute opacity-0 transition-all duration-150 hover:bg-surface3 hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
                aria-label={`Copy ${f.path}`}
              >
                {copiedPath === f.path ? <Check size={13} className="text-ok" /> : <Copy size={13} />}
              </button>
              <button
                onClick={() => {
                  downloadTextFile(f.path, f.content);
                  onToast(f.path.split("/").pop() + " downloaded");
                }}
                className="grid h-7 w-7 place-items-center rounded-md text-mute opacity-0 transition-all duration-150 hover:bg-surface3 hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
                aria-label={`Download ${f.path}`}
              >
                <Download size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
