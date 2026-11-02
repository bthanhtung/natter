import { Section, SectionHeading } from "@/components/layout";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useLang } from "@/lib/lang";

export function Faq() {
  const { t } = useLang();
  const items = [
    { id: "q1", q: t.q1, a: t.a1 },
    { id: "q2", q: t.q2, a: t.a2 },
    { id: "q3", q: t.q3, a: t.a3 },
    { id: "q4", q: t.q4, a: t.a4 },
  ];
  return (
    <Section id="faq" aria-labelledby="faq-title">
      <SectionHeading id="faq-title" title={t.faqTitle} />
      <Accordion type="single" collapsible className="reveal mx-auto max-w-3xl rounded-3xl border border-border bg-card px-6 shadow-soft sm:px-8">
        {items.map((item) => (
          <AccordionItem key={item.id} value={item.id}>
            <AccordionTrigger>{item.q}</AccordionTrigger>
            <AccordionContent>{item.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </Section>
  );
}
