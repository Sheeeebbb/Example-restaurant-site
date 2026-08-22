import { existsSync } from "node:fs";
import path from "node:path";
import { MENU_ITEMS } from "./menu";

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

export function resolvePhoto(src: string | undefined | null): string | null {
  if (!src) return null;
  const normalized = src.startsWith("/") ? src.slice(1) : src;
  // Refuse to walk outside /public.
  if (normalized.includes("..")) return null;
  return existsSync(path.join(PUBLIC_DIR, normalized)) ? src : null;
}

/**
 * Every menu image path, resolved once.
 *
 * The cart is a client component — it reads the store — but photo resolution
 * touches the filesystem and must stay on the server. A server page computes
 * this map and hands it down, so cart lines can render real photography
 * without the client ever needing to ask whether a file exists.
 */
export function resolveMenuPhotos(): Record<string, string | null> {
  const map: Record<string, string | null> = {};
  for (const item of MENU_ITEMS) {
    map[item.image.src] = resolvePhoto(item.image.src);
  }
  return map;
}
