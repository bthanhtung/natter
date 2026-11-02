import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Container({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mx-auto w-full max-w-[1160px] px-5 sm:px-8", className)} {...props} />;
}

/** A page section with a consistent rhythm. `id` doubles as the anchor target. */
export function Section({ className, children, ...props }: ComponentProps<"section">) {
  return (
    <section className={cn("py-20 sm:py-28", className)} {...props}>
      <Container>{children}</Container>
    </section>
  );
}

export function SectionHeading({
  id,
  title,
  lede,
  className,
}: {
  id?: string;
  title: string;
  lede?: string;
  className?: string;
}) {
  return (
    <div className={cn("reveal mx-auto mb-12 max-w-2xl text-center sm:mb-16", className)}>
      <h2 id={id} className="text-[clamp(2rem,5vw,3.25rem)] font-bold">
        {title}
      </h2>
      {lede ? <p className="mt-4 text-lg text-muted-foreground">{lede}</p> : null}
    </div>
  );
}
