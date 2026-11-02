import { Container } from "@/components/layout";
import { AUTHOR_URL, REPO_URL } from "@/lib/links";
import { useLang } from "@/lib/lang";

export function Footer() {
  const { t } = useLang();
  const link = "rounded-md font-medium text-foreground underline decoration-border underline-offset-4 hover:text-link";
  return (
    <footer className="border-t border-border py-12">
      <Container className="flex flex-col items-center gap-5 text-center text-sm text-muted-foreground">
        <p className="max-w-xl">{t.footer}</p>
        <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2">
          <li>
            <a href={`${REPO_URL}/blob/main/LICENSE`} className={link}>
              {t.license}
            </a>
          </li>
          <li>
            <a href={REPO_URL} className={link}>
              GitHub
            </a>
          </li>
          <li>
            <a href={AUTHOR_URL} className={link}>
              {t.footerSite}
            </a>
          </li>
        </ul>
      </Container>
    </footer>
  );
}
