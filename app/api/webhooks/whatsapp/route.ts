import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";

/**
 * WhatsApp's callbacks (set in Meta's WhatsApp > Configuration):
 * GET answers Meta's one-time check of this address with the verify token; POST brings what happened to each message we sent (sent,
 * delivered, read, failed), signed with the app secret, which is checked before anything is read.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (expected && url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === expected) {
    return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

const STATUS_MAP: Record<string, "SENT" | "DELIVERED" | "READ" | "FAILED"> = { sent: "SENT", delivered: "DELIVERED", read: "READ", failed: "FAILED" };
const RANK = { PENDING: 0, SENT: 1, DELIVERED: 2, READ: 3, FAILED: 9, DRY_RUN: 0 } as const;

export async function POST(req: Request) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const raw = await req.text();
  const given = (req.headers.get("x-hub-signature-256") ?? "").replace(/^sha256=/, "");
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  if (given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) return NextResponse.json({ error: "Bad signature" }, { status: 401 });

  let payload: { entry?: { changes?: { value?: { statuses?: { id: string; status: string; errors?: { title?: string; message?: string }[] }[] } }[] }[] };
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad body" }, { status: 400 });
  }
  const supabase = createServiceRoleClient();
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const s of change.value?.statuses ?? []) {
        const status = STATUS_MAP[s.status];
        if (!status) continue;
        const { data: row } = await supabase.from("wa_messages").select("id,status").eq("provider_message_id", s.id).maybeSingle();
        if (!row) continue;
        // Callbacks can arrive out of order: never step back from read to delivered.
        if (status !== "FAILED" && (RANK[row.status as keyof typeof RANK] ?? 0) >= RANK[status]) continue;
        const error = status === "FAILED" ? (s.errors?.[0]?.message ?? s.errors?.[0]?.title ?? "WhatsApp could not deliver it.").slice(0, 500) : null;
        await supabase.from("wa_messages").update({ status, error, updated_at: new Date().toISOString() }).eq("id", row.id);
      }
    }
  }
  return NextResponse.json({ ok: true });
}
