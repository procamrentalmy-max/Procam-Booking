import "server-only";
import sharp from "sharp";
import { getLogoUrl } from "@/lib/branding";

const SIZE = 256;
/** The logo sits inside a white rounded square this much smaller than the tile, so it reads on a light or a dark browser tab. */
const LOGO_BOX = 212;
const SLATE = "#334155";

/** The camera mark used when no logo has been uploaded (the same shape as components/Brand.tsx), drawn in a single colour. */
const DEFAULT_MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${LOGO_BOX}" height="${LOGO_BOX}">
  <defs><mask id="lens" maskUnits="userSpaceOnUse"><rect width="100" height="100" fill="white"/><circle cx="50" cy="58" r="21" fill="black"/><circle cx="50" cy="58" r="13" fill="white"/><circle cx="50" cy="58" r="5" fill="black"/></mask></defs>
  <rect x="14" y="34" width="72" height="46" rx="10" fill="${SLATE}" mask="url(#lens)"/>
  <polygon points="40,34 60,34 54,22 46,22" fill="${SLATE}"/>
</svg>`;

/**
 * The picture for the browser tab, the bookmark and the phone's home screen: the logo the admin uploaded in Branding (so changing the
 * logo there changes this too), centred on a white rounded square, or the default camera mark when nothing is uploaded.
 */
export async function brandIconPng(): Promise<Buffer> {
  let logo: Buffer | null = null;
  try {
    const url = await getLogoUrl();
    if (url) {
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) logo = Buffer.from(await res.arrayBuffer());
    }
  } catch {
    // Falls back to the default mark below.
  }
  const mark = await sharp(logo ?? Buffer.from(DEFAULT_MARK))
    .resize(LOGO_BOX, LOGO_BOX, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
    .catch(() => sharp(Buffer.from(DEFAULT_MARK)).png().toBuffer());
  const tile = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}"><rect width="${SIZE}" height="${SIZE}" rx="56" fill="white"/></svg>`);
  return sharp(tile).composite([{ input: mark, gravity: "centre" }]).png().toBuffer();
}

export const BRAND_ICON_HEADERS = {
  "content-type": "image/png",
  // Browsers keep favicons a long time anyway; an hour at the edge lets a new logo show up the same day.
  "cache-control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
};
