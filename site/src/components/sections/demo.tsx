import { Section, SectionHeading } from "@/components/layout";
import { useLang } from "@/lib/lang";

export function Demo() {
  const { t } = useLang();
  return (
    <Section aria-labelledby="demo-title" className="pt-0 sm:pt-4">
      <SectionHeading id="demo-title" title={t.demoTitle} />
      <figure className="reveal mx-auto max-w-[880px]">
        <div className="rounded-3xl bg-muted p-2.5 shadow-big sm:p-4">
          <img
            src="/assets/demo.gif"
            alt={t.demoAlt}
            width={880}
            height={550}
            loading="lazy"
            decoding="async"
            className="w-full rounded-2xl border border-border"
          />
        </div>
        <figcaption className="mt-5 text-center text-sm text-muted-foreground">{t.demoCaption}</figcaption>
      </figure>
    </Section>
  );
}
