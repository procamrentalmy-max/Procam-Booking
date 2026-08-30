import { notFound, redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { ReturnCheckForm } from "./ReturnCheckForm";

export default async function ReturnPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createServiceRoleClient();

  const { data: booking } = await supabase.from("bookings").select("status").eq("secure_token", token).maybeSingle();
  if (!booking) notFound();
  if (booking.status !== "ACTIVE") redirect(`/r/${token}`);

  return <ReturnCheckForm token={token} />;
}
