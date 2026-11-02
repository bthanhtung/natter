import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { dictionaries, fmt, type Dict, type Lang } from "./i18n";

type LangContext = {
  lang: Lang;
  t: Dict;
  setLang: (lang: Lang) => void;
  /** Fills `{name}` style placeholders in a string. */
  f: (template: string, vars: Record<string, string>) => string;
};

const Context = createContext<LangContext | null>(null);

export function LangProvider({ initial, children }: { initial: Lang; children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initial);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem("lang", next);
    } catch {
      /* remembered for this visit only */
    }
  }, []);

  // Keep <html>, the title and the description in step with the language.
  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    if (lang === "vi") root.setAttribute("data-lang", "vi");
    else root.removeAttribute("data-lang");
    document.title = dictionaries[lang].docTitle;
    document.querySelector('meta[name="description"]')?.setAttribute("content", dictionaries[lang].docDescription);
  }, [lang]);

  const value = useMemo(() => ({ lang, t: dictionaries[lang], setLang, f: fmt }), [lang, setLang]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useLang(): LangContext {
  const value = useContext(Context);
  if (!value) throw new Error("useLang needs a LangProvider");
  return value;
}

/** The language to start in: stored choice, else the browser's. Safe on the server. */
export function initialLang(): Lang {
  if (typeof document === "undefined") return "en";
  return document.documentElement.getAttribute("data-lang") === "vi" ? "vi" : "en";
}
