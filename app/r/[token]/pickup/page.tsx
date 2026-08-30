import { notFound, redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { PreRentalCheckForm } from "./PreRentalCheckForm";

export default async function PickupPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createServiceRoleClient();

  const { data: booking } = await supabase.from("bookings").select("status").eq("secure_token", token).maybeSingle();
  if (!booking) notFound();
  if (booking.status !== "READY_FOR_PICKUP") redirect(`/r/${token}`);

  return <PreRentalCheckForm token={token} />;
}
