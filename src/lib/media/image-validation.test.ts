import { describe, expect, it } from "vitest";
import {
  IMAGE_RULES,
  describeImageRules,
  extensionFor,
  sniffImageType,
  validateImageBytes,
  validateImageFile,
} from "./image-validation";

/**
 * What a dish photograph has to be.
 *
 * The rule these circle is that nothing is accepted on the browser's word. A
 * file arrives claiming a type, a size and a name, and all three are things the
 * client chose to say.
 */

const header = (...bytes: number[]) => {
  const buffer = new Uint8Array(16);
  buffer.set(bytes);
  return buffer;
};
const ascii = (text: string, offset = 0) => {
  const buffer = new Uint8Array(16);
  for (let i = 0; i < text.length; i++) buffer[offset + i] = text.charCodeAt(i);
  return buffer;
};

describe("validateImageFile", () => {
  const good = { name: "burger.jpg", type: "image/jpeg", size: 400_000 };

  it("accepts a properly exported photograph", () => {
    expect(validateImageFile(good)).toBeNull();
  });

  it("accepts every format the menu can display", () => {
    for (const type of IMAGE_RULES.types) {
      expect(validateImageFile({ ...good, type }), type).toBeNull();
    }
  });

  it("refuses a file that is not an image, and says what is wanted", () => {
    const message = validateImageFile({ ...good, type: "application/pdf" });
    expect(message).toMatch(/JPEG/);
    expect(message).toMatch(/pdf/i);
  });

  it("refuses HEIC, which most browsers cannot show", () => {
    expect(validateImageFile({ ...good, type: "image/heic" })).toMatch(/can't be used/i);
  });

  it("refuses a file over the size limit, quoting both numbers", () => {
    const message = validateImageFile({ ...good, size: IMAGE_RULES.maxBytes + 1 });
    expect(message).toMatch(/5\.0 MB/);
  });

  it("accepts a file exactly on the limit", () => {
    expect(validateImageFile({ ...good, size: IMAGE_RULES.maxBytes })).toBeNull();
  });

  it("refuses an empty file", () => {
    expect(validateImageFile({ ...good, size: 0 })).toMatch(/empty/i);
  });

  it("never returns an empty message — a rejection always explains itself", () => {
    for (const bad of [
      { ...good, size: 0 },
      { ...good, type: "text/plain" },
      { ...good, size: 99_000_000 },
    ]) {
      expect(validateImageFile(bad)?.length).toBeGreaterThan(10);
    }
  });
});

describe("sniffImageType — what the file actually is", () => {
  it("recognises a JPEG", () => {
    expect(sniffImageType(header(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
  });

  it("recognises a PNG", () => {
    expect(sniffImageType(header(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe(
      "image/png",
    );
  });

  it("recognises a WebP", () => {
    const bytes = ascii("RIFF");
    bytes.set(ascii("WEBP").subarray(0, 4), 8);
    expect(sniffImageType(bytes)).toBe("image/webp");
  });

  it("recognises an AVIF", () => {
    const bytes = ascii("ftyp", 4);
    bytes.set(ascii("avif").subarray(0, 4), 8);
    expect(sniffImageType(bytes)).toBe("image/avif");
  });

  it("recognises nothing in a text file", () => {
    expect(sniffImageType(ascii("hello there"))).toBeNull();
  });

  it("recognises nothing in a Windows executable", () => {
    expect(sniffImageType(header(0x4d, 0x5a, 0x90, 0x00))).toBeNull();
  });

  it("does not read past the end of a very short file", () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8]))).toBeNull();
  });
});

describe("validateImageBytes — the server's own opinion", () => {
  it("accepts bytes that match what was claimed", () => {
    expect(validateImageBytes(header(0xff, 0xd8, 0xff), "image/jpeg")).toBeNull();
  });

  it("refuses a renamed file whose contents are not an image", () => {
    // payload.exe → dish.jpg is the whole reason this check exists.
    expect(validateImageBytes(header(0x4d, 0x5a, 0x90), "image/jpeg")).toMatch(
      /isn't a readable image/i,
    );
  });

  it("refuses a real image whose contents disagree with its claim", () => {
    const message = validateImageBytes(
      header(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
      "image/jpeg",
    );
    expect(message).toMatch(/image\/png/);
  });

  it("accepts bytes on their own when nothing was claimed", () => {
    expect(validateImageBytes(header(0xff, 0xd8, 0xff))).toBeNull();
  });
});

describe("the rules staff are shown", () => {
  it("names the formats, the size limit and the shape", () => {
    const text = describeImageRules();
    expect(text).toMatch(/JPEG/);
    expect(text).toMatch(/5 MB/);
    expect(text).toMatch(/4:3/);
    expect(text).toMatch(/1200px/);
  });

  it("stores each format under a sensible extension", () => {
    expect(extensionFor("image/jpeg")).toBe("jpg");
    expect(extensionFor("image/png")).toBe("png");
    expect(extensionFor("image/webp")).toBe("webp");
    expect(extensionFor("image/avif")).toBe("avif");
  });
});
