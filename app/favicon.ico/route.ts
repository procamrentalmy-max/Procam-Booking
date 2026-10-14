import { BRAND_ICON_HEADERS, brandIconPng } from "@/lib/brandIcon";

/** Browsers and crawlers that ask for /favicon.ico directly get the same logo icon. */
// The logo can be changed in Admin → Branding at any time, so this is made on request, never baked in at build time.
export const dynamic = "force-dynamic";

export async function GET() {
  return new Response(new Uint8Array(await brandIconPng()), { headers: BRAND_ICON_HEADERS });
}
