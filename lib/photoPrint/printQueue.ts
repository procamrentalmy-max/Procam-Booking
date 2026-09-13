import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { nextAvailableSlot } from "./slots";
import { deletePhotoOrderFiles, getPhotoOrderFileSignedUrl } from "@/lib/storage";

export type PrintJob = {
  orderId: string;
  partnerId: string;
  hotelName: string;
  customerName: string;
  size: string;
  quantity: number;
  /** 1-based position within this partner's batch — sticker N corresponds to the Nth stack of prints for that hotel, so a stack of loose photos can be matched back to its sticker by count. */
  sequenceInBatch: number;
  /** null means the wooden box, not a numbered slot — see nextAvailableSlot. */
  slotNumber: number | null;
  photoUrls: string[];
};

/**
 * Claims every SUBMITTED order for printing: assigns each one a slot
 * number (sweeping each partner's stale DELIVERED leftovers into the
 * wooden box first, so slots start fresh at the top for the day's first
 * job — see lib/photoPrint/slots.ts) and flips it to PRINTING. This is the
 * one place SUBMITTED -> PRINTING happens, whether triggered by the
 * automatic print agent (app/api/print-agent/jobs) or the manual staff
 * fallback (app/staff/photo-orders).
 *
 * Assumes it's called roughly once per morning per the batch-printing
 * turnaround rule (orders uploaded the previous day print together the
 * next morning) — calling it again the same morning is harmless (nothing
 * new to sweep, already-assigned slots are seen as occupied and skipped),
 * but calling it at odd times of day would sweep partners' slots earlier
 * than the promised collect-by window if same-day rush orders exist.
 *
 * Deliberately does NOT set placed_at/collect_by/destroy_by here — those
 * describe when the print physically arrives at the hotel, which is later,
 * at actual worker delivery (see app/staff/route/actions.ts). This step
 * only decides which slot number to put on the sticker.
 */
export async function claimPrintBatch(): Promise<PrintJob[]> {
  const supabase = createServiceRoleClient();

  const { data: orders } = await supabase
    .from("photo_orders")
    .select("id,partner_id,customer_name,size,quantity,created_at")
    .eq("status", "SUBMITTED")
    .order("created_at", { ascending: true });
  if (!orders || orders.length === 0) return [];

  const partnerIds = [...new Set(orders.map((o) => o.partner_id))];
  const { data: partners } = await supabase.from("partners").select("id,name").in("id", partnerIds);
  const partnerNameById = new Map((partners ?? []).map((p) => [p.id, p.name]));

  const jobs: PrintJob[] = [];

  for (const partnerId of partnerIds) {
    await supabase
      .from("photo_orders")
      .update({ slot_number: null })
      .eq("partner_id", partnerId)
      .eq("status", "DELIVERED")
      .not("slot_number", "is", null);

    const { data: stillOutRows } = await supabase
      .from("photo_orders")
      .select("slot_number")
      .eq("partner_id", partnerId)
      .in("status", ["PRINTING", "DELIVERED"])
      .not("slot_number", "is", null);
    const occupied = new Set((stillOutRows ?? []).map((r) => r.slot_number as number));

    const partnerOrders = orders.filter((o) => o.partner_id === partnerId);
    let sequence = 0;
    for (const order of partnerOrders) {
      sequence += 1;
      const slotNumber = nextAvailableSlot(occupied);
      if (slotNumber !== null) occupied.add(slotNumber);

      const { error } = await supabase
        .from("photo_orders")
        .update({ status: "PRINTING", slot_number: slotNumber })
        .eq("id", order.id)
        .eq("status", "SUBMITTED");
      if (error) throw new Error(error.message);

      const { data: files } = await supabase
        .from("photo_order_files")
        .select("storage_path")
        .eq("photo_order_id", order.id)
        .order("created_at", { ascending: true });
      const photoUrls = await Promise.all((files ?? []).map((f) => getPhotoOrderFileSignedUrl(f.storage_path, 3600)));

      jobs.push({
        orderId: order.id,
        partnerId,
        hotelName: partnerNameById.get(partnerId) ?? "Unknown",
        customerName: order.customer_name,
        size: order.size,
        quantity: order.quantity,
        sequenceInBatch: sequence,
        slotNumber,
        photoUrls,
      });
    }
  }

  return jobs;
}

/**
 * The original uploaded photos only ever get deleted here, once the print
 * agent explicitly reports the physical print actually came out — never
 * automatically just because a job was claimed (claimPrintBatch) or
 * delivered. The physical print itself becomes the sole surviving copy;
 * order/customer/slot records are untouched (deactivate-not-delete
 * applies to the order, just not to the now-redundant image bytes).
 */
export async function confirmOrdersPrinted(orderIds: string[]): Promise<void> {
  if (orderIds.length === 0) return;
  const supabase = createServiceRoleClient();

  const { data: files } = await supabase
    .from("photo_order_files")
    .select("id,photo_order_id,storage_path")
    .in("photo_order_id", orderIds);
  if (!files || files.length === 0) return;

  await deletePhotoOrderFiles(files.map((f) => f.storage_path));

  const { error } = await supabase
    .from("photo_order_files")
    .delete()
    .in(
      "id",
      files.map((f) => f.id)
    );
  if (error) throw new Error(error.message);
}
