/* Writes the server-rendered English page into dist/index.html. Run after both Vite builds. */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const { render } = await import(pathToFileURL(`${root}dist-ssr/entry-server.js`).href);
const htmlPath = `${root}dist/index.html`;
const template = await readFile(htmlPath, "utf8");
const marker = "<!--app-html-->";
if (!template.includes(marker)) throw new Error(`${marker} not found in dist/index.html`);
// Radix writes a few inline styles (accordion size variables, "outline:none", a zero animation
// duration). The CSP has no 'unsafe-inline' for styles, so they would be blocked and logged, and
// nothing here depends on them. Hydration does not re-apply attributes, and the client sets
// styles through the CSSOM, which the CSP allows.
const markup = render().replace(/ style="[^"]*"/g, "");
if (/\sstyle=/.test(markup)) throw new Error("prerendered markup still has a style attribute");
const html = template.replace(marker, () => markup);
await writeFile(htmlPath, html);
console.log(`prerendered ${(html.length / 1024).toFixed(1)} KB into dist/index.html`);
