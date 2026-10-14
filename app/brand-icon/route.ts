import { BRAND_ICON_HEADERS, brandIconPng } from "@/lib/brandIcon";

/** The browser tab / bookmark / home-screen icon (see lib/brandIcon.ts). */
// The logo can be changed in Admin → Branding at any time, so this is made on request, never baked in at build time.
export const dynamic = "force-dynamic";

export async function GET() {
  return new Response(new Uint8Array(await brandIconPng()), { headers: BRAND_ICON_HEADERS });
}
