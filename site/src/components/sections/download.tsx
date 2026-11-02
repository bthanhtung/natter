import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, Copy, Download as DownloadIcon, TriangleAlert } from "lucide-react";
import { formatSize } from "../../../releases.js";
import { Section, SectionHeading } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BUILD_TOOLS_URL, README_LITE_URL } from "@/lib/links";
import type { Dict } from "@/lib/i18n";
import { useLang } from "@/lib/lang";
import { useOS, useRelease, type Asset, type Assets, type OS, type ReleaseState } from "@/lib/release";
import { cn } from "@/lib/utils";

/* ---------- Natter (full) ---------- */

type Row = { id: "mac" | "windows" | "linux"; os: OS; name: string; note: keyof Dict; files: { key: string; label: keyof Dict | null }[] };

const ROWS: Row[] = [
  { id: "mac", os: "mac", name: "macOS", note: "noteMac", files: [{ key: "mac", label: null }] },
  { id: "windows", os: "windows", name: "Windows", note: "noteWindows", files: [{ key: "windows", label: null }] },
  {
    id: "linux",
    os: "linux",
    name: "Linux",
    note: "noteLinux",
    files: [
      { key: "deb", label: "distroDeb" },
      { key: "rpm", label: "distroRpm" },
      { key: "arch", label: "distroArch" },
      { key: "appimage", label: "distroAppImage" },
    ],
  },
];

function FileButton({ asset, label, row }: { asset: Asset; label: string | null; row: Row }) {
  const { t, f } = useLang();
  const size = asset.size ? formatSize(asset.size) : null;
  return (
    <Button
      asChild
      className={cn(
        "h-auto w-full min-w-0 py-2 text-center",
        label ? "min-h-9 whitespace-nowrap px-3" : "min-h-11 whitespace-normal",
      )}
      variant={label ? "outline" : "default"}
      size={label ? "sm" : "default"}
    >
      <a href={asset.browser_download_url}>
        {label ? null : <DownloadIcon className="size-4" aria-hidden="true" />}
        {label ?? f(t.ctaDownloadFor, { name: row.name })}
        {size ? <span className="font-normal opacity-80">{f(t.directSize, { size })}</span> : null}
      </a>
    </Button>
  );
}

function PlatformRow({ row, natter, os }: { row: Row; natter: Assets; os: OS }) {
  const { t } = useLang();
  const mine = os === row.os;
  const found = row.files.flatMap(({ key, label }) => (natter[key] ? [{ asset: natter[key] as Asset, label }] : []));

  return (
    <li
      className={cn(
        "flex flex-col gap-4 rounded-2xl border p-5",
        mine ? "border-link bg-accent-soft" : "border-border bg-background",
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-lg font-semibold">{row.name}</h4>
          {mine ? <Badge>{t.yourSystem}</Badge> : null}
        </div>
        <p className="text-sm text-muted-foreground">{t[row.note]}</p>
      </div>
      <div className={cn("grid gap-2", found.length > 1 && "sm:grid-cols-2")}>
        {found.map(({ asset, label }) => (
          <FileButton key={asset.name} asset={asset} label={label ? t[label] : null} row={row} />
        ))}
      </div>
    </li>
  );
}

function statusText(state: ReleaseState, lang: string, t: Dict, f: (s: string, v: Record<string, string>) => string) {
  const date = new Date(state.date).toLocaleDateString(lang === "vi" ? "vi-VN" : "en-US", { dateStyle: "medium" });
  return f(t.latest, { tag: state.tag, date });
}

function NatterCard() {
  const { t, f, lang } = useLang();
  const os = useOS();
  const release = useRelease();

  return (
    <Card className="reveal min-w-0 rounded-3xl p-7 sm:p-9">
      <CardHeader>
        <div className="flex items-center gap-3">
          <img src="/assets/icon.svg" alt="" width={44} height={44} className="size-11" />
          <CardTitle className="text-2xl">Natter</CardTitle>
        </div>
        <CardDescription>{t.natterPitch}</CardDescription>
        <p role="status" className="text-sm font-medium text-muted-foreground">
          {statusText(release, lang, t, f)}
        </p>
      </CardHeader>

      {os === "mobile" ? <p className="rounded-xl bg-muted px-4 py-3 text-sm font-medium">{t.mobileNote}</p> : null}

      <ul className="flex flex-col gap-3">
        {ROWS.map((row) => (
          <PlatformRow key={row.id} row={row} natter={release.natter} os={os} />
        ))}
      </ul>
    </Card>
  );
}

/* ---------- Natter Lite (build from source) ---------- */

const BUILD_STEPS = [
  "git clone https://github.com/bthanhtung/natter.git",
  "cd natter",
  "npm install",
  "npm run build",
];
const APT =
  "sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev";
const DNF =
  "sudo dnf install webkit2gtk4.1-devel gcc-c++ curl wget file libxdo-devel openssl-devel libappindicator-gtk3-devel librsvg2-devel rpm-build";

function CopyButton({ text, label }: { text: string; label: string }) {
  const { t } = useLang();
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setDone(false), 2000);
    } catch {
      /* clipboard blocked: the text is still selectable */
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={copy}
        aria-label={label}
        className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white/10 px-3 text-xs font-semibold text-[#e8eaf0] transition-colors hover:bg-white/20 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#8fb8ff] motion-reduce:transition-none"
      >
        {done ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
        {done ? t.copied : t.copy}
      </button>
      <span role="status" className="sr-only">
        {done ? t.copied : ""}
      </span>
    </>
  );
}

function Code({ lines, prompt = true, action }: { lines: string[]; prompt?: boolean; action?: React.ReactNode }) {
  return (
    <div className="relative rounded-2xl bg-[#0f1115] p-4 text-[#e8eaf0]">
      {action ? <div className="mb-2 flex justify-end">{action}</div> : null}
      <pre className="whitespace-pre-wrap break-words font-mono text-[0.85rem] leading-relaxed">
        {lines.map((line) => (
          <code key={line} className={cn("block", prompt && "before:mr-2 before:select-none before:text-[#8b93a5] before:content-['$']")}>
            {line}
          </code>
        ))}
      </pre>
    </div>
  );
}

function LiteCard() {
  const { t, f } = useLang();
  const os = useOS();
  const [tab, setTab] = useState("mac");
  useEffect(() => {
    if (os === "windows") setTab("windows");
    else if (os === "linux") setTab("ubuntu");
    else if (os === "mac") setTab("mac");
  }, [os]);

  return (
    <Card className="reveal d1 min-w-0 rounded-3xl p-7 sm:p-9">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-3">
          <CardTitle className="text-2xl">Natter Lite</CardTitle>
          <Badge variant="outline">{t.liteBadge}</Badge>
        </div>
        <CardDescription>{t.litePitch}</CardDescription>
      </CardHeader>

      <p className="rounded-2xl bg-accent-soft px-5 py-4 text-[0.95rem] font-medium">{t.liteNoInstaller}</p>

      <div className="flex flex-col gap-3">
        <h4 className="font-semibold">{t.liteSteps}</h4>
        <p className="text-[0.95rem] text-muted-foreground">{t.liteNeeds}</p>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList aria-label={t.prereqLabel} className="rounded-2xl sm:rounded-full">
            <TabsTrigger value="mac">{t.tabMac}</TabsTrigger>
            <TabsTrigger value="windows">{t.tabWindows}</TabsTrigger>
            <TabsTrigger value="ubuntu">{t.tabUbuntu}</TabsTrigger>
            <TabsTrigger value="fedora">{t.tabFedora}</TabsTrigger>
          </TabsList>
          <TabsContent value="mac">
            <Code lines={["xcode-select --install"]} />
          </TabsContent>
          <TabsContent value="windows">
            <p className="text-[0.95rem] text-muted-foreground">
              {t.winPrereq}{" "}
              <a href={BUILD_TOOLS_URL} className="font-medium text-link underline underline-offset-4">
                {t.winPrereqLink}
              </a>
            </p>
          </TabsContent>
          <TabsContent value="ubuntu">
            <Code lines={[APT]} />
          </TabsContent>
          <TabsContent value="fedora">
            <Code lines={[DNF]} />
          </TabsContent>
        </Tabs>
      </div>

      <Code
        lines={BUILD_STEPS}
        action={<CopyButton text={BUILD_STEPS.join("\n")} label={f(t.copyLabel, { cmd: BUILD_STEPS.join(" && ") })} />}
      />

      <p className="text-[0.95rem] text-muted-foreground">
        {f(t.liteOut, { path: "src-tauri/target/release/bundle" })}
      </p>
      <Button asChild variant="outline" className="w-full sm:w-fit">
        <a href={README_LITE_URL}>
          {t.liteReadme}
          <ArrowUpRight className="size-4" aria-hidden="true" />
        </a>
      </Button>
    </Card>
  );
}

export function Download() {
  const { t } = useLang();
  return (
    <Section id="download" aria-labelledby="download-title">
      <SectionHeading id="download-title" title={t.downloadTitle} lede={t.downloadLede} />
      <div className="grid items-start gap-5 lg:grid-cols-2 lg:gap-6">
        <NatterCard />
        <LiteCard />
      </div>
      <div className="reveal mx-auto mt-8 flex max-w-3xl items-start gap-3 rounded-2xl border border-amber-500/50 bg-amber-500/10 px-5 py-4 text-[0.95rem]">
        <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <p>{t.unsigned}</p>
      </div>
    </Section>
  );
}
