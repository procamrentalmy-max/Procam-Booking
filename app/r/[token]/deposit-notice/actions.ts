"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { logFunnelEvent } from "@/lib/funnel";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale, DEFAULT_LOCALE } from "@/lib/i18n/locale";

/**
 * The checkbox above this form's submit button is HTML-required, so a
 * normal browser never gets here without it checked — this is just the
 * server-side backstop for a crafted request.
 */
export async function acknowledgeDepositNoticeAction(formData: FormData) {
  const token = z.string().min(1).parse(formData.get("token"));
  const rawLocale = formData.get("locale");
  const locale = typeof rawLocale === "string" && isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const dict = getDictionary(locale);

  if (formData.get("ack") !== "true") throw new Error(dict.depositNoticeServer.ackRequired);

  const supabase = createServiceRoleClient();
  const { data: booking } = await supabase
    .from("bookings")
    .select("status,partner_id")
    .eq("secure_token", token)
    .maybeSingle();
  if (!booking) throw new Error(dict.common.bookingNotFound);
  if (booking.status !== "PENDING_PAYMENT") redirect(`/r/${token}`);

  await logFunnelEvent("DEPOSIT_NOTICE_ACKNOWLEDGED", booking.partner_id);

  redirect(`/r/${token}/pay`);
}
