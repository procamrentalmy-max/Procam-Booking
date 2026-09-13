"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale, DEFAULT_LOCALE } from "@/lib/i18n/locale";

const RATEABLE_STATUSES = ["AWAITING_INSPECTION", "INSPECTION", "DAMAGE_REVIEW", "COMPLETED"];

const submitRatingSchema = z.object({
  token: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  locale: z.string().optional(),
});

/** One rating per booking, only once the customer has actually returned the equipment, and only once — a booking that's already rated can't be overwritten by resubmitting the page. */
export async function submitRatingAction(input: { token: string; rating: number; locale?: string }) {
  const parsed = submitRatingSchema.parse(input);
  const dict = getDictionary(isLocale(parsed.locale) ? parsed.locale : DEFAULT_LOCALE);
  const supabase = createServiceRoleClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("id,status,rating")
    .eq("secure_token", parsed.token)
    .maybeSingle();
  if (!booking) throw new Error(dict.common.bookingNotFound);
  if (!RATEABLE_STATUSES.includes(booking.status)) throw new Error(dict.ratingServer.notRateable);
  if (booking.rating !== null) throw new Error(dict.ratingServer.alreadyRated);

  const { error } = await supabase.from("bookings").update({ rating: parsed.rating }).eq("id", booking.id);
  if (error) throw new Error(error.message);

  revalidatePath(`/r/${parsed.token}`);
}
