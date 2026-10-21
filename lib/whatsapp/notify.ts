import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { formatMalaysiaTime, isLocale, type Locale } from "@/lib/i18n/locale";
import { formatMyr } from "@/lib/droneRental/pricingRules";
import { RETURN_GRACE_MINUTES } from "@/lib/droneRental/slots";
import { chooseChannel } from "./channel";
import { sendWhatsAppTemplate, whatsappMode } from "./send";
import { sendSms, smsMode } from "@/lib/sms/send";
import { WA_APP_URL, WA_TEMPLATES, fillTemplate, type WaKind } from "./templates";

/** The time part of "15 Oct, 10:00" for the messages that only need a time of day. */
function clockOf(date: Date, locale: Locale): string {
  return formatMalaysiaTime(date, locale).split(", ").pop() ?? "";
}

/**
 * Sends one message about a booking: on WhatsApp when the customer gave a WhatsApp number, otherwise as an SMS to their phone number (and only when that
 * channel is connected). It never throws
 * (a message must never break a booking), sends each kind at most once per booking (the unique row in wa_messages is claimed first), and
 * records what happened so the admin can see it in Admin > WhatsApp.
 */
export type NotifyOptions = {
  refundMyr?: number;
  /** A message of the same kind that can repeat on a booking (each battery swap) gives each its own ref; the rest are sent once. */
  ref?: string;
  /** SWAP_DONE: how many batteries, where, what was paid and how. */
  swapCount?: number;
  swapShopId?: string;
  amountMyr?: number;
  paidBy?: "CARD" | "CASH" | "QR";
  /** DEPOSIT_DECIDED: how much of the deposit was kept. */
  keptMyr?: number;
};

const BATTERIES: Record<Locale, (n: number) => string> = {
  en: (n) => `${n} ${n === 1 ? "battery" : "batteries"}`,
  ms: (n) => `${n} bateri`,
  zh: (n) => `${n} 块电池`,
};
const PAID_BY: Record<Locale, Record<"CARD" | "CASH" | "QR", string>> = {
  en: { CARD: "card", CASH: "cash", QR: "QR" },
  ms: { CARD: "kad", CASH: "tunai", QR: "QR" },
  zh: { CARD: "银行卡", CASH: "现金", QR: "二维码" },
};

export async function notifyBooking(bookingId: string, kind: WaKind, options: NotifyOptions = {}): Promise<void> {
  try {
    if (whatsappMode() === "off" && smsMode() === "off") return;
    const supabase = createServiceRoleClient();
    const { data: booking } = await supabase
      .from("dr_bookings")
      .select("id,human_id,secure_token,customer_id,shop_id,start_time,end_time,whatsapp_opt_in,whatsapp_number,locale,rental_fee_myr,deposit_myr")
      .eq("id", bookingId)
      .maybeSingle();
    if (!booking) return;
    const [{ data: customer }, { data: shop }] = await Promise.all([
      supabase.from("customers").select("name,phone").eq("id", booking.customer_id).maybeSingle(),
      supabase.from("dr_shops").select("name").eq("id", booking.shop_id).maybeSingle(),
    ]);
    if (!customer) return;
    const route = chooseChannel({ whatsappNumber: booking.whatsapp_number, whatsappOptIn: booking.whatsapp_opt_in, phone: customer.phone });
    const to = route.to;
    if (!to) return;
    if ((route.channel === "WHATSAPP" ? whatsappMode() : smsMode()) === "off") return;

    const locale: Locale = isLocale(booking.locale) ? booking.locale : "en";
    // Claim this message first: a second run (the cron, a repeated webhook) finds the row and stops.
    const { data: claimed, error: claimError } = await supabase.from("wa_messages").insert({ booking_id: bookingId, kind, ref: options.ref ?? null, to_phone: to, locale, channel: route.channel, status: "PENDING" }).select("id").maybeSingle();
    if (claimError || !claimed) return;

    const start = new Date(booking.start_time);
    const end = new Date(booking.end_time);
    const first = customer.name.trim().split(/\s+/)[0] || customer.name;
    const shopName = shop?.name ?? "";
    // A swap can be done at another shop than the one the rental is from: the message says where it happened.
    let swapShopName = shopName;
    if (kind === "SWAP_DONE" && options.swapShopId && options.swapShopId !== booking.shop_id) {
      const { data: other } = await supabase.from("dr_shops").select("name").eq("id", options.swapShopId).maybeSingle();
      swapShopName = other?.name ?? shopName;
    }
    const deposit = Number(booking.deposit_myr);
    const kept = Math.min(options.keptMyr ?? 0, deposit);
    const variables: Record<WaKind, string[]> = {
      BOOKING_CONFIRMED: [first, booking.human_id, shopName, formatMalaysiaTime(start, locale)],
      PICKUP_REMINDER: [first, shopName, clockOf(start, locale)],
      HANDOVER_DONE: [first, clockOf(end, locale), shopName],
      RETURN_REMINDER: [first, clockOf(end, locale), shopName],
      LATE_NOTICE: [first, clockOf(end, locale), shopName],
      DEPOSIT_CONFIRM: [first, booking.human_id],
      BOOKING_CANCELLED: [first, booking.human_id, formatMyr(options.refundMyr ?? Number(booking.rental_fee_myr))],
      WALKIN_PAID: [first, formatMyr(Number(booking.rental_fee_myr)), booking.human_id, shopName],
      SWAP_DONE: [first, BATTERIES[locale](options.swapCount ?? 1), swapShopName, formatMyr(options.amountMyr ?? 0), PAID_BY[locale][options.paidBy ?? "CARD"]],
      RETURN_DONE: [first, formatMyr(deposit), shopName],
      RETURN_REVIEW: [first, shopName],
      DEPOSIT_DECIDED: [first, formatMyr(kept), formatMyr(deposit - kept)],
    };
    const template = WA_TEMPLATES[kind];
    // An SMS has no templates and no button: the same words, with the link to the booking on its own line.
    const result =
      route.channel === "WHATSAPP"
        ? await sendWhatsAppTemplate({ to, kind, locale, variables: variables[kind], bookingToken: booking.secure_token })
        : await sendSms({ to, body: `${fillTemplate(template.body[locale], variables[kind])}\n${template.button[locale]}: ${WA_APP_URL}/rent/b/${booking.secure_token}` });
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
  if (whatsappMode() === "off" && smsMode() === "off") return { checked: 0 };
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

  const base = () => supabase.from("dr_bookings").select("id").limit(200);
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
