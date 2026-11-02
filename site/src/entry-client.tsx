import { flushSync } from "react-dom";
import { createRoot, hydrateRoot } from "react-dom/client";
import { App } from "./App";
import { LangProvider, initialLang } from "./lib/lang";
import "./index.css";

const container = document.getElementById("root");
if (!container) throw new Error("#root is missing");

const lang = initialLang();
const app = (
  <LangProvider initial={lang}>
    <App />
  </LangProvider>
);

if (lang === "en" && container.hasChildNodes()) {
  // The prerendered page is English, so it can be hydrated as is.
  hydrateRoot(container, app);
} else {
  // Vietnamese: #root stays hidden until this render is in place, so English never flashes.
  flushSync(() => createRoot(container).render(app));
}
document.documentElement.setAttribute("data-ready", "");
