"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { uuidSchema } from "@/lib/zod-helpers";
import { getAuthContext, isAdmin } from "@/lib/auth/session";
import { reviewDroneDamage } from "@/lib/droneRental/damageReview";

const amount = z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : v), z.coerce.number().min(0, "An amount can't be negative.").optional());

const schema = z.object({ bookingId: uuidSchema, droneAmount: amount, controllerAmount: amount });

export type ReviewResult = { ok: true; capturedMyr: number; holdFound: boolean } | { ok: false; message: string };

/** The admin's decision for one booking: the amount to keep for each damaged item. That exact total is captured from the held deposit. */
export async function reviewDamageAction(formData: FormData): Promise<ReviewResult> {
  const ctx = await getAuthContext();
  if (!isAdmin(ctx)) return { ok: false, message: "Not authorized." };

  const parsed = schema.safeParse({
    bookingId: formData.get("bookingId"),
    droneAmount: formData.get("droneAmount"),
    controllerAmount: formData.get("controllerAmount"),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the amounts." };

  try {
    const { capturedMyr, holdFound } = await reviewDroneDamage({
      bookingId: parsed.data.bookingId,
      droneAmountMyr: parsed.data.droneAmount,
      controllerAmountMyr: parsed.data.controllerAmount,
      reviewedByStaffId: ctx.staffId,
    });
    revalidatePath("/admin/drone-rental/damage");
    revalidatePath("/admin/drone-rental");
    return { ok: true, capturedMyr, holdFound };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Something went wrong." };
  }
}
