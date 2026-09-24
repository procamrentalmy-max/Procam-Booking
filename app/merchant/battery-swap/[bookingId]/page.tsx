import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { BatterySwapForm } from "./BatterySwapForm";

export default async function BatterySwapPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  const supabase = createServiceRoleClient();

  const { data: booking } = await supabase.from("dr_bookings").select("id,status,drone_id").eq("id", bookingId).maybeSingle();
  if (!booking) notFound();

  const { data: heldBatteries } = await supabase
    .from("dr_batteries")
    .select("id,human_id")
    .eq("current_booking_id", bookingId)
    .eq("status", "WITH_CUSTOMER")
    .order("human_id");

  return (
    <div className="space-y-4 pt-4">
      <p className="text-center text-sm text-zinc-500">
        The customer can hold 2 batteries at a time — pick which one they&apos;re handing back for a fresh one (RM6).
      </p>
      {booking.status !== "ACTIVE" ? (
        <p className="text-center text-sm text-zinc-400">This booking isn&apos;t currently active.</p>
      ) : (
        <BatterySwapForm bookingId={booking.id} heldBatteries={heldBatteries ?? []} />
      )}
    </div>
  );
}
