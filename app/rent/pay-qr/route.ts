import { NextResponse } from "next/server";
import { getPayQrUrl } from "@/lib/branding";

// The shop's payment QR picture from our own address, so a customer's phone can save it as a file (a picture on another address cannot be saved this way) and scan it from the gallery.
export async function GET() {
  const url = await getPayQrUrl();
  if (!url) return new NextResponse("Not found", { status: 404 });
  const upstream = await fetch(url, { cache: "no-store" });
  if (!upstream.ok) return new NextResponse("Not found", { status: 404 });
  const type = upstream.headers.get("content-type") ?? "image/png";
  const ext = type.includes("jpeg") ? "jpg" : type.includes("webp") ? "webp" : "png";
  return new NextResponse(await upstream.arrayBuffer(), {
    headers: { "Content-Type": type, "Cache-Control": "no-store", "Content-Disposition": `attachment; filename="procam-payment-qr.${ext}"` },
  });
}
