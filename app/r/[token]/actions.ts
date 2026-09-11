"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service";

const RATEABLE_STATUSES = ["AWAITING_INSPECTION", "INSPECTION", "DAMAGE_REVIEW", "COMPLETED"];

const submitRatingSchema = z.object({
  token: z.string().min(1),
  rating: z.number().int().min(1).max(5),
});

/** One rating per booking, only once the customer has actually returned the equipment, and only once — a booking that's already rated can't be overwritten by resubmitting the page. */
export async function submitRatingAction(input: { token: string; rating: number }) {
  const parsed = submitRatingSchema.parse(input);
  const supabase = createServiceRoleClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("id,status,rating")
    .eq("secure_token", parsed.token)
    .maybeSingle();
  if (!booking) throw new Error("Booking not found.");
  if (!RATEABLE_STATUSES.includes(booking.status)) throw new Error("This booking can't be rated yet.");
  if (booking.rating !== null) throw new Error("This booking has already been rated.");

  const { error } = await supabase.from("bookings").update({ rating: parsed.rating }).eq("id", booking.id);
  if (error) throw new Error(error.message);

  revalidatePath(`/r/${parsed.token}`);
}
