import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { generateQrPng } from "@/lib/qr";
import { walkInUrl } from "@/lib/walkInQr";

// The picture of a shop's walk-in QR (the code is already public in the QR itself). ?download=1 saves it as a file to print.
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!/^[a-f0-9]{32}$/.test(code)) return new NextResponse("Not found", { status: 404 });
  const { data: shop } = await createServiceRoleClient().from("dr_shops").select("name").eq("walkin_code", code).maybeSingle();
  if (!shop) return new NextResponse("Not found", { status: 404 });

  const png = await generateQrPng(walkInUrl(code));
  const headers: Record<string, string> = { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" };
  if (new URL(request.url).searchParams.get("download")) {
    const file = shop.name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "shop";
    headers["Content-Disposition"] = `attachment; filename="walk-in-qr-${file}.png"`;
  }
  return new NextResponse(new Uint8Array(png), { headers });
}
