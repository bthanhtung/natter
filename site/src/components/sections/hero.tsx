import { Download as DownloadIcon } from "lucide-react";
import { GithubIcon } from "@/components/icons";
import { Container } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { WindowMock } from "@/components/sections/window-mock";
import { REPO_URL } from "@/lib/links";
import { useLang } from "@/lib/lang";
import { useOS } from "@/lib/release";

export function Hero() {
  const { t, f } = useLang();
  const os = useOS();
  const name = { mac: "macOS", windows: "Windows", linux: "Linux" }[os as "mac" | "windows" | "linux"];

  return (
    <div className="hero-glow pb-20 pt-16 sm:pb-28 sm:pt-24">
      <Container className="text-center">
        <h1 className="rise mx-auto max-w-4xl text-[clamp(2.5rem,7.5vw,5.25rem)] font-bold leading-[1.04] tracking-[-0.035em]">
          <span className="block">{t.heroA}</span>
          <span className="text-gradient block pb-[0.08em]">{t.heroB}</span>
        </h1>
        <p className="rise d1 mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">{t.heroLede}</p>
        <div className="rise d2 mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <a href="#download">
              <DownloadIcon className="size-5" aria-hidden="true" />
              {name ? f(t.ctaDownloadFor, { name }) : t.ctaDownload}
            </a>
          </Button>
          <Button asChild size="lg" variant="secondary" className="w-full sm:w-auto">
            <a href={REPO_URL}>
              <GithubIcon className="size-5" />
              {t.ctaGithub}
            </a>
          </Button>
        </div>
        <ul className="rise d3 mt-8 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm font-medium text-muted-foreground">
          {[t.metaFree, t.metaPlatforms, t.metaLicense, t.metaUnofficial].map((item, index) => (
            <li key={item} className="flex items-center gap-2">
              {index > 0 ? <span aria-hidden="true" className="size-1 rounded-full bg-border" /> : null}
              {item}
            </li>
          ))}
        </ul>
      </Container>
      <div className="rise d4 mt-14 sm:mt-20">
        <WindowMock />
      </div>
    </div>
  );
}
