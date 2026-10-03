import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { BATTERY_PACKAGE_FEE_MYR } from "@/lib/droneRental/pricingRules";
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
        The customer has {heldBatteries?.length ?? 0} {heldBatteries?.length === 1 ? "battery" : "batteries"}. Tick the ones they&apos;re handing back (one or two). You give them
        fully charged ones: RM{BATTERY_PACKAGE_FEE_MYR[1]} for one, RM{BATTERY_PACKAGE_FEE_MYR[2]} for two. The returned ones get charged at the shop.
      </p>
      {booking.status !== "ACTIVE" ? (
        <p className="text-center text-sm text-zinc-400">This booking isn&apos;t currently active.</p>
      ) : (
        <BatterySwapForm bookingId={booking.id} heldBatteries={heldBatteries ?? []} />
      )}
    </div>
  );
}
