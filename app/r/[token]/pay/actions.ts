"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { confirmBookingAfterPayment } from "@/lib/booking/confirm";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale, DEFAULT_LOCALE } from "@/lib/i18n/locale";

/**
 * DEV ONLY — bypasses Stripe entirely and confirms a booking exactly as if
 * the rental fee had succeeded (reuses the same confirmBookingAfterPayment
 * the real webhook calls — see app/api/webhooks/stripe/route.ts). The
 * deposit hold is a separate, later concern (placed at pickup — see
 * lib/stripe/deposit.ts) and untouched by this bypass. Delete this action
 * and its button in page.tsx before launch; real bookings must only ever
 * be confirmed by the webhook, never this.
 */
export async function devBypassPaymentAction(formData: FormData) {
  const token = z.string().min(1).parse(formData.get("token"));
  const rawLocale = formData.get("locale");
  const locale = typeof rawLocale === "string" && isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const dict = getDictionary(locale);
  const supabase = createServiceRoleClient();

  const { data: booking } = await supabase.from("bookings").select("id,status").eq("secure_token", token).single();
  if (!booking) throw new Error(dict.common.bookingNotFound);
  if (booking.status !== "PENDING_PAYMENT") throw new Error(dict.payServer.alreadyPaid);

  await confirmBookingAfterPayment(booking.id);

  redirect(`/r/${token}`);
}
