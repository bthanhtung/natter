import { useState } from "react";
import { Mic, Paperclip, Phone, Search, Send, Video } from "lucide-react";
import { Container } from "@/components/layout";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/lang";
import type { Dict } from "@/lib/i18n";

type MockTheme = "light" | "grey" | "dark" | "contrast";

const THEMES: { id: MockTheme; label: keyof Dict }[] = [
  { id: "light", label: "themeLight" },
  { id: "grey", label: "themeGrey" },
  { id: "dark", label: "themeDark" },
  { id: "contrast", label: "themeContrast" },
];

const AVATARS = {
  linh: "bg-rose-600",
  hiking: "bg-emerald-700",
  bao: "bg-indigo-600",
  nora: "bg-amber-700",
  studio: "bg-slate-600",
} as const;

function Avatar({ initials, tone, size = "md" }: { initials: string; tone: keyof typeof AVATARS; size?: "md" | "sm" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-semibold text-white",
        AVATARS[tone],
        size === "md" ? "size-11 text-sm" : "size-9 text-xs",
      )}
    >
      {initials}
    </span>
  );
}

function ChatRow({
  tone,
  initials,
  name,
  preview,
  time,
  unread,
  selected,
}: {
  tone: keyof typeof AVATARS;
  initials: string;
  name: string;
  preview: string;
  time: string;
  unread?: number;
  selected?: boolean;
}) {
  return (
    <li className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5", selected && "mock-sel")}>
      <Avatar tone={tone} initials={initials} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className={cn("truncate text-[0.9rem]", unread ? "font-bold" : "font-semibold")}>{name}</span>
          <span className="mock-sub shrink-0 text-xs">{time}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className={cn("mock-sub truncate text-[0.82rem]", unread && "font-semibold")}>{preview}</span>
          {unread ? (
            <span className="mock-badge grid min-w-5 shrink-0 place-items-center rounded-full px-1.5 text-[0.7rem] font-bold leading-5">
              {unread}
            </span>
          ) : null}
        </div>
      </div>
    </li>
  );
}

/** A hand-built stand-in for the app window. Themes are data attributes, so no inline styles are needed. */
export function WindowMock() {
  const { t } = useLang();
  const [theme, setTheme] = useState<MockTheme>("light");

  return (
    <Container className="reveal">
      <div
        role="img"
        aria-label={t.mockLabel}
        data-mock={theme}
        className="mock mx-auto max-w-[1000px] overflow-hidden rounded-2xl border mock-line shadow-big sm:rounded-3xl"
      >
        {/* Title bar */}
        <div className="mock-bar relative flex h-11 items-center border-b px-4">
          <div className="flex gap-2" aria-hidden="true">
            <span className="size-3 rounded-full bg-[#ff5f57]" />
            <span className="size-3 rounded-full bg-[#febc2e]" />
            <span className="size-3 rounded-full bg-[#28c840]" />
          </div>
          <span className="pointer-events-none absolute inset-x-0 text-center text-[0.8rem] font-semibold">Natter</span>
        </div>

        <div className="flex h-[26rem] sm:h-[31rem]">
          {/* Chat list */}
          <aside className="mock-panel hidden w-[17.5rem] shrink-0 flex-col gap-2 border-r p-3 md:flex lg:w-80">
            <div className="mock-in flex h-9 items-center gap-2 rounded-full px-3 text-[0.85rem]">
              <Search className="size-4" aria-hidden="true" />
              <span className="mock-sub">{t.mockSearch}</span>
            </div>
            <ul className="flex flex-col gap-0.5">
              <ChatRow selected tone="linh" initials={t.chatLinh[0]} name={t.chatLinh} preview={t.pLinh} time="9:24" />
              <ChatRow tone="hiking" initials={t.chatHiking[0]} name={t.chatHiking} preview={t.pHiking} time="9:02" unread={3} />
              <ChatRow tone="bao" initials={t.chatBao[0]} name={t.chatBao} preview={t.pBao} time="8:47" unread={1} />
              <ChatRow tone="nora" initials={t.chatNora[0]} name={t.chatNora} preview={t.pNora} time="Mon" />
              <ChatRow tone="studio" initials={t.chatStudio[0]} name={t.chatStudio} preview={t.pStudio} time="Sun" />
            </ul>
          </aside>

          {/* Open conversation */}
          <section className="flex min-w-0 flex-1 flex-col">
            <header className="mock-line flex items-center gap-3 border-b px-4 py-3">
              <Avatar tone="linh" initials={t.chatLinh[0]} size="sm" />
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate text-[0.95rem] font-bold">{t.chatLinh}</div>
                <div className="mock-sub text-xs">{t.mockLastSeen}</div>
              </div>
              <Phone className="size-5" aria-hidden="true" />
              <Video className="size-5" aria-hidden="true" />
            </header>

            <div className="flex flex-1 flex-col justify-end gap-2 overflow-hidden p-4 text-[0.92rem] leading-snug sm:p-6">
              <p className="mock-in max-w-[78%] self-start rounded-2xl rounded-bl-md px-4 py-2.5">{t.m1}</p>
              <p className="mock-out max-w-[78%] self-end rounded-2xl rounded-br-md px-4 py-2.5">{t.m2}</p>
              <p className="mock-in max-w-[78%] self-start rounded-2xl rounded-bl-md px-4 py-2.5">{t.m3}</p>
              <p className="mock-out max-w-[78%] self-end rounded-2xl rounded-br-md px-4 py-2.5">{t.m4}</p>
              <p className="mock-in max-w-[78%] self-start rounded-2xl rounded-bl-md px-4 py-2.5">{t.m5}</p>
            </div>

            <footer className="mock-line flex items-center gap-3 border-t px-4 py-3">
              <Paperclip className="size-5 shrink-0" aria-hidden="true" />
              <div className="mock-in mock-sub flex h-10 min-w-0 flex-1 items-center rounded-full px-4 text-[0.88rem]">
                <span className="truncate">{t.mockWrite}</span>
              </div>
              <Mic className="size-5 shrink-0" aria-hidden="true" />
              <Send className="size-5 shrink-0" aria-hidden="true" />
            </footer>
          </section>
        </div>
      </div>

      {/* Theme chips: real buttons, outside the illustration */}
      <div className="mx-auto mt-8 flex max-w-[1000px] flex-col items-center gap-3">
        <p id="mock-themes" className="text-sm font-semibold text-muted-foreground">
          {t.mockThemes}
        </p>
        <div role="group" aria-labelledby="mock-themes" className="flex flex-wrap justify-center gap-2">
          {THEMES.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              aria-pressed={theme === id}
              onClick={() => setTheme(id)}
              className={cn(
                "h-10 rounded-full px-5 text-sm font-semibold transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none",
                theme === id ? "bg-foreground text-background" : "bg-muted text-foreground hover:bg-border",
              )}
            >
              {t[label]}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">{t.mockHint}</p>
      </div>
    </Container>
  );
}
