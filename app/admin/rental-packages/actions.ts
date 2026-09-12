"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { uuidSchema } from "@/lib/zod-helpers";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const packageSchema = z.object({
  productId: uuidSchema,
  name: z.string().min(1),
  durationMinutes: z.coerce.number().int().positive(),
  priceMyr: z.coerce.number().min(0),
  depositMyr: z.coerce.number().min(0),
  lateFeePerHourMyr: z.coerce.number().min(0),
});

export async function createRentalPackageAction(formData: FormData) {
  const parsed = packageSchema.safeParse({
    productId: formData.get("productId"),
    name: formData.get("name"),
    durationMinutes: formData.get("durationMinutes"),
    priceMyr: formData.get("priceMyr"),
    depositMyr: formData.get("depositMyr"),
    lateFeePerHourMyr: formData.get("lateFeePerHourMyr"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("rental_packages").insert({
    product_id: parsed.data.productId,
    name: parsed.data.name,
    duration_minutes: parsed.data.durationMinutes,
    price_myr: parsed.data.priceMyr,
    deposit_myr: parsed.data.depositMyr,
    late_fee_per_hour_myr: parsed.data.lateFeePerHourMyr,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/rental-packages");
}

const updateSchema = packageSchema.extend({
  id: uuidSchema,
  active: z.coerce.boolean(),
});

export async function updateRentalPackageAction(formData: FormData) {
  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    productId: formData.get("productId"),
    name: formData.get("name"),
    durationMinutes: formData.get("durationMinutes"),
    priceMyr: formData.get("priceMyr"),
    depositMyr: formData.get("depositMyr"),
    lateFeePerHourMyr: formData.get("lateFeePerHourMyr"),
    active: formData.get("active") === "on",
  });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("rental_packages")
    .update({
      product_id: parsed.data.productId,
      name: parsed.data.name,
      duration_minutes: parsed.data.durationMinutes,
      price_myr: parsed.data.priceMyr,
      deposit_myr: parsed.data.depositMyr,
      late_fee_per_hour_myr: parsed.data.lateFeePerHourMyr,
      active: parsed.data.active,
    })
    .eq("id", parsed.data.id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/rental-packages");
}

const deleteSchema = z.object({ id: uuidSchema });

/**
 * Hard-deletes when nothing references this package. A package that's ever
 * been booked can't actually be deleted (bookings.rental_package_id is a
 * restricting foreign key, by design — deleting it would orphan real
 * booking history), so that case is caught and turned into a deactivation
 * instead: same visible effect everywhere (gone from the customer booking
 * flow and every admin listing), without breaking past bookings.
 */
export async function deleteRentalPackageAction(formData: FormData) {
  const parsed = deleteSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("rental_packages").delete().eq("id", parsed.data.id);

  if (error) {
    if (error.code === "23503") {
      const { error: deactivateError } = await supabase
        .from("rental_packages")
        .update({ active: false })
        .eq("id", parsed.data.id);
      if (deactivateError) throw new Error(deactivateError.message);
    } else {
      throw new Error(error.message);
    }
  }

  revalidatePath("/admin/rental-packages");
}
