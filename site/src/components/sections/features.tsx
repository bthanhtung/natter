import { Bell, MessageCircle, MonitorSmartphone, Palette, PhoneCall, Tag, Zap, type LucideIcon } from "lucide-react";
import { Section, SectionHeading } from "@/components/layout";
import type { Dict } from "@/lib/i18n";
import { useLang } from "@/lib/lang";
import { cn } from "@/lib/utils";

type Feature = { icon: LucideIcon; title: keyof Dict; body: keyof Dict; span: string; accent?: boolean };

// A 6-column bento: 4+2, 2+2+2, 3+3.
const FEATURES: Feature[] = [
  { icon: MessageCircle, title: "f1", body: "f1d", span: "lg:col-span-4", accent: true },
  { icon: PhoneCall, title: "f2", body: "f2d", span: "lg:col-span-2" },
  { icon: Tag, title: "f3", body: "f3d", span: "lg:col-span-2" },
  { icon: Bell, title: "f4", body: "f4d", span: "lg:col-span-2" },
  { icon: Palette, title: "f5", body: "f5d", span: "lg:col-span-2" },
  { icon: Zap, title: "f6", body: "f6d", span: "lg:col-span-3" },
  { icon: MonitorSmartphone, title: "f7", body: "f7d", span: "lg:col-span-3" },
];

export function Features() {
  const { t } = useLang();
  return (
    <Section id="features" aria-labelledby="features-title">
      <SectionHeading id="features-title" title={t.featuresTitle} />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6 lg:gap-5">
        {FEATURES.map(({ icon: Icon, title, body, span, accent }, index) => (
          <li
            key={title}
            className={cn(
              "reveal flex flex-col gap-4 rounded-3xl border border-border p-7 shadow-soft sm:p-8",
              accent ? "bg-accent-soft" : "bg-card",
              span,
              index === 0 && "sm:col-span-2",
              index === 6 && "sm:col-span-2",
              index % 3 === 1 && "d1",
              index % 3 === 2 && "d2",
            )}
          >
            <span className="grid size-12 place-items-center rounded-2xl bg-brand shadow-[0_8px_20px_-8px_rgb(36_66_216/0.7)]">
              <Icon className="size-6" aria-hidden="true" />
            </span>
            <h3 className="text-xl font-semibold leading-snug">{t[title]}</h3>
            <p className="text-[0.975rem] text-muted-foreground">{t[body]}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}
