import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MENU_ITEMS } from "./menu";
import { HERO_BRIEF, HOUSE_STYLE, PHOTO_BRIEFS } from "./photography";
import { resolvePhoto } from "./photos";

/**
 * The photographs themselves, checked as content rather than as code.
 *
 * `FoodImage` renders nothing when a photograph is missing, which is the right
 * behaviour at runtime — an empty frame beats a broken image — but it is silent,
 * so a deleted or misnamed file would ship as a blank card that nobody noticed.
 * These tests are what make that loud.
 *
 * They also hold the set together: consistent aspect ratio and a size budget are
 * two of the things that stop twenty-seven photographs from looking like
 * twenty-seven separate decisions.
 */

const PUBLIC_DIR = path.join(process.cwd(), "public");
const MAX_BYTES = 400 * 1024;

/** Width and height from a JPEG's first SOF marker. */
function jpegSize(file: string): { width: number; height: number } | null {
  const buf = readFileSync(file);
  if (buf.readUInt16BE(0) !== 0xffd8) return null;
  let offset = 2;
  while (offset < buf.length - 9) {
    if (buf[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = buf[offset + 1];
    // SOF0-SOF15, excluding the non-frame markers DHT/JPG/DAC.
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: buf.readUInt16BE(offset + 5), width: buf.readUInt16BE(offset + 7) };
    }
    offset += 2 + buf.readUInt16BE(offset + 2);
  }
  return null;
}

const everyPhoto = [
  ...MENU_ITEMS.map((item) => ({ label: item.name, src: item.image.src })),
  { label: "homepage hero", src: `/menu/${HERO_BRIEF.file}` },
];

describe("menu photography files", () => {
  it("has a photograph for every dish, and for the hero", () => {
    for (const { label, src } of everyPhoto) {
      expect(resolvePhoto(src), `${label} has no photograph at ${src}`).toBe(src);
    }
  });

  it("shoots every photograph to the house aspect ratio", () => {
    // 4:3 across the set is what stops `object-cover` from cropping some cards
    // tighter than others. A small tolerance covers rounding on export.
    const [w, h] = HOUSE_STYLE.aspectRatio.split(":").map(Number);
    const target = w / h;
    for (const { label, src } of everyPhoto) {
      const size = jpegSize(path.join(PUBLIC_DIR, src.slice(1)));
      expect(size, `${label} is not a readable JPEG`).not.toBeNull();
      expect(size!.width, `${label} is narrower than the house minimum`)
        .toBeGreaterThanOrEqual(HOUSE_STYLE.minimumWidth);
      expect(
        Math.abs(size!.width / size!.height - target),
        `${label} is ${size!.width}x${size!.height}, not ${HOUSE_STYLE.aspectRatio}`,
      ).toBeLessThan(0.02);
    }
  });

  it("keeps every photograph inside the page-weight budget", () => {
    for (const { label, src } of everyPhoto) {
      const bytes = statSync(path.join(PUBLIC_DIR, src.slice(1))).size;
      expect(bytes, `${label} is ${Math.round(bytes / 1024)}KB`).toBeLessThanOrEqual(MAX_BYTES);
    }
  });

  it("records where every photograph came from", () => {
    // An unsourced photograph is one nobody can re-licence, re-shoot or replace
    // with confidence, so the record is not optional once the file exists.
    for (const entry of [...PHOTO_BRIEFS, HERO_BRIEF]) {
      const file = path.join(PUBLIC_DIR, "menu", entry.file);
      if (!existsSync(file)) continue;
      expect(entry.credit, `${entry.file} is on disk with no sourcing record`).not.toBeNull();
      expect(entry.credit!.licence.length, entry.file).toBeGreaterThan(0);
    }
  });

  it("refuses to resolve a path outside public/", () => {
    expect(resolvePhoto("/../package.json")).toBeNull();
    expect(resolvePhoto("/menu/../../package.json")).toBeNull();
    expect(resolvePhoto("")).toBeNull();
    expect(resolvePhoto(null)).toBeNull();
  });
});
