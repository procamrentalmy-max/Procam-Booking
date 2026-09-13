import { NextResponse } from "next/server";
import { claimPrintBatch } from "@/lib/photoPrint/printQueue";

/**
 * Polled by the local print-agent program running on the Windows PC wired
 * to the photo printer and sticker printer — this app has no way to talk
 * to that hardware directly (it runs on Vercel, the printers are on a desk
 * in Langkawi), so the agent is what actually sends jobs to the OS print
 * queue. This endpoint just claims whatever's ready (see
 * lib/photoPrint/printQueue.ts) and hands back, per job: the photo file
 * URLs to print, and the sticker fields (name, hotel, slot or "wooden
 * box", quantity, and its 1-based sequence within that hotel's batch — so
 * sticker #1 lines up with the first stack of prints, #2 with the next,
 * and so on).
 *
 * POST, not GET: claiming a batch flips SUBMITTED -> PRINTING as a side
 * effect, so this is not an idempotent read.
 */
export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.PRINT_AGENT_SECRET || auth !== `Bearer ${process.env.PRINT_AGENT_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jobs = await claimPrintBatch();
  return NextResponse.json({ jobs });
}
