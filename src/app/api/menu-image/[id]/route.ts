import { NextResponse } from "next/server";
import { getStore } from "@/lib/server/store";

/**
 * Serves a photograph staff uploaded.
 *
 * Public on purpose: these are the pictures on the customer menu. The id is a
 * lookup key in a map, never a path — a filename from an upload cannot reach
 * the filesystem through here, whatever it is called.
 *
 * The photographs shipped with the site are static files under `public/menu/`
 * and are served by Next directly; this route only knows about the ones added
 * at runtime.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const image = getStore().images.get(id);

  if (!image) {
    // 404 rather than a placeholder: `resolvePhoto` cannot check this, so a
    // dish whose upload was lost to a restart falls back to its designed tile
    // through the image element's own error path.
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(image.data as unknown as BodyInit, {
    headers: {
      "Content-Type": image.contentType,
      "Content-Length": String(image.data.byteLength),
      /*
        Ids are unique per upload and never reused, so the bytes at a given URL
        can never change — cacheable forever. Replacing a dish's photograph
        produces a new id, and the menu points at that instead.
      */
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
