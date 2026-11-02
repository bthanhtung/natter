import { Compare } from "@/components/sections/compare";
import { Demo } from "@/components/sections/demo";
import { Download } from "@/components/sections/download";
import { Faq } from "@/components/sections/faq";
import { Features } from "@/components/sections/features";
import { Footer } from "@/components/sections/footer";
import { Hero } from "@/components/sections/hero";
import { Nav } from "@/components/sections/nav";
import { Notifications } from "@/components/sections/notifications";
import { Privacy } from "@/components/sections/privacy";
import { useLang } from "@/lib/lang";
import { useReveal } from "@/lib/reveal";

export function App() {
  const { t } = useLang();
  useReveal();

  // A button rather than a link to the main element: the address bar stays as it is.
  const skip = () => document.getElementById("main")?.focus();

  return (
    <>
      <button
        type="button"
        onClick={skip}
        className="sr-only rounded-full bg-foreground px-5 py-3 font-semibold text-background focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100]"
      >
        {t.skip}
      </button>
      <Nav />
      <main id="main" tabIndex={-1} className="focus:outline-none">
        <Hero />
        <Demo />
        <Features />
        <Notifications />
        <Compare />
        <Privacy />
        <Download />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
