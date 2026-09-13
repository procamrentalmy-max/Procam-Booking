import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getBookingProductId } from "@/lib/booking/checkTemplates";
import { getLocale } from "@/lib/i18n/getLocale";
import { InstructionsCarousel } from "./InstructionsCarousel";

export default async function InstructionsPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const locale = await getLocale();
  const supabase = createServiceRoleClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("rental_package_id")
    .eq("secure_token", token)
    .maybeSingle();
  if (!booking) notFound();

  const productId = await getBookingProductId(booking.rental_package_id);
  const { data: steps } = productId
    ? await supabase
        .from("product_instructions")
        .select("step_number,title,body")
        .eq("product_id", productId)
        .order("step_number", { ascending: true })
    : { data: [] };

  return <InstructionsCarousel token={token} steps={steps ?? []} locale={locale} />;
}
