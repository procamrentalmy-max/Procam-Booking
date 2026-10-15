import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { formatMalaysiaTime, isLocale, type Locale } from "@/lib/i18n/locale";
import { formatMyr } from "@/lib/droneRental/pricingRules";
import { RETURN_GRACE_MINUTES } from "@/lib/droneRental/slots";
import { toWhatsAppNumber } from "./phone";
import { sendWhatsAppTemplate, whatsappMode } from "./send";
import type { WaKind } from "./templates";

/** The time part of "15 Oct, 10:00" for the messages that only need a time of day. */
function clockOf(date: Date, locale: Locale): string {
  return formatMalaysiaTime(date, locale).split(", ").pop() ?? "";
}

/**
 * Sends one WhatsApp message about a booking, if the customer ticked the box when they booked and WhatsApp is connected. It never throws
 * (a message must never break a booking), sends each kind at most once per booking (the unique row in wa_messages is claimed first), and
 * records what happened so the admin can see it in Admin > WhatsApp.
 */
export async function notifyBooking(bookingId: string, kind: WaKind, options: { refundMyr?: number } = {}): Promise<void> {
  try {
    if (whatsappMode() === "off") return;
    const supabase = createServiceRoleClient();
    const { data: booking } = await supabase
      .from("dr_bookings")
      .select("id,human_id,secure_token,customer_id,shop_id,start_time,end_time,whatsapp_opt_in,locale,rental_fee_myr")
      .eq("id", bookingId)
      .maybeSingle();
    if (!booking || !booking.whatsapp_opt_in) return;
    const [{ data: customer }, { data: shop }] = await Promise.all([
      supabase.from("customers").select("name,phone").eq("id", booking.customer_id).maybeSingle(),
      supabase.from("dr_shops").select("name").eq("id", booking.shop_id).maybeSingle(),
    ]);
    const to = customer ? toWhatsAppNumber(customer.phone) : null;
    if (!customer || !to) return;

    const locale: Locale = isLocale(booking.locale) ? booking.locale : "en";
    // Claim this message first: a second run (the cron, a repeated webhook) finds the row and stops.
    const { data: claimed, error: claimError } = await supabase.from("wa_messages").insert({ booking_id: bookingId, kind, to_phone: to, locale, status: "PENDING" }).select("id").maybeSingle();
    if (claimError || !claimed) return;

    const start = new Date(booking.start_time);
    const end = new Date(booking.end_time);
    const first = customer.name.trim().split(/\s+/)[0] || customer.name;
    const shopName = shop?.name ?? "";
    const variables: Record<WaKind, string[]> = {
      BOOKING_CONFIRMED: [first, booking.human_id, shopName, formatMalaysiaTime(start, locale)],
      PICKUP_REMINDER: [first, shopName, clockOf(start, locale)],
      HANDOVER_DONE: [first, clockOf(end, locale), shopName],
      RETURN_REMINDER: [first, clockOf(end, locale), shopName],
      LATE_NOTICE: [first, clockOf(end, locale), shopName],
      DEPOSIT_CONFIRM: [first, booking.human_id],
      BOOKING_CANCELLED: [first, booking.human_id, formatMyr(options.refundMyr ?? Number(booking.rental_fee_myr))],
    };
    const result = await sendWhatsAppTemplate({ to, kind, locale, variables: variables[kind], bookingToken: booking.secure_token });
    await supabase
      .from("wa_messages")
      .update(result.ok ? { status: result.dryRun ? "DRY_RUN" : "SENT", provider_message_id: result.id, updated_at: new Date().toISOString() } : { status: "FAILED", error: result.error.slice(0, 500), updated_at: new Date().toISOString() })
      .eq("id", claimed.id);
  } catch (err) {
    console.error("[whatsapp] could not send", kind, bookingId, err);
  }
}

/**
 * The messages that are sent because of the time, run from the 5-minute housekeeping job: the pickup reminder (the last hour before
 * the start), the return reminder (the last 15 minutes), the late notice (after the grace period), and the deposit nudge (a paid online
 * booking whose bank did not accept the deposit hold, 10 minutes on). Each is claimed once per booking inside notifyBooking.
 */
export async function sendDueWhatsAppMessages(now: Date = new Date()): Promise<{ checked: number }> {
  if (whatsappMode() === "off") return { checked: 0 };
  const supabase = createServiceRoleClient();
  const iso = (ms: number) => new Date(now.getTime() + ms).toISOString();
  const MIN = 60_000;
  let checked = 0;

  const run = async (kind: WaKind, ids: string[]) => {
    if (ids.length === 0) return;
    const { data: sent } = await supabase.from("wa_messages").select("booking_id").eq("kind", kind).in("booking_id", ids);
    const done = new Set((sent ?? []).map((s) => s.booking_id));
    for (const id of ids.filter((x) => !done.has(x)).slice(0, 40)) {
      checked += 1;
      await notifyBooking(id, kind);
    }
  };

  const base = () => supabase.from("dr_bookings").select("id").eq("whatsapp_opt_in", true).limit(200);
  const [pickup, ret, late, noHold] = await Promise.all([
    base().eq("status", "CONFIRMED").gt("start_time", iso(0)).lte("start_time", iso(60 * MIN)),
    base().eq("status", "ACTIVE").gt("end_time", iso(0)).lte("end_time", iso(15 * MIN)),
    base().eq("status", "ACTIVE").lt("end_time", iso(-RETURN_GRACE_MINUTES * MIN)).gt("end_time", iso(-12 * 60 * MIN)),
    base().eq("status", "CONFIRMED").eq("source", "ONLINE").lt("updated_at", iso(-10 * MIN)).gt("start_time", iso(0)),
  ]);
  await run("PICKUP_REMINDER", (pickup.data ?? []).map((b) => b.id));
  await run("RETURN_REMINDER", (ret.data ?? []).map((b) => b.id));
  await run("LATE_NOTICE", (late.data ?? []).map((b) => b.id));

  // The deposit nudge: paid by card, but no deposit hold in place.
  const candidates = (noHold.data ?? []).map((b) => b.id);
  if (candidates.length > 0) {
    const [{ data: holds }, { data: fees }] = await Promise.all([
      supabase.from("dr_deposit_authorizations").select("booking_id").eq("status", "AUTHORIZED").in("booking_id", candidates),
      supabase.from("dr_payments").select("booking_id").eq("kind", "RENTAL_FEE").eq("provider", "stripe").eq("status", "SUCCEEDED").in("booking_id", candidates),
    ]);
    const held = new Set((holds ?? []).map((h) => h.booking_id));
    const paid = new Set((fees ?? []).map((f) => f.booking_id));
    await run("DEPOSIT_CONFIRM", candidates.filter((id) => paid.has(id) && !held.has(id)));
  }
  return { checked };
}
