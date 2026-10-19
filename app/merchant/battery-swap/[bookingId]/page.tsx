import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getAuthContext } from "@/lib/auth/session";
import { canAccessShop } from "@/lib/droneRental/access";
import { modelProfile } from "@/lib/droneRental/pricingRules";
import { listChargedBatteries } from "@/lib/droneRental/batteries";
import { batteryLabel } from "@/lib/droneRental/format";
import { BatterySwapForm } from "./BatterySwapForm";

/**
 * The battery swap for one rental. `?shop=` is the shop doing the swap: a customer can swap at any shop, so it is the shop the merchant is
 * at, not necessarily the shop of the booking (that one is the default, which is what the dashboard's Swap battery button uses).
 */
export default async function BatterySwapPage({ params, searchParams }: { params: Promise<{ bookingId: string }>; searchParams: Promise<{ shop?: string }> }) {
  const { bookingId } = await params;
  const { shop: shopParam } = await searchParams;
  const supabase = createServiceRoleClient();

  const { data: booking } = await supabase.from("dr_bookings").select("id,status,drone_id,drone_model,shop_id").eq("id", bookingId).maybeSingle();
  if (!booking) notFound();
  const swapShopId = shopParam && /^[0-9a-f-]{36}$/.test(shopParam) ? shopParam : booking.shop_id;
  if (!(await canAccessShop(await getAuthContext(), swapShopId))) notFound();
  const fees = modelProfile(booking.drone_model).batteryFeeMyr;

  const { data: shops } = await supabase.from("dr_shops").select("id,name").in("id", [...new Set([swapShopId, booking.shop_id])]);
  const shopName = new Map((shops ?? []).map((s) => [s.id, s.name]));
  const elsewhere = swapShopId !== booking.shop_id;

  const { data: heldBatteries } = await supabase
    .from("dr_batteries")
    .select("id,human_id,name,shop_id")
    .eq("current_booking_id", bookingId)
    .eq("status", "WITH_CUSTOMER")
    .order("human_id");

  // Every charged battery at THIS shop that fits this drone's model, for the merchant to pick from.
  const options = booking.status === "ACTIVE" ? await listChargedBatteries(booking.drone_id, swapShopId) : [];

  // A swap the customer already paid for by QR and the merchant confirmed: the batteries just have to be handed over.
  const { data: qr } = await supabase.from("dr_qr_payments").select("id,battery_count,amount_myr,shop_id").eq("booking_id", bookingId).eq("kind", "BATTERY_SWAP_FEE").eq("status", "CONFIRMED").maybeSingle();
  const paidByQr = qr && qr.shop_id === swapShopId ? { count: qr.battery_count ?? 1, amount: Number(qr.amount_myr) } : null;

  return (
    <div className="space-y-4 pt-4">
      {elsewhere && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-center text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          This customer rented at <b>{shopName.get(booking.shop_id) ?? "another shop"}</b> and is swapping here. Their used battery stays here (all batteries are the same). They still bring the drone and the batteries they hold back
          to {shopName.get(booking.shop_id) ?? "the shop they rented from"}.
        </p>
      )}
      <p className="text-center text-sm text-zinc-500">
        The customer has {heldBatteries?.length ?? 0} {heldBatteries?.length === 1 ? "battery" : "batteries"}. Tick the ones they&apos;re handing back (one or two). You give them
        fully charged ones: RM{fees[1]} for one, RM{fees[2]} for two. The returned ones get charged at the shop.
      </p>
      {booking.status !== "ACTIVE" ? (
        <p className="text-center text-sm text-zinc-400">This booking isn&apos;t currently active.</p>
      ) : (
        <BatterySwapForm
          bookingId={booking.id}
          swapShopId={swapShopId}
          heldBatteries={(heldBatteries ?? []).map((b) => ({ id: b.id, label: batteryLabel(b) }))}
          options={options.map((b) => ({ id: b.id, label: batteryLabel(b) }))}
          batteryFees={fees}
          paidByQr={paidByQr}
        />
      )}
    </div>
  );
}
