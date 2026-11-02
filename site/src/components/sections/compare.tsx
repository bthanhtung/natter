import { Check, X } from "lucide-react";
import { Section, SectionHeading } from "@/components/layout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CAPRINE_URL } from "@/lib/links";
import type { Dict } from "@/lib/i18n";
import { useLang } from "@/lib/lang";
import { cn } from "@/lib/utils";

type Cell = { kind: "yes" } | { kind: "no"; note?: keyof Dict } | { kind: "text"; text: keyof Dict } | { kind: "none" };
const YES: Cell = { kind: "yes" };
const NONE: Cell = { kind: "none" };
const no = (note?: keyof Dict): Cell => ({ kind: "no", note });
const text = (key: keyof Dict): Cell => ({ kind: "text", text: key });

// Straight from the README table: Natter, Natter Lite, Caprine 2.61, Facebook from the browser.
const ROWS: { label: keyof Dict; cells: [Cell, Cell, Cell, Cell] }[] = [
  { label: "r1", cells: [YES, YES, no("cCaprineR1"), YES] },
  { label: "r2", cells: [YES, YES, YES, no("cFacebookR2")] },
  { label: "r3", cells: [YES, text("cLiteR3"), no("cCaprineR3"), YES] },
  { label: "r4", cells: [YES, YES, YES, no()] },
  { label: "r5", cells: [YES, YES, YES, no()] },
  { label: "r6", cells: [text("cNatterR6"), text("cLiteR6"), text("cCaprineR6"), text("cFacebookR6")] },
  { label: "r7", cells: [YES, YES, text("cCaprineR7"), NONE] },
];

function CellView({ cell }: { cell: Cell }) {
  const { t } = useLang();
  switch (cell.kind) {
    case "yes":
      return (
        <span className="inline-flex items-center gap-1.5 font-semibold text-success">
          <Check className="size-4" aria-hidden="true" />
          {t.yes}
        </span>
      );
    case "no":
      return (
        <div className="flex flex-col gap-1">
          <span className="inline-flex items-center gap-1.5 font-semibold text-danger">
            <X className="size-4" aria-hidden="true" />
            {t.no}
          </span>
          {cell.note ? <span className="text-[0.85rem] leading-snug text-muted-foreground">{t[cell.note]}</span> : null}
        </div>
      );
    case "text":
      return <span>{t[cell.text]}</span>;
    case "none":
      return <span aria-label="–">–</span>;
  }
}

export function Compare() {
  const { t } = useLang();
  const head = "min-w-[9.5rem] whitespace-normal";
  return (
    <Section id="compare" aria-labelledby="compare-title">
      <SectionHeading id="compare-title" title={t.compareTitle} lede={t.compareLede} />
      <div className="reveal overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
        <Table
          className="min-w-[860px]"
          containerProps={{ role: "region", "aria-label": t.compareScroll, tabIndex: 0, className: "focus-visible:outline-offset-[-3px]" }}
        >
          <TableHeader>
            <TableRow className="bg-muted/60">
              <TableHead scope="col" className="sticky left-0 z-10 w-48 min-w-[11rem] bg-muted">
                {t.colFeature}
              </TableHead>
              <TableHead scope="col" className={cn(head, "bg-accent-soft text-link")}>{t.colNatter}</TableHead>
              <TableHead scope="col" className={head}>{t.colLite}</TableHead>
              <TableHead scope="col" className={head}>
                <a href={CAPRINE_URL} className="underline decoration-border underline-offset-4 hover:text-link">
                  {t.colCaprine}
                </a>
              </TableHead>
              <TableHead scope="col" className={head}>{t.colFacebook}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ROWS.map((row) => (
              <TableRow key={row.label}>
                <TableHead scope="row" className="sticky left-0 z-10 bg-card align-top font-medium shadow-[1px_0_0_var(--border)]">
                  {t[row.label]}
                </TableHead>
                {row.cells.map((cell, index) => (
                  <TableCell key={index} className={cn(index === 0 && "bg-accent-soft/50")}>
                    <CellView cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="reveal mt-6 text-center text-[0.975rem] text-muted-foreground">{t.thanksA}</p>
    </Section>
  );
}
