import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import type { DrQrPaymentRow } from "@/lib/db/types";
import { markDroneBookingPaidOffline, releaseDepositHold } from "./payment";
import { cancelLostBooking } from "./claimSlot";

/**
 * A customer paying by QR (the walk-in rental fee or a battery swap) tells the shop it is on its way. The merchant sees it on their dashboard as an
 * "Incoming QR payment" that stays until it is resolved: they check the paid screen on the customer's phone and confirm it, or say it was not received.
 */

/** Opens an incoming QR payment, unless one of this kind is already open for the booking (then that one is returned). */
export async function createQrPayment(p: { shopId: string; bookingId: string; kind: DrQrPaymentRow["kind"]; amountMyr: number; batteryCount?: 1 | 2 }): Promise<DrQrPaymentRow> {
  const supabase = createServiceRoleClient();
  const { data: open } = await supabase.from("dr_qr_payments").select("*").eq("booking_id", p.bookingId).eq("kind", p.kind).in("status", ["PENDING", "CONFIRMED"]).maybeSingle();
  if (open) return open;
  const { data, error } = await supabase
    .from("dr_qr_payments")
    .insert({ shop_id: p.shopId, booking_id: p.bookingId, kind: p.kind, amount_myr: p.amountMyr, battery_count: p.batteryCount ?? null })
    .select("*")
    .single();
  if (error || !data) throw new Error("Could not open the QR payment.");
  return data;
}

export type IncomingQrPayment = {
  id: string;
  kind: DrQrPaymentRow["kind"];
  status: "PENDING" | "CONFIRMED";
  amountMyr: number;
  batteryCount: number | null;
  customerName: string;
  bookingId: string;
  shopId: string;
  createdAt: string;
};

/**
 * The QR payments a merchant still has to deal with: the ones to check (PENDING) and the confirmed battery swaps whose batteries have not been handed
 * over yet. `shopIds` is the merchant's shops; null is the admin, who sees every shop.
 */
export async function listIncomingQrPayments(shopIds: string[] | null): Promise<IncomingQrPayment[]> {
  const supabase = createServiceRoleClient();
  let q = supabase.from("dr_qr_payments").select("*").in("status", ["PENDING", "CONFIRMED"]).order("created_at", { ascending: true });
  if (shopIds) q = q.in("shop_id", shopIds.length ? shopIds : ["00000000-0000-0000-0000-000000000000"]);
  const { data } = await q;
  // A confirmed rental is finished business: only a confirmed swap still waits for the merchant.
  const rows = (data ?? []).filter((r) => r.status === "PENDING" || r.kind === "BATTERY_SWAP_FEE");
  if (rows.length === 0) return [];
  const { data: bookings } = await supabase.from("dr_bookings").select("id,customer_id").in("id", rows.map((r) => r.booking_id));
  const customerIds = [...new Set((bookings ?? []).map((b) => b.customer_id))];
  const { data: customers } = customerIds.length ? await supabase.from("customers").select("id,name").in("id", customerIds) : { data: [] as { id: string; name: string }[] };
  const customerByBooking = new Map((bookings ?? []).map((b) => [b.id, (customers ?? []).find((c) => c.id === b.customer_id)?.name ?? "A customer"]));
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    status: r.status as "PENDING" | "CONFIRMED",
    amountMyr: Number(r.amount_myr),
    batteryCount: r.battery_count,
    customerName: customerByBooking.get(r.booking_id) ?? "A customer",
    bookingId: r.booking_id,
    shopId: r.shop_id,
    createdAt: r.created_at,
  }));
}

export async function getQrPayment(id: string): Promise<DrQrPaymentRow | null> {
  const { data } = await createServiceRoleClient().from("dr_qr_payments").select("*").eq("id", id).maybeSingle();
  return data ?? null;
}

/**
 * The merchant has seen the customer's paid screen. A walk-in rental is then paid, exactly like cash (the drone is claimed and the booking is confirmed,
 * ready for handover); a battery swap is marked paid and waits for the batteries to be handed over.
 */
export async function confirmQrPayment(id: string, staffId: string): Promise<DrQrPaymentRow> {
  const supabase = createServiceRoleClient();
  const payment = await getQrPayment(id);
  if (!payment) throw new Error("That QR payment was not found.");
  if (payment.status !== "PENDING") throw new Error("That QR payment has already been dealt with.");
  if (payment.kind === "RENTAL_FEE") await markDroneBookingPaidOffline(payment.booking_id, "QR");
  const { data: updated, error } = await supabase
    .from("dr_qr_payments")
    .update({ status: "CONFIRMED", resolved_at: new Date().toISOString(), resolved_by_staff_id: staffId })
    .eq("id", id)
    .eq("status", "PENDING")
    .select("*")
    .single();
  if (error || !updated) throw new Error("Could not confirm the payment. Try again.");
  return updated;
}

/**
 * The merchant did not receive it. A swap simply goes back to how it was. A walk-in rental is cancelled: the order closes and the deposit hold that was
 * placed on the customer's card is released, so nothing stays held for an order that will not happen.
 */
export async function cancelQrPayment(id: string, staffId: string): Promise<DrQrPaymentRow> {
  const supabase = createServiceRoleClient();
  const payment = await getQrPayment(id);
  if (!payment) throw new Error("That QR payment was not found.");
  if (payment.status !== "PENDING") throw new Error("That QR payment has already been dealt with.");
  if (payment.kind === "RENTAL_FEE") {
    await cancelLostBooking(payment.booking_id);
    await releaseDepositHold(payment.booking_id);
    await supabase.from("dr_walkin_requests").update({ status: "CANCELLED" }).eq("booking_id", payment.booking_id);
  }
  const { data: updated, error } = await supabase
    .from("dr_qr_payments")
    .update({ status: "CANCELLED", resolved_at: new Date().toISOString(), resolved_by_staff_id: staffId })
    .eq("id", id)
    .eq("status", "PENDING")
    .select("*")
    .single();
  if (error || !updated) throw new Error("Could not update the payment. Try again.");
  return updated;
}

/** A confirmed swap payment that is now being used by the swap itself: it must be for this booking, this shop and this many batteries. */
export async function useQrSwapPayment(p: { bookingId: string; shopId: string; batteryCount: number }): Promise<void> {
  const supabase = createServiceRoleClient();
  const { data: payment } = await supabase
    .from("dr_qr_payments")
    .select("*")
    .eq("booking_id", p.bookingId)
    .eq("kind", "BATTERY_SWAP_FEE")
    .eq("status", "CONFIRMED")
    .maybeSingle();
  if (!payment) throw new Error("There is no confirmed QR payment for this swap. Confirm the customer's QR payment first.");
  if (payment.shop_id !== p.shopId) throw new Error("That QR payment was made for a different shop.");
  if (payment.battery_count !== p.batteryCount) throw new Error(`The customer paid by QR for ${payment.battery_count} ${payment.battery_count === 1 ? "battery" : "batteries"}. Swap that many.`);
  const { error } = await supabase.from("dr_qr_payments").update({ status: "USED" }).eq("id", payment.id).eq("status", "CONFIRMED");
  if (error) throw new Error("Could not use the QR payment. Try again.");
}

/** The walk-in rental's open QR payment, confirmed (used by the button on the walk-in page); a rental from before QR payments were tracked is just marked paid. */
export async function confirmQrRentalForBooking(bookingId: string, staffId: string): Promise<void> {
  const { data: open } = await createServiceRoleClient().from("dr_qr_payments").select("id").eq("booking_id", bookingId).eq("kind", "RENTAL_FEE").eq("status", "PENDING").maybeSingle();
  if (open) {
    await confirmQrPayment(open.id, staffId);
    return;
  }
  await markDroneBookingPaidOffline(bookingId, "QR");
}
