import { getStore } from "../server/store";
import { extensionFor, type AllowedImageType } from "./image-validation";

/**
 * Where an uploaded dish photograph goes. SERVER ONLY.
 *
 * ── What is real today ──────────────────────────────────────────────────────
 * Uploads are kept in the same place as everything else staff change: the
 * in-memory server store. A photograph uploaded now behaves exactly like a dish
 * created now — it is live for customers immediately, and it is gone when the
 * process restarts. That is the prototype's storage model, applied honestly,
 * rather than a browser preview dressed up as a save.
 *
 * The photographs shipped with the site are a different thing and are not
 * affected: those are files in `public/menu/`, committed to the repository, and
 * they survive everything.
 *
 * ── What production needs ───────────────────────────────────────────────────
 * An object store. Implement `ImageStorageProvider` against S3, Cloudflare R2,
 * Vercel Blob, Supabase Storage or Cloudinary and return it below when its
 * credentials are present:
 *
 *   if (process.env.IMAGE_STORAGE_BUCKET) {
 *     return new S3ImageStorage(process.env.IMAGE_STORAGE_BUCKET, …);
 *   }
 *
 * The credentials are read HERE and nowhere else, from server code only. This
 * module must never be imported into a client component: the browser uploads
 * through `/api/admin/menu/image`, which keeps the secret on the server. A
 * `NEXT_PUBLIC_` key would be handed to every visitor along with the page.
 *
 * Writing into `public/` at runtime is NOT the answer, however tempting: that
 * directory is read-only on most hosts, is not shared between instances, and is
 * baked at build time — it would work on a laptop and fail on deploy.
 */

export interface StoredImage {
  /** The URL to put in `MenuItem.image.src`. */
  url: string;
  contentType: AllowedImageType;
  bytes: number;
}

export interface ImageStorageProvider {
  /** A stable name for the UI to tell staff where their upload went. */
  readonly name: string;
  /** True when what it stores outlives the server process. */
  readonly durable: boolean;
  save(input: {
    data: Uint8Array;
    contentType: AllowedImageType;
    /** Used to build a readable key; never trusted as a path. */
    hint: string;
  }): Promise<StoredImage>;
  delete?(url: string): Promise<void>;
}

/* ── The prototype's provider ─────────────────────────────────────────────── */

/**
 * Keeps the bytes beside the menu they belong to.
 *
 * Served back by `/api/menu-image/[id]`. Ids are generated here rather than
 * taken from the upload, so a filename can never become a path.
 */
class MemoryImageStorage implements ImageStorageProvider {
  readonly name = "this server's memory";
  readonly durable = false;

  async save({
    data,
    contentType,
    hint,
  }: {
    data: Uint8Array;
    contentType: AllowedImageType;
    hint: string;
  }): Promise<StoredImage> {
    const slug =
      hint
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40) || "dish";

    const id = `${slug}-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 6)}.${extensionFor(contentType)}`;

    getStore().images.set(id, { data, contentType });

    return { url: `/api/menu-image/${id}`, contentType, bytes: data.byteLength };
  }

  async delete(url: string): Promise<void> {
    const id = url.split("/").pop();
    if (id) getStore().images.delete(id);
  }
}

/* ── Selection ────────────────────────────────────────────────────────────── */

/**
 * The active store.
 *
 * Never null — an upload always goes somewhere — but `durable` tells the truth
 * about whether it will still be there tomorrow, and the admin form says so
 * out loud rather than letting staff assume.
 */
export function getImageStorageProvider(): ImageStorageProvider {
  return new MemoryImageStorage();
}

/** Whether uploads survive a restart. False until a real object store is connected. */
export function isImageStorageDurable(): boolean {
  return getImageStorageProvider().durable;
}
