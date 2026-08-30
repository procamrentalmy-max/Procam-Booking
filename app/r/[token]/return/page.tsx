import { notFound, redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getCheckTemplates, getBookingProductId } from "@/lib/booking/checkTemplates";
import { ReturnCheckForm } from "./ReturnCheckForm";

export default async function ReturnPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createServiceRoleClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("status,rental_package_id")
    .eq("secure_token", token)
    .maybeSingle();
  if (!booking) notFound();
  if (booking.status !== "ACTIVE") redirect(`/r/${token}`);

  const productId = await getBookingProductId(booking.rental_package_id);
  const templates = productId ? await getCheckTemplates(productId, "RETURN") : [];

  return (
    <ReturnCheckForm
      token={token}
      photoSteps={templates
        .filter((t) => t.input_type === "PHOTO")
        .map((t) => ({ key: t.item_key, label: t.label, instruction: t.instruction }))}
      ackSteps={templates.filter((t) => t.input_type === "BOOLEAN").map((t) => ({ key: t.item_key, label: t.label }))}
    />
  );
}
