import { Ban, ShieldCheck } from "lucide-react";
import { Section, SectionHeading } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLang } from "@/lib/lang";

export function Privacy() {
  const { t } = useLang();
  return (
    <Section aria-labelledby="trust-title" className="pt-12 sm:pt-16">
      <SectionHeading id="trust-title" title={t.trustTitle} />
      <div className="mx-auto grid max-w-4xl gap-5 md:grid-cols-2">
        <Card className="reveal rounded-3xl p-8">
          <CardHeader>
            <span className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-link">
              <ShieldCheck className="size-6" aria-hidden="true" />
            </span>
            <CardTitle className="mt-2">{t.doesTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>{t.doesText}</CardDescription>
          </CardContent>
        </Card>
        <Card className="reveal d1 rounded-3xl p-8">
          <CardHeader>
            <span className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-link">
              <Ban className="size-6" aria-hidden="true" />
            </span>
            <CardTitle className="mt-2">{t.doesntTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3 text-[0.975rem] text-muted-foreground">
              {([t.n1, t.n2, t.n3, t.n4] as const).map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span aria-hidden="true" className="mt-[0.65em] size-1.5 shrink-0 rounded-full bg-link" />
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </Section>
  );
}
