import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPhotoOrderFileSignedUrl } from "@/lib/storage";
import { formatMalaysiaTime } from "@/lib/i18n/locale";
import { claimPrintBatchAction, confirmPrintedAction } from "./actions";
import type { PhotoOrderStatus } from "@/lib/db/types";

type Row = {
  id: string;
  customer_name: string;
  customer_phone: string;
  size: string;
  quantity: number;
  status: PhotoOrderStatus;
  partnerName: string;
  photoUrls: string[];
  slotNumber: number | null;
  destroyByLabel: string | null;
};

export default async function StaffPhotoOrdersPage() {
  const supabase = await createServerSupabaseClient();

  const { data: orders } = await supabase
    .from("photo_orders")
    .select("id,partner_id,customer_name,customer_phone,size,quantity,status,slot_number,destroy_by,created_at")
    .in("status", ["SUBMITTED", "PRINTING", "DELIVERED"])
    .order("created_at", { ascending: true });

  const partnerIds = [...new Set((orders ?? []).map((o) => o.partner_id))];
  const { data: partners } = partnerIds.length
    ? await supabase.from("partners").select("id,name").in("id", partnerIds)
    : { data: [] };
  const partnerNameById = new Map((partners ?? []).map((p) => [p.id, p.name]));

  const orderIds = (orders ?? []).map((o) => o.id);
  const { data: files } = orderIds.length
    ? await supabase.from("photo_order_files").select("photo_order_id,storage_path").in("photo_order_id", orderIds)
    : { data: [] };
  const pathsByOrder = new Map<string, string[]>();
  for (const f of files ?? []) {
    pathsByOrder.set(f.photo_order_id, [...(pathsByOrder.get(f.photo_order_id) ?? []), f.storage_path]);
  }

  const rows: Row[] = await Promise.all(
    (orders ?? []).map(async (o) => ({
      id: o.id,
      customer_name: o.customer_name,
      customer_phone: o.customer_phone,
      size: o.size,
      quantity: o.quantity,
      status: o.status,
      partnerName: partnerNameById.get(o.partner_id) ?? "Unknown",
      photoUrls: await Promise.all((pathsByOrder.get(o.id) ?? []).map((p) => getPhotoOrderFileSignedUrl(p, 3600))),
      slotNumber: o.slot_number,
      destroyByLabel: o.destroy_by ? formatMalaysiaTime(new Date(o.destroy_by), "en") : null,
    }))
  );

  const toPrint = rows.filter((r) => r.status === "SUBMITTED");
  const awaitingDelivery = rows.filter((r) => r.status === "PRINTING");
  const inSlots = rows.filter((r) => r.status === "DELIVERED" && r.slotNumber !== null);
  const inBox = rows.filter((r) => r.status === "DELIVERED" && r.slotNumber === null);

  return (
    <div className="space-y-6 pt-4 pb-10">
      <div>
        <h1 className="text-lg font-semibold">Photo Print Orders</h1>
        <p className="text-sm text-zinc-500">
          The print agent normally claims and prints these automatically. This page is the manual fallback — claim
          the batch to assign slot numbers, open each photo to print it by hand, then confirm printed once you're
          sure it came out (that's what deletes the original upload).
        </p>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-500">To Print ({toPrint.length})</h2>
          {toPrint.length > 0 && (
            <form action={claimPrintBatchAction}>
              <button
                type="submit"
                className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white dark:bg-white dark:text-black"
              >
                Claim Batch for Printing
              </button>
            </form>
          )}
        </div>
        {toPrint.length === 0 && <p className="text-sm text-zinc-400">Nothing here right now.</p>}
        {toPrint.map((r) => (
          <div key={r.id} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="font-medium">
              {r.customer_name} — {r.partnerName}
            </p>
            <p className="text-sm text-zinc-500">
              {r.quantity} × {r.size} — {r.customer_phone}
            </p>
          </div>
        ))}
      </section>

      <Section
        title={`Printed — Awaiting Delivery (${awaitingDelivery.length})`}
        rows={awaitingDelivery}
        showSlot
        showConfirmPrinted
      />
      <Section title={`In Slots — Awaiting Pickup (${inSlots.length})`} rows={inSlots} showSlot />
      <Section title={`In the Wooden Box (${inBox.length})`} rows={inBox} />
    </div>
  );
}

function Section({
  title,
  rows,
  showSlot = false,
  showConfirmPrinted = false,
}: {
  title: string;
  rows: Row[];
  showSlot?: boolean;
  showConfirmPrinted?: boolean;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-zinc-500">{title}</h2>
      {rows.length === 0 && <p className="text-sm text-zinc-400">Nothing here right now.</p>}
      {rows.map((r) => (
        <div key={r.id} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="font-medium">
            {r.customer_name} — {r.partnerName}
            {showSlot && (r.slotNumber !== null ? ` — Slot ${r.slotNumber}` : " — Wooden Box")}
          </p>
          <p className="text-sm text-zinc-500">
            {r.quantity} × {r.size} — {r.customer_phone}
          </p>
          {showSlot && r.destroyByLabel && (
            <p className="text-xs text-amber-700 dark:text-amber-400">Moved to wooden box if uncollected after {r.destroyByLabel}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {r.photoUrls.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noreferrer" className="text-xs underline underline-offset-2">
                Photo {i + 1}
              </a>
            ))}
          </div>
          {showConfirmPrinted && r.photoUrls.length > 0 && (
            <form action={confirmPrintedAction} className="mt-3">
              <input type="hidden" name="orderId" value={r.id} />
              <button
                type="submit"
                className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white dark:bg-white dark:text-black"
              >
                Confirm Printed (deletes original)
              </button>
            </form>
          )}
        </div>
      ))}
    </section>
  );
}
