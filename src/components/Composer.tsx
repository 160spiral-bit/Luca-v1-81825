import { useEffect, useRef, useState } from "react";
import {
  AudioWaveform,
  Check,
  ChevronDown,
  FileText,
  Image as ImageIcon,
  Mic,
  Paperclip,
  Square,
  X,
  Zap,
} from "lucide-react";
import type { LucaAttachment, ModelTier } from "../lib/luca";
import { MODELS, uid } from "../lib/luca";

interface Props {
  generating: boolean;
  enterToSend: boolean;
  tier: ModelTier;
  onTierChange: (t: ModelTier) => void;
  onSend: (text: string, attachments: LucaAttachment[]) => void;
  onStop: () => void;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export default function Composer({ generating, enterToSend, tier, onTierChange, onSend, onStop }: Props) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<LucaAttachment[]>([]);
  const [modelMenu, setModelMenu] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<any>(null);

  const hasContent = text.trim().length > 0 || attachments.length > 0;
  const tierLabel = MODELS.find((m) => m.id === "luca-" + tier)?.label || "Pro";

  /* keep textarea focused on mount + when a new chat starts */
  useEffect(() => {
    taRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!modelMenu) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setModelMenu(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [modelMenu]);

  const autoGrow = () => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  };

  const submit = () => {
    if (generating || !hasContent) return;
    onSend(text.trim(), attachments);
    setText("");
    setAttachments([]);
    requestAnimationFrame(() => {
      if (taRef.current) taRef.current.style.height = "auto";
      taRef.current?.focus();
    });
  };

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (file.size > 25 * 1024 * 1024) return; // MAX_FILE_SIZE
      const isImage = file.type.startsWith("image/");
      const att: LucaAttachment = {
        id: uid(),
        name: file.name,
        size: file.size,
        isImage,
        dataUrl: null,
        textContent: null,
      };
      if (isImage) {
        const reader = new FileReader();
        reader.onload = () => {
          att.dataUrl = String(reader.result);
          setAttachments((prev) => [...prev.filter((a) => a.id !== att.id), { ...att }]);
        };
        reader.readAsDataURL(file);
      } else {
        const reader = new FileReader();
        reader.onload = () => {
          att.textContent = String(reader.result || "");
          setAttachments((prev) => [...prev.filter((a) => a.id !== att.id), { ...att }]);
        };
        reader.readAsText(file);
      }
      setAttachments((prev) => [...prev, att]);
    });
  };

  const toggleMic = () => {
    const Ctor: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Ctor) return;
    if (micActive) {
      recRef.current?.stop();
      setMicActive(false);
      return;
    }
    const rec = new Ctor();
    rec.lang = navigator.language || "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e: any) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      setText(t);
    };
    rec.onend = () => setMicActive(false);
    rec.onerror = () => setMicActive(false);
    recRef.current = rec;
    try {
      rec.start();
      setMicActive(true);
    } catch {
      setMicActive(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[780px] px-4 pb-4">
      <div
        className="rounded-[26px] border border-transparent bg-well shadow-[0_8px_30px_rgba(0,0,0,0.35)] transition-colors duration-200 focus-within:border-edge"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          addFiles(e.dataTransfer.files);
        }}
      >
        {/* attachment chips */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-4 pt-3">
            {attachments.map((a) => (
              <div
                key={a.id}
                className="anim-pop flex items-center gap-2 rounded-xl border border-line bg-canvas py-1.5 pl-2 pr-1.5"
              >
                {a.isImage ? (
                  a.dataUrl ? (
                    <img src={a.dataUrl} alt="" className="h-7 w-7 rounded-md object-cover" />
                  ) : (
                    <span className="grid h-7 w-7 place-items-center rounded-md bg-panel">
                      <ImageIcon size={13} className="text-mute" />
                    </span>
                  )
                ) : (
                  <span className="grid h-7 w-7 place-items-center rounded-md bg-accent/12">
                    <FileText size={13} className="text-accent" />
                  </span>
                )}
                <div className="leading-tight">
                  <div className="max-w-[140px] truncate text-[12px] font-medium text-ink">{a.name}</div>
                  <div className="text-[10.5px] text-mute">
                    {a.textContent === null && a.dataUrl === null ? "reading…" : formatFileSize(a.size)}
                  </div>
                </div>
                <button
                  onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))}
                  className="rounded-md p-1 text-mute hover:bg-panel hover:text-ink"
                  aria-label={`Remove ${a.name}`}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            autoGrow();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && enterToSend) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          placeholder="Message Luca…"
          className="block max-h-[200px] w-full resize-none bg-transparent px-5 pb-1 pt-4 text-[14.5px] leading-relaxed text-ink outline-none placeholder:text-mute/75"
        />

        {/* bottom controls */}
        <div className="flex items-center gap-1 px-3 pb-2.5 pt-1">
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="rounded-full p-2 text-mute transition-colors hover:bg-canvas hover:text-ink"
            title="Attach files"
            aria-label="Attach files"
          >
            <Paperclip size={17} />
          </button>

          {/* model menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setModelMenu((m) => !m)}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
                modelMenu ? "bg-canvas text-ink" : "text-mute hover:bg-canvas hover:text-ink"
              }`}
              aria-haspopup="menu"
              aria-expanded={modelMenu}
            >
              {tierLabel}
              <ChevronDown size={13} className={`transition-transform duration-200 ${modelMenu ? "rotate-180" : ""}`} />
            </button>
            {modelMenu && (
              <div
                className="anim-pop absolute bottom-11 left-0 z-40 w-56 overflow-hidden rounded-xl border border-line bg-[#1d1d1d] py-1.5 shadow-[0_14px_38px_rgba(0,0,0,0.6)]"
                role="menu"
              >
                {MODELS.map((m) => {
                  const active = m.id === "luca-" + tier;
                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        onTierChange((m.id === "luca-flash" ? "flash" : "pro") as ModelTier);
                        setModelMenu(false);
                      }}
                      className="flex w-full items-start gap-2.5 px-3.5 py-2 text-left hover:bg-row"
                      role="menuitemradio"
                      aria-checked={active}
                    >
                      <span className="mt-0.5 text-mute">
                        {m.id === "luca-flash" ? <Zap size={15} /> : <AudioWaveform size={15} />}
                      </span>
                      <span className="flex-1">
                        <span className="block text-[13.5px] font-medium text-ink">{m.label}</span>
                        <span className="block text-[11.5px] leading-snug text-mute">
                          {m.id === "luca-flash" ? "Fastest — everyday answers" : "Deep reasoning, multi-step"}
                        </span>
                      </span>
                      {active && <Check size={15} className="mt-1 text-accent" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <span className="pointer-events-none hidden select-none items-center rounded-full border border-line px-2.5 py-1 text-[12px] font-medium text-accent sm:flex">
            Think
          </span>
          <span className="pointer-events-none hidden select-none items-center rounded-full border border-line px-2.5 py-1 text-[12px] font-medium text-accent lg:flex">
            Write or edit
          </span>

          <div className="flex-1" />

          <button
            onClick={toggleMic}
            className={`rounded-full p-2 transition-colors ${
              micActive ? "bg-accent/20 text-accent" : "text-mute hover:bg-canvas hover:text-ink"
            }`}
            title={micActive ? "Stop voice input" : "Voice input"}
            aria-label="Voice input"
            aria-pressed={micActive}
          >
            <Mic size={17} className={micActive ? "animate-pulse" : ""} />
          </button>

          {/* send / stop — #5aa9ff when active, stop square while generating */}
          <button
            onClick={generating ? onStop : submit}
            disabled={!generating && !hasContent}
            className={`grid h-9 w-9 place-items-center rounded-full transition-all duration-200 active:scale-90 ${
              generating
                ? "send-live bg-accent-strong text-canvas hover:bg-accent"
                : hasContent
                  ? "bg-accent-strong text-canvas shadow-[0_4px_16px_rgba(90,169,255,0.35)] hover:bg-accent"
                  : "cursor-default bg-[#3d3d3d] text-mute"
            }`}
            aria-label={generating ? "Stop generating" : "Send message"}
            title={generating ? "Stop generating" : "Send message"}
          >
            {generating ? (
              <Square size={13} fill="currentColor" stroke="none" />
            ) : (
              <AudioWaveform size={17} strokeWidth={2.4} />
            )}
          </button>
        </div>
      </div>
      <p className="pt-2 text-center text-[11px] text-mute/70">
        Luca can make mistakes — responses are routed across the model pool in server.js.
      </p>
    </div>
  );
}
