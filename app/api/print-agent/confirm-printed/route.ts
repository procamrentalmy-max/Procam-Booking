import { NextResponse } from "next/server";
import { z } from "zod";
import { confirmOrdersPrinted } from "@/lib/photoPrint/printQueue";

const schema = z.object({ orderIds: z.array(z.string().uuid()).min(1) });

/**
 * The print agent calls this only once it's actually sure the photo
 * printer produced the physical print (e.g. the Windows print job
 * reported success) — this is the one and only trigger that deletes the
 * customer's originally uploaded photo(s). Never called automatically
 * just because a job was claimed (see /api/print-agent/jobs); if this
 * never fires (printer jam, agent crash), the originals are simply kept,
 * which is the safe default.
 */
export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.PRINT_AGENT_SECRET || auth !== `Bearer ${process.env.PRINT_AGENT_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });
  }

  await confirmOrdersPrinted(parsed.data.orderIds);
  return NextResponse.json({ ok: true });
}
