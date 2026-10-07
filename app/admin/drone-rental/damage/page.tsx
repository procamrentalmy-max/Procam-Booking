import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getChecklistPhotoSignedUrl } from "@/lib/droneRental/storage";
import { formatMalaysiaTime } from "@/lib/i18n/locale";
import { controllerDepositFor, controllerProfileFor, formatMyr, includesController, modelProfile, storedController } from "@/lib/droneRental/pricingRules";
import { DamageReviewForm, type ReviewItem } from "./DamageReviewForm";

// What is waiting changes every time someone returns a drone: never cache this.
export const dynamic = "force-dynamic";

/** The Malaysian calendar day (UTC+8) a moment falls on, as 2026-10-07. */
const mytDay = (d: Date) => new Date(d.getTime() + 8 * 3_600_000).toISOString().slice(0, 10);

type Photo = { id: string; phase: string; item_key: string | null; storage_path: string };

async function signed(photos: Photo[]): Promise<{ phase: string; key: string; url: string }[]> {
  const out = await Promise.all(
    photos.map(async (p) => {
      try {
        return { phase: p.phase, key: p.item_key ?? p.id, url: await getChecklistPhotoSignedUrl(p.storage_path, 3600) };
      } catch {
        return null;
      }
    })
  );
  return out.filter((x): x is { phase: string; key: string; url: string } => x !== null);
}

function PhotoRow({ title, photos }: { title: string; photos: { key: string; url: string }[] }) {
  if (photos.length === 0) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">{title}</p>
      <div className="flex gap-2 overflow-x-auto">
        {photos.map((p) => (
          <a key={p.key} href={p.url} target="_blank" rel="noreferrer" className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from private storage */}
            <img src={p.url} alt={`${title}: ${p.key.replace(/_/g, " ")}`} className="h-36 w-auto rounded-lg border border-zinc-200 dark:border-zinc-800" />
          </a>
        ))}
      </div>
    </div>
  );
}

export default async function DamageReviewPage() {
  const supabase = createServiceRoleClient();

  const { data: pending } = await supabase
    .from("dr_bookings")
    .select("id,human_id,shop_id,drone_id,controller_id,customer_id,drone_model,controller_kind,drone_outcome,controller_outcome,actual_return_time,deposit_myr")
    .eq("damage_review", "PENDING")
    .order("actual_return_time", { ascending: false });
  const { data: doneRows } = await supabase
    .from("dr_bookings")
    .select("id,human_id,drone_id,customer_id,drone_outcome,controller_outcome,drone_charge_myr,controller_charge_myr,deposit_deduction_myr,damage_reviewed_at")
    .eq("damage_review", "DONE")
    .order("damage_reviewed_at", { ascending: false })
    .limit(10);

  const bookings = pending ?? [];
  const ids = bookings.map((b) => b.id);
  const allIds = [...new Set([...ids, ...(doneRows ?? []).map((b) => b.id)])];
  const customerIds = [...new Set([...bookings, ...(doneRows ?? [])].map((b) => b.customer_id))];
  const droneIds = [...new Set([...bookings, ...(doneRows ?? [])].map((b) => b.drone_id))];

  const [{ data: customers }, { data: drones }, { data: shops }, { data: controllers }, { data: deposits }, { data: records }, { data: photoRows }] = await Promise.all([
    customerIds.length ? supabase.from("customers").select("id,name,phone").in("id", customerIds) : Promise.resolve({ data: [] }),
    droneIds.length ? supabase.from("dr_drones").select("id,human_id").in("id", droneIds) : Promise.resolve({ data: [] }),
    supabase.from("dr_shops").select("id,name"),
    supabase.from("dr_controllers").select("id,human_id"),
    ids.length ? supabase.from("dr_deposit_authorizations").select("booking_id,status,amount_myr").in("booking_id", ids) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from("dr_checklist_records").select("booking_id,phase,notes").in("booking_id", ids).eq("phase", "RETURN") : Promise.resolve({ data: [] }),
    ids.length ? supabase.from("dr_checklist_photos").select("id,booking_id,phase,item_key,storage_path").in("booking_id", ids) : Promise.resolve({ data: [] }),
  ]);
  void allIds;

  const customerById = new Map((customers ?? []).map((c) => [c.id, c]));
  const droneById = new Map((drones ?? []).map((d) => [d.id, d.human_id]));
  const shopById = new Map((shops ?? []).map((s) => [s.id, s.name]));
  const controllerById = new Map((controllers ?? []).map((c) => [c.id, c.human_id]));
  const depositByBooking = new Map((deposits ?? []).map((d) => [d.booking_id, d]));
  const notesByBooking = new Map((records ?? []).map((r) => [r.booking_id, r.notes]));

  const today = mytDay(new Date());
  const returnedToday = bookings.filter((b) => b.actual_return_time && mytDay(new Date(b.actual_return_time)) === today);
  const earlier = bookings.filter((b) => !returnedToday.includes(b));

  const cards = await Promise.all(
    [...returnedToday, ...earlier].map(async (b) => {
      const model = modelProfile(b.drone_model);
      const controller = storedController(b.drone_model, b.controller_kind);
      const withController = includesController(b.drone_model, controller);
      const controllerName = controllerProfileFor(b.drone_model, controller);
      const items: ReviewItem[] = [
        { key: "drone", title: `Drone ${droneById.get(b.drone_id) ?? ""}`.trim(), outcome: b.drone_outcome, heldMyr: model.depositDroneMyr },
        ...(withController
          ? [
              {
                key: "controller" as const,
                title: `${controllerName?.shortName ?? "Controller"}${b.controller_id ? ` ${controllerById.get(b.controller_id) ?? ""}` : ""}`.trim(),
                outcome: b.controller_outcome,
                heldMyr: controllerDepositFor(b.drone_model, controller),
              },
            ]
          : []),
      ];
      const photos = await signed((photoRows ?? []).filter((p) => p.booking_id === b.id));
      return { b, items, photos, deposit: depositByBooking.get(b.id) };
    })
  );
  const isToday = (id: string) => returnedToday.some((b) => b.id === id);

  const Card = ({ entry }: { entry: (typeof cards)[number] }) => {
    const { b, items, photos, deposit } = entry;
    const customer = customerById.get(b.customer_id);
    const notes = notesByBooking.get(b.id);
    return (
      <div className="space-y-4 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-semibold text-black dark:text-zinc-50">
            {b.human_id} · {customer?.name ?? "—"} <span className="font-normal text-zinc-500">{customer?.phone ?? ""}</span>
          </p>
          <p className="text-sm text-zinc-500">
            {shopById.get(b.shop_id) ?? "—"} · returned {b.actual_return_time ? formatMalaysiaTime(new Date(b.actual_return_time), "en") : "—"}
          </p>
        </div>
        {notes && (
          <p className="rounded-xl bg-zinc-100 p-3 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            <span className="font-medium">Merchant&apos;s note:</span> {notes}
          </p>
        )}
        <PhotoRow title="At handover" photos={photos.filter((p) => p.phase === "PICKUP")} />
        <PhotoRow title="At return" photos={photos.filter((p) => p.phase === "RETURN")} />
        <DamageReviewForm bookingId={b.id} items={items} holdFound={deposit?.status === "AUTHORIZED"} />
      </div>
    );
  };

  return (
    <div className="max-w-2xl space-y-6 pb-12 pt-4">
      <div>
        <Link href="/admin/drone-rental" className="text-sm text-zinc-500 underline underline-offset-2">
          ← Drone Rental
        </Link>
        <h1 className="mt-2 text-lg font-semibold">Damage review</h1>
        <p className="text-sm text-zinc-500">
          Drones that came back with something damaged. Look at the photos, type the amount to keep next to each damaged item, and that exact amount is captured from the held deposit; the rest is released.
          A lost item is kept in full. An amount of 0 charges nothing.
        </p>
      </div>

      {cards.length === 0 && <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">Nothing is waiting for review.</p>}

      {returnedToday.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">Returned today · {returnedToday.length}</h2>
          {cards.filter((c) => isToday(c.b.id)).map((c) => (
            <Card key={c.b.id} entry={c} />
          ))}
        </section>
      )}

      {earlier.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">Earlier, still waiting · {earlier.length}</h2>
          <p className="text-xs text-zinc-500">A card hold only lasts about 7 days, so review these first.</p>
          {cards.filter((c) => !isToday(c.b.id)).map((c) => (
            <Card key={c.b.id} entry={c} />
          ))}
        </section>
      )}

      {(doneRows ?? []).length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">Recently reviewed</h2>
          <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-900 dark:border-zinc-800">
            {(doneRows ?? []).map((b) => (
              <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <span>
                  {b.human_id} · {customerById.get(b.customer_id)?.name ?? "—"} · drone {droneById.get(b.drone_id) ?? ""}
                </span>
                <span className="font-medium">
                  {Number(b.deposit_deduction_myr) > 0 ? `${formatMyr(Number(b.deposit_deduction_myr))} captured` : "Nothing charged"}
                  <span className="ml-2 font-normal text-zinc-500">{b.damage_reviewed_at ? formatMalaysiaTime(new Date(b.damage_reviewed_at), "en") : ""}</span>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
