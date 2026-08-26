import { NextResponse } from "next/server";
import {
  IMAGE_RULES,
  formatBytes,
  validateImageBytes,
  validateImageFile,
  type AllowedImageType,
} from "@/lib/media/image-validation";
import { getImageStorageProvider } from "@/lib/media/image-storage";
import { requirePermission } from "@/lib/staff/authorize";

/**
 * Dish photograph upload.
 *
 * Requires `menu.manage_images`. Uploading is separated from editing a dish
 * because it is the one staff action that writes a file the public will fetch,
 * and a role can reasonably be allowed to correct a price without that.
 *
 * Everything the browser said about the file is re-checked here, and then the
 * file's own first bytes are read to find out what it actually is. `file.type`
 * comes from the extension: rename anything to `.jpg` and it arrives claiming
 * to be a JPEG. Nothing is stored until the bytes agree.
 *
 * The response says where the image went and whether that place is durable, so
 * the form can tell staff the truth rather than implying a permanence the
 * prototype's storage does not have.
 */
/**
 * The multipart envelope — boundaries, headers, the field names — costs a few
 * hundred bytes on top of the file. Allowing half a megabyte of it keeps a
 * file that is legitimately just under the limit from being refused for the
 * wrapper around it.
 */
const ENVELOPE_SLACK = 512 * 1024;

export async function POST(request: Request) {
  const auth = await requirePermission("menu.manage_images");
  if (!auth.ok) return auth.response;

  /*
   * Length first, before a byte of the body is read. `formData()` refuses an
   * oversized body itself, but it refuses it as an unreadable request — which
   * told staff "that upload couldn't be read" when the truth was "that photo is
   * 12 MB". The most common upload failure deserves the accurate message.
   */
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > IMAGE_RULES.maxBytes + ENVELOPE_SLACK) {
    return NextResponse.json(
      {
        ok: false,
        error: `That image is ${formatBytes(declaredLength)}. The limit is ${formatBytes(
          IMAGE_RULES.maxBytes,
        )} — export it smaller and try again.`,
      },
      { status: 413 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: `That upload couldn't be read. If the image is larger than ${formatBytes(
          IMAGE_RULES.maxBytes,
        )}, export it smaller and try again.`,
      },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "No image was attached." },
      { status: 400 },
    );
  }

  // Name, type and size — the same check the form ran before uploading.
  const declaredProblem = validateImageFile({
    name: file.name,
    type: file.type,
    size: file.size,
  });
  if (declaredProblem) {
    return NextResponse.json({ ok: false, error: declaredProblem }, { status: 422 });
  }

  const data = new Uint8Array(await file.arrayBuffer());

  // Belt and braces: `file.size` is what the client claimed, this is what
  // actually arrived.
  if (data.byteLength > IMAGE_RULES.maxBytes) {
    return NextResponse.json(
      { ok: false, error: "That image is over the size limit." },
      { status: 413 },
    );
  }

  const bytesProblem = validateImageBytes(data, file.type);
  if (bytesProblem) {
    return NextResponse.json({ ok: false, error: bytesProblem }, { status: 422 });
  }

  const storage = getImageStorageProvider();
  const stored = await storage.save({
    data,
    contentType: file.type as AllowedImageType,
    hint: String(form.get("hint") ?? file.name),
  });

  return NextResponse.json(
    {
      ok: true,
      image: stored,
      storage: { name: storage.name, durable: storage.durable },
    },
    { status: 201 },
  );
}
