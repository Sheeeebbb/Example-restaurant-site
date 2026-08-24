import { HOUSE_STYLE } from "../data/photography";

/**
 * What counts as an acceptable dish photograph.
 *
 * Pure and free of both React and Node, so the admin form can reject a file
 * before it is uploaded and the route handler can reject the same file again
 * after it arrives. The browser check is a courtesy; the server check is the
 * control, and neither is allowed to have its own opinion about the rules.
 *
 * The shoot specification is not restated here — `HOUSE_STYLE` in
 * `data/photography.ts` already owns the aspect ratio and minimum width every
 * dish photograph is briefed to, and this reads them from there.
 */

export const IMAGE_RULES = {
  /**
   * 5 MB. Comfortably more than a correctly exported 1600px JPEG needs, and
   * small enough that a phone snap straight out of the camera roll is caught
   * here rather than in the kitchen's bandwidth bill.
   */
  maxBytes: 5 * 1024 * 1024,
  /**
   * Formats a browser can display and Next can optimise. HEIC is deliberately
   * absent: an iPhone will hand one over happily and most browsers cannot show
   * it, so it is better refused with an explanation than accepted and broken.
   */
  types: ["image/jpeg", "image/png", "image/webp", "image/avif"] as const,
  aspectRatio: HOUSE_STYLE.aspectRatio,
  minimumWidth: HOUSE_STYLE.minimumWidth,
} as const;

export type AllowedImageType = (typeof IMAGE_RULES)["types"][number];

/** Human-readable, for the hint under the file input. */
export function describeImageRules(): string {
  const names = IMAGE_RULES.types
    .map((type) => type.replace("image/", "").toUpperCase())
    .join(", ");
  const mb = Math.round(IMAGE_RULES.maxBytes / (1024 * 1024));
  return `${names} · up to ${mb} MB · ${IMAGE_RULES.aspectRatio} at ${IMAGE_RULES.minimumWidth}px wide or larger`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Checks what the browser tells us about a file: its name, type and size.
 *
 * Returns the reason it cannot be used, or null. Never throws and never fails
 * quietly — a caller that ignores the return value shows nothing, which is the
 * failure mode this exists to prevent.
 */
export function validateImageFile(file: {
  name?: string;
  type?: string;
  size?: number;
}): string | null {
  if (!file.size) {
    return "That file is empty. Choose an image file.";
  }

  if (file.size > IMAGE_RULES.maxBytes) {
    return `That image is ${formatBytes(file.size)}. The limit is ${formatBytes(
      IMAGE_RULES.maxBytes,
    )} — export it smaller and try again.`;
  }

  if (!file.type || !IMAGE_RULES.types.includes(file.type as AllowedImageType)) {
    const names = IMAGE_RULES.types
      .map((type) => type.replace("image/", "").toUpperCase())
      .join(", ");
    return `${file.type || "That file"} can't be used. Upload a ${names} image.`;
  }

  return null;
}

/**
 * Reads the file's own first bytes to find out what it actually is.
 *
 * A browser's `file.type` comes from the extension and is trivially wrong —
 * rename `payload.exe` to `dish.jpg` and it arrives claiming to be a JPEG.
 * This is the "is it really an image" check, and it is the reason the server
 * does not simply believe the upload.
 */
export function sniffImageType(bytes: Uint8Array): AllowedImageType | null {
  const at = (index: number) => bytes[index];
  const ascii = (start: number, end: number) =>
    String.fromCharCode(...bytes.subarray(start, end));

  if (bytes.length < 12) return null;

  // JPEG: SOI marker.
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return "image/jpeg";

  // PNG: the eight-byte signature.
  const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (PNG.every((byte, index) => at(index) === byte)) return "image/png";

  // WebP and AVIF are both containers: RIFF….WEBP and ….ftypavif respectively.
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (ascii(4, 8) === "ftyp" && /avi[fs]/.test(ascii(8, 12))) return "image/avif";

  return null;
}

/**
 * The server's verdict on the bytes themselves.
 *
 * Rejects a file whose contents are not one of the accepted formats, and one
 * whose contents disagree with what the upload claimed — a mismatch is either
 * a broken export or someone probing, and neither should end up on the menu.
 */
export function validateImageBytes(
  bytes: Uint8Array,
  declaredType?: string,
): string | null {
  const actual = sniffImageType(bytes);

  if (!actual) {
    return "That file isn't a readable image. Check it opens, then upload it again.";
  }

  if (declaredType && declaredType !== actual) {
    return `That file is named as ${declaredType} but its contents are ${actual}. Re-export it and try again.`;
  }

  return null;
}

/** The file extension to store a given type under. */
export function extensionFor(type: AllowedImageType): string {
  return { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" }[
    type
  ];
}
