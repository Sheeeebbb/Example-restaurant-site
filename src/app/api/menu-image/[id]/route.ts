import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as t from "@/lib/db/schema";

/**
 * Serves a photograph staff uploaded.
 *
 * Public on purpose: these are the pictures on the customer menu. The id is a
 * primary key, never a path — a filename from an upload cannot reach the
 * filesystem through here, whatever it is called.
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

  let image: { data: Buffer; contentType: string } | undefined;
  try {
    const rows = await getDb()
      .select({ data: t.menuImages.data, contentType: t.menuImages.contentType })
      .from(t.menuImages)
      .where(eq(t.menuImages.id, id));
    image = rows[0];
  } catch (error) {
    /*
     * A database that is down is a 503, not a 404: telling the browser the
     * photograph does not exist would cache that answer for a year under the
     * header below, and the picture would stay missing long after the outage.
     */
    console.error("[menu-image] lookup failed:", error);
    return new NextResponse("Temporarily unavailable", { status: 503 });
  }

  if (!image) {
    // 404 rather than a placeholder: `resolvePhoto` cannot check this, so a
    // dish pointing at an upload that was deleted falls back to its designed
    // tile through the image element's own error path.
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
