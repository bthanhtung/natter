import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Menu, Moon, Sun, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GithubIcon } from "@/components/icons";
import { Container } from "@/components/layout";
import { REPO_URL } from "@/lib/links";
import { useLang } from "@/lib/lang";
import { useTheme } from "@/lib/theme";

/** Back to the top and the bare URL, even after visiting an anchor. */
function goHome(event: MouseEvent) {
  event.preventDefault();
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  history.replaceState(null, "", "/");
}

export function Nav() {
  const { t, lang, setLang } = useLang();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  /** Close the mobile menu and hand focus back to its toggle, which stays in place. */
  const closeMenu = () => {
    setOpen(false);
    menuButton.current?.focus({ preventScroll: true });
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const links = [
    { href: "#features", label: t.navFeatures },
    { href: "#compare", label: t.navCompare },
    { href: "#download", label: t.navDownload },
    { href: "#faq", label: t.navFaq },
  ];
  const linkClass =
    "rounded-full px-3.5 py-2 text-[0.95rem] font-medium text-muted-foreground transition-colors hover:text-foreground";
  const nextLang = lang === "vi" ? "en" : "vi";

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-[var(--nav-bg)] backdrop-blur-xl backdrop-saturate-150">
      <Container className="flex h-16 items-center gap-2">
        <a href="/" onClick={goHome} aria-label={t.homeLabel} className="mr-auto flex items-center gap-2.5 rounded-full py-1 pr-3 text-lg font-bold tracking-tight">
          <img src="/assets/icon.svg" alt="" width={30} height={30} className="size-[30px]" />
          Natter
        </a>

        <nav aria-label={t.navLabel} className="hidden items-center md:flex">
          {links.map((link) => (
            <a key={link.href} href={link.href} className={linkClass}>
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-0.5">
          <Button asChild variant="ghost" size="icon" className="text-foreground">
            <a href={REPO_URL} aria-label={t.githubLabel} title="GitHub">
              <GithubIcon className="size-5" />
            </a>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            lang={nextLang}
            aria-label={t.langLabel}
            title={t.langLabel}
            onClick={() => setLang(nextLang)}
            className="text-[0.8rem] font-bold"
          >
            {t.langShort}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={theme === "dark" ? t.themeToLight : t.themeToDark}
            title={theme === "dark" ? t.themeToLight : t.themeToDark}
            onClick={toggle}
          >
            {theme === "dark" ? <Sun className="size-5" aria-hidden="true" /> : <Moon className="size-5" aria-hidden="true" />}
          </Button>
          <Button asChild size="sm" className="ml-2 hidden md:inline-flex">
            <a href="#download">{t.navDownload}</a>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            ref={menuButton}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? t.navMenuClose : t.navMenuOpen}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          </Button>
        </div>
      </Container>

      {open ? (
        <nav id="mobile-menu" aria-label={t.navLabel} className="border-t border-border/70 bg-background md:hidden">
          <Container className="flex flex-col gap-1 py-4">
            {links.map((link) => (
              <a key={link.href} href={link.href} onClick={closeMenu} className="rounded-xl px-3 py-3 text-lg font-medium hover:bg-muted">
                {link.label}
              </a>
            ))}
            <Button asChild size="lg" className="mt-2">
              <a href="#download" onClick={closeMenu}>
                {t.navDownload}
              </a>
            </Button>
          </Container>
        </nav>
      ) : null}
    </header>
  );
}
