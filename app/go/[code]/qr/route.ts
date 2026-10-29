import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { generateQrPng } from "@/lib/qr";
import { flyerUrl, isFlyerCode } from "@/lib/referral";

// The picture of a flyer place's QR (the code is already public in the QR itself). ?download=1 saves it as a file to print on the flyer.
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!isFlyerCode(code)) return new NextResponse("Not found", { status: 404 });
  const { data: referrer } = await createServiceRoleClient().from("dr_referrers").select("name").eq("code", code).maybeSingle();
  if (!referrer) return new NextResponse("Not found", { status: 404 });

  const png = await generateQrPng(flyerUrl(code));
  const headers: Record<string, string> = { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" };
  if (new URL(request.url).searchParams.get("download")) {
    const file = referrer.name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "flyer";
    headers["Content-Disposition"] = `attachment; filename="flyer-qr-${file}.png"`;
  }
  return new NextResponse(new Uint8Array(png), { headers });
}
