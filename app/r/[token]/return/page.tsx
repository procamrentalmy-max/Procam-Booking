import { notFound, redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getCheckTemplates, getBookingProductId } from "@/lib/booking/checkTemplates";
import { computeLateFeeMyr } from "@/lib/booking/lateFee";
import { ReturnCheckForm } from "./ReturnCheckForm";

export default async function ReturnPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createServiceRoleClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("status,rental_package_id,end_time")
    .eq("secure_token", token)
    .maybeSingle();
  if (!booking) notFound();
  if (booking.status !== "ACTIVE") redirect(`/r/${token}`);

  const productId = await getBookingProductId(booking.rental_package_id);
  const [templates, { data: pkg }] = await Promise.all([
    productId ? getCheckTemplates(productId, "RETURN") : Promise.resolve([]),
    supabase.from("rental_packages").select("late_fee_per_hour_myr").eq("id", booking.rental_package_id).single(),
  ]);

  // Estimated as of page load, not a promise — the actual fee is fixed from
  // whenever the customer finishes submitting (see lib/booking/lateFee.ts).
  const estimatedLateFeeMyr = pkg
    ? computeLateFeeMyr(new Date(booking.end_time), new Date(), pkg.late_fee_per_hour_myr)
    : 0;

  return (
    <ReturnCheckForm
      token={token}
      estimatedLateFeeMyr={estimatedLateFeeMyr}
      photoSteps={templates
        .filter((t) => t.input_type === "PHOTO")
        .map((t) => ({ key: t.item_key, label: t.label, instruction: t.instruction }))}
      ackSteps={templates.filter((t) => t.input_type === "BOOLEAN").map((t) => ({ key: t.item_key, label: t.label }))}
    />
  );
}
