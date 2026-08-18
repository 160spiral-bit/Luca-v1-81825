import { useEffect, useRef, useState } from "react";
import { ArrowUp, Check, ChevronDown, FileText, Image as ImageIcon, Mic, Paperclip, Square, X } from "lucide-react";
import { COMPOSER_MAX_LEN, MODELS, uid } from "../lib/luca";
import type { Attachment, Settings, Tier } from "../lib/luca";

interface Props {
  streaming: boolean;
  onSend: (text: string, attachments: Attachment[]) => void;
  onStop: () => void;
  tier: Tier;
  onTierChange: (t: Tier) => void;
  settings: Settings;
  onToast: (msg: string) => void;
}

export default function Composer({
  streaming,
  onSend,
  onStop,
  tier,
  onTierChange,
  settings,
  onToast,
}: Props) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [modelMenu, setModelMenu] = useState(false);
  const [listening, setListening] = useState(false);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const recogRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    if (!modelMenu) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setModelMenu(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setModelMenu(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [modelMenu]);

  const autosize = () => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  };

  useEffect(autosize, [text]);

  const canSend = (text.trim().length > 0 || attachments.length > 0) && !streaming;

  const doSend = () => {
    if (!canSend) return;
    if (text.length > COMPOSER_MAX_LEN) {
      onToast("Message is over the " + COMPOSER_MAX_LEN.toLocaleString() + " character limit");
      return;
    }
    onSend(text.trim(), attachments);
    setText("");
    setAttachments([]);
    requestAnimationFrame(() => taRef.current?.focus());
  };

  const addFiles = (files: FileList | File[]) => {
    const list = Array.from(files);
    for (const f of list) {
      if (f.size > 4 * 1024 * 1024) {
        onToast(`“${f.name}” is over 4 MB — skipped`);
        continue;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setAttachments((prev) => [
          ...prev,
          { id: uid(), name: f.name, type: f.type, size: f.size, dataUrl: String(reader.result) },
        ]);
      };
      reader.readAsDataURL(f);
    }
  };

  const toggleMic = () => {
    const SR = (window as unknown as { webkitSpeechRecognition?: new () => {
      lang: string;
      continuous: boolean;
      interimResults: boolean;
      onresult: ((e: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null;
      onend: (() => void) | null;
      onerror: (() => void) | null;
      start: () => void;
      stop: () => void;
    } }).webkitSpeechRecognition;

    if (!SR) {
      onToast("Voice input isn't supported in this browser");
      return;
    }
    if (listening) {
      recogRef.current?.stop();
      setListening(false);
      return;
    }
    const r = new SR();
    r.lang = "en-US";
    r.continuous = false;
    r.interimResults = false;
    r.onresult = (e) => {
      const transcript = e.results[0]?.[0]?.transcript || "";
      if (transcript) setText((t) => (t ? t + " " : "") + transcript);
    };
    r.onend = () => setListening(false);
    r.onerror = () => {
      setListening(false);
      onToast("Couldn't hear anything — try again");
    };
    r.start();
    recogRef.current = r;
    setListening(true);
  };

  const activeModel = MODELS.find((m) => m.tier === tier) || MODELS[1];
  const nearLimit = text.length > COMPOSER_MAX_LEN - 20000;

  return (
    <div
      className="mx-auto w-full max-w-[820px] px-3 pb-[max(14px,env(safe-area-inset-bottom))] pt-1.5 sm:px-5"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
      }}
    >
      <div
        className={`rounded-3xl border bg-surface4 p-1.5 pb-2 transition-colors duration-200 ${
          dragOver ? "border-accent" : "border-line"
        }`}
      >
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-2.5 pb-2 pt-1.5">
            {attachments.map((a) => (
              <div
                key={a.id}
                className="anim-pop flex items-center gap-2 rounded-lg border border-linestrong bg-surface3 py-1.5 pl-1.5 pr-2 text-[12.5px]"
              >
                {a.type.startsWith("image/") ? (
                  <img src={a.dataUrl} alt="" className="h-7 w-7 rounded-md object-cover" />
                ) : (
                  <span className="grid h-7 w-7 place-items-center rounded-md bg-surface4 text-mute">
                    {a.type.startsWith("image") ? <ImageIcon size={14} /> : <FileText size={14} />}
                  </span>
                )}
                <span className="max-w-[140px] truncate">{a.name}</span>
                <button
                  onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))}
                  className="grid h-5 w-5 place-items-center rounded text-mute hover:bg-surface4 hover:text-ink"
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
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (settings.enterToSend && !e.shiftKey) {
                e.preventDefault();
                doSend();
              } else if (!settings.enterToSend && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                doSend();
              }
            }
          }}
          rows={1}
          placeholder="Ask anything"
          aria-label="Message Luca"
          className="block w-full resize-none border-none bg-transparent px-3 pb-1 pt-2 text-[16px] leading-relaxed text-ink outline-none placeholder:text-mute md:text-[15px]"
        />

        <div className="flex items-center gap-1.5 px-1 pt-0.5">
          <button
            onClick={() => fileRef.current?.click()}
            className="grid h-9 w-9 place-items-center rounded-full text-mute transition-all hover:bg-surface3 hover:text-ink active:scale-90"
            aria-label="Attach files"
          >
            <Paperclip size={17} />
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) addFiles(e.target.files);
              e.target.value = "";
            }}
          />

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setModelMenu((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={modelMenu}
              className="flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-mute transition-colors hover:bg-surface3 hover:text-ink"
            >
              <span id="modelMenuLabel">Luca {activeModel.label}</span>
              <ChevronDown size={13} className={`transition-transform duration-150 ${modelMenu ? "rotate-180" : ""}`} />
            </button>

            {modelMenu && (
              <div
                className="anim-pop-up absolute bottom-11 left-0 z-50 w-[148px] rounded-xl border border-linestrong bg-surface2 p-1 shadow-[0_14px_38px_rgba(0,0,0,0.55)]"
                role="menu"
              >
                <div className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-mute/80">
                  Model
                </div>
                {MODELS.map((m) => (
                  <button
                    key={m.id}
                    role="menuitemradio"
                    aria-checked={m.tier === tier}
                    onClick={() => {
                      onTierChange(m.tier);
                      setModelMenu(false);
                    }}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-[7px] text-left text-[13px] font-medium transition-all duration-150 hover:bg-surface3 active:scale-[0.98] ${
                      m.tier === tier ? "text-ink" : "text-mute"
                    }`}
                  >
                    Luca {m.label}
                    {m.tier === tier && <Check size={13} className="anim-scale-in text-accent" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1" />

          {nearLimit && (
            <span className="text-[11.5px] text-danger">{text.length.toLocaleString()} / {COMPOSER_MAX_LEN.toLocaleString()}</span>
          )}

          <button
            onClick={toggleMic}
            aria-pressed={listening}
            className={`grid h-9 w-9 place-items-center rounded-full transition-all active:scale-90 ${
              listening ? "bg-danger/15 text-danger" : "text-mute hover:bg-surface3 hover:text-ink"
            }`}
            aria-label="Voice input"
          >
            <Mic size={16} className={listening ? "animate-pulse" : ""} />
          </button>

          {streaming ? (
            <button
              onClick={onStop}
              aria-label="Stop generating"
              className="grid h-9 w-9 place-items-center rounded-full bg-surface3 text-ink transition-all hover:bg-linestrong active:scale-90"
            >
              <Square size={13} fill="currentColor" strokeWidth={0} />
            </button>
          ) : (
            <button
              onClick={doSend}
              disabled={!canSend}
              aria-label="Send message"
              className={`grid h-9 w-9 place-items-center rounded-full transition-all duration-200 ${
                canSend
                  ? "bg-ink text-canvas shadow-[0_3px_14px_rgba(0,0,0,0.4)] hover:bg-ink/85 active:scale-90"
                  : "bg-surface3 text-mute"
              }`}
            >
              <ArrowUp size={17} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>

      <div className="pt-2 text-center text-[11.5px] text-mute/85">
        {settings.enterToSend ? "Enter to send · Shift+Enter for a new line" : "Ctrl/⌘+Enter to send"}
        {" · "}Luca can make mistakes
      </div>
    </div>
  );
}
