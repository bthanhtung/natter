import { useEffect, useState } from "react";
import { RELEASES_API, detectOS, sortAssets } from "../../releases.js";

export type Asset = { name: string; size?: number; browser_download_url: string };
export type Assets = Partial<Record<string, Asset>>;
export type OS = "mac" | "windows" | "linux" | "mobile" | "other";

export type ReleaseState =
  | { status: "loading" }
  | { status: "none" }
  | { status: "busy" }
  | { status: "ready"; tag: string; date: string; natter: Assets };

type Data = { missing: true } | { tag: string; date: string; assets: Asset[] };

const CACHE_KEY = "release";
const CACHE_MS = 10 * 60 * 1000;

function readCache(): Data | null {
  try {
    const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? "null");
    if (cached && Date.now() - cached.at < CACHE_MS) return cached.data as Data;
  } catch {
    /* no cache */
  }
  return null;
}

function writeCache(data: Data) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* the page works without it */
  }
}

/** The latest public release from GitHub, cached for ten minutes. A 404 means none is published. */
export async function loadRelease(signal?: AbortSignal): Promise<Data> {
  const cached = readCache();
  if (cached) return cached;
  const response = await fetch(RELEASES_API, { headers: { Accept: "application/vnd.github+json" }, signal });
  if (response.status === 404) return { missing: true };
  if (!response.ok) throw new Error(String(response.status));
  const json = (await response.json()) as { tag_name: string; published_at: string; assets: Asset[] };
  const data: Data = {
    tag: json.tag_name,
    date: json.published_at,
    assets: json.assets.map(({ name, size, browser_download_url }) => ({ name, size, browser_download_url })),
  };
  writeCache(data);
  return data;
}

/** Release lookup. It never throws and never blocks the page; callers fall back to the Artifacts link. */
export function useRelease(): ReleaseState {
  const [state, setState] = useState<ReleaseState>({ status: "loading" });
  useEffect(() => {
    const controller = new AbortController();
    loadRelease(controller.signal).then(
      (data) => {
        if ("missing" in data || !data.assets.length) setState({ status: "none" });
        else setState({ status: "ready", tag: data.tag, date: data.date, natter: sortAssets(data.assets).natter as Assets });
      },
      () => {
        if (!controller.signal.aborted) setState({ status: "busy" });
      },
    );
    return () => controller.abort();
  }, []);
  return state;
}

/** The visitor's system. "other" until mounted, so the prerendered page matches the first client render. */
export function useOS(): OS {
  const [os, setOS] = useState<OS>("other");
  useEffect(() => setOS(detectOS(navigator.platform, navigator.userAgent) as OS), []);
  return os;
}
