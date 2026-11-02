import { renderToString } from "react-dom/server";
import { App } from "./App";
import { LangProvider } from "./lib/lang";

/** The English page as HTML, for scripts/prerender.mjs. */
export function render(): string {
  return renderToString(
    <LangProvider initial="en">
      <App />
    </LangProvider>,
  );
}
