import { existsSync } from "node:fs";
import path from "node:path";
import { MENU_ITEMS } from "./menu";
import type { MenuItem } from "../types";

/**
 * Resolves a menu image path to a real file, or null.
 *
 * SERVER ONLY — it touches the filesystem, so it must be called from a server
 * component and the result passed down as a prop.
 *
 * The point is that a missing photo is never a broken image. Drop
 * `urban-classic.jpg` into `public/menu/` and that card starts rendering an
 * optimised photo on the next build, with no code change and no manifest to
 * update. Until then the card renders a designed placeholder instead.
 */
const PUBLIC_DIR = path.join(process.cwd(), "public");
/** Where the photographs shipped with the site live. */
const PHOTO_DIR = "/menu";

export function resolvePhoto(src: string | undefined | null): string | null {
  if (!src) return null;
  // Refuse to walk outside /public, and refuse anything that is not a
  // same-origin path — a remote URL would need `images.remotePatterns` and
  // throws at render time without it, so it is turned into a fallback tile
  // rather than a crash.
  if (src.includes("..") || !src.startsWith("/")) return null;

  /*
   * Photographs staff uploaded are served by a route handler, not by a file in
   * `public/`, so there is nothing on disk to look for. Anything outside the
   * static photograph folder is passed through for the browser to fetch.
   */
  if (!src.startsWith(`${PHOTO_DIR}/`)) return src;

  return existsSync(path.join(PUBLIC_DIR, src.slice(1))) ? src : null;
}

/**
 * Every menu image path, resolved once.
 *
 * The cart is a client component — it reads the store — but photo resolution
 * touches the filesystem and must stay on the server. A server page computes
 * this map and hands it down, so cart lines can render real photography
 * without the client ever needing to ask whether a file exists.
 *
 * Pass the LIVE menu, not the seed module: a dish whose photograph staff have
 * replaced has a different `image.src` now, and a map built from the factory
 * defaults would have no entry for it.
 */
export function resolveMenuPhotos(
  items: readonly MenuItem[] = MENU_ITEMS,
): Record<string, string | null> {
  const map: Record<string, string | null> = {};
  for (const item of items) {
    map[item.image.src] = resolvePhoto(item.image.src);
  }
  return map;
}
