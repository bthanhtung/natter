import { BellOff, EyeOff, Volume2, type LucideIcon } from "lucide-react";
import { Container } from "@/components/layout";
import type { Dict } from "@/lib/i18n";
import { useLang } from "@/lib/lang";
import { cn } from "@/lib/utils";

const POINTS: { icon: LucideIcon; title: keyof Dict; body: keyof Dict }[] = [
  { icon: BellOff, title: "notifDnd", body: "notifDndD" },
  { icon: EyeOff, title: "notifHide", body: "notifHideD" },
  { icon: Volume2, title: "notifSound", body: "notifSoundD" },
];

function Banner({ title, text, className }: { title: string; text: string; className?: string }) {
  const { t } = useLang();
  return (
    <div className={cn("banner flex items-start gap-3 rounded-[1.4rem] p-4", className)}>
      <img src="/assets/icon.svg" alt="" width={40} height={40} className="size-10 shrink-0" />
      <div className="min-w-0 flex-1 leading-snug">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-[0.95rem] font-semibold">{title}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{t.notifNow}</span>
        </div>
        <p className="mt-0.5 text-[0.9rem] text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

export function Notifications() {
  const { t } = useLang();
  return (
    <section aria-labelledby="notif-title" className="py-12 sm:py-16">
      <Container>
        <div className="grid items-center gap-12 rounded-[2rem] bg-muted p-6 sm:p-12 lg:grid-cols-2 lg:gap-16 lg:p-16">
          <div className="reveal">
            <h2 id="notif-title" className="text-[clamp(1.9rem,4.4vw,3rem)] font-bold">
              {t.notifTitle}
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">{t.notifLede}</p>
            <ul className="mt-9 flex flex-col gap-6">
              {POINTS.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex gap-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-card text-link shadow-soft">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold leading-snug">{t[title]}</h3>
                    <p className="text-[0.975rem] text-muted-foreground">{t[body]}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div role="img" aria-label={t.notifLabel} className="stage reveal d2 flex flex-col gap-3 rounded-3xl p-5 sm:p-8">
            <Banner title={t.bnLinh} text={t.bnLinhText} className="float-a" />
            <Banner title={t.bnHiking} text={t.bnHikingText} className="float-b sm:ml-8" />
            <Banner title={t.bnNora} text={t.bnNoraText} className="float-a sm:ml-3" />
          </div>
        </div>
      </Container>
    </section>
  );
}
