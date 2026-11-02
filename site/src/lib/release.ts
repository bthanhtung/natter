import { useEffect, useState } from "react";
import { KNOWN_RELEASE, RELEASES_API, detectOS, sortAssets } from "../../releases.js";

export type Asset = { name: string; size?: number; browser_download_url: string };
export type Assets = Partial<Record<string, Asset>>;
export type OS = "mac" | "windows" | "linux" | "mobile" | "other";

export type ReleaseState = { status: "ready"; tag: string; date: string; natter: Assets };

type Data = { tag: string; date: string; assets: Asset[] };

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

/** The latest public release from GitHub, cached for ten minutes. Failures are never cached. */
export async function loadRelease(signal?: AbortSignal): Promise<Data | null> {
  const cached = readCache();
  if (cached) return cached;
  const response = await fetch(RELEASES_API, { headers: { Accept: "application/vnd.github+json" }, signal });
  if (!response.ok) return null;
  const json = (await response.json()) as { tag_name: string; published_at: string; assets: Asset[] };
  const data: Data = {
    tag: json.tag_name,
    date: json.published_at,
    assets: json.assets.map(({ name, size, browser_download_url }) => ({ name, size, browser_download_url })),
  };
  if (!data.assets.length) return null;
  writeCache(data);
  return data;
}

const toState = (tag: string, date: string, assets: Asset[]): ReleaseState => ({
  status: "ready",
  tag,
  date,
  natter: sortAssets(assets).natter as Assets,
});

const KNOWN_STATE = toState(KNOWN_RELEASE.tag, KNOWN_RELEASE.date, KNOWN_RELEASE.assets as Asset[]);

/** Starts on the known release, so the prerendered page has direct links. The API only swaps in a newer one. Never throws. */
export function useRelease(): ReleaseState {
  const [state, setState] = useState<ReleaseState>(KNOWN_STATE);
  useEffect(() => {
    const controller = new AbortController();
    loadRelease(controller.signal)
      .then((data) => {
        if (!data || controller.signal.aborted) return;
        const next = toState(data.tag, data.date, data.assets);
        if (next.natter.mac && next.natter.windows) setState(next);
      })
      .catch(() => {
        /* keep the known release */
      });
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
