/**
 * Reports photography coverage: which dishes have a real image file in
 * public/menu/, and which are still rendering the fallback tile.
 *
 * Run with `npm run photos:check`. Exits non-zero when anything is missing, so
 * it can gate a deploy once the shoot is done.
 */
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// The .ts modules are not directly importable from plain node, so the
// filenames are read out of the manifest source — a small parse, but it keeps
// this script dependency-free.
const source = await import("node:fs").then((fs) =>
  fs.readFileSync(path.join(root, "src/lib/data/photography.ts"), "utf8"),
);
const entries = [...source.matchAll(/brief\("([^"]+)",\s*"([^"]+)"/g)].map(
  ([, slug, file]) => ({ slug, file }),
);

if (entries.length === 0) {
  console.error("No photo briefs found — has photography.ts changed shape?");
  process.exit(1);
}

const missing = [];
const present = [];

for (const entry of entries) {
  const filePath = path.join(root, "public", "menu", entry.file);
  if (existsSync(filePath)) {
    present.push({ ...entry, bytes: statSync(filePath).size });
  } else {
    missing.push(entry);
  }
}

console.log(`Photography coverage: ${present.length}/${entries.length} dishes\n`);

if (present.length) {
  console.log("Present:");
  for (const p of present) {
    const kb = Math.round(p.bytes / 1024);
    const warn = kb > 400 ? "  <- over 400KB, consider re-exporting" : "";
    console.log(`  ${p.file.padEnd(30)} ${String(kb).padStart(5)}KB${warn}`);
  }
  console.log("");
}

if (missing.length) {
  console.log("Still needed (rendering the fallback tile):");
  for (const m of missing) console.log(`  ${m.file.padEnd(30)} ${m.slug}`);
  console.log(`\nDrop files into public/menu/ using exactly these names.`);
  process.exit(1);
}

console.log("Every dish has a photograph.");
