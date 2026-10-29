import { inputClass } from "@/components/formStyles";
import { ActionForm } from "@/components/admin/ActionForm";
import { formatMyr } from "@/lib/droneRental/pricingRules";
import { formatMalaysiaTime } from "@/lib/i18n/locale";
import { REFERRAL_DAYS, REFERRER_SHARE, flyerUrl } from "@/lib/referral";
import { WALKIN_QR_ORIGIN } from "@/lib/walkInQr";
import { loadReferrerSummaries } from "@/lib/referralStats";
import { createFlyerAction, markFlyerPaidAction, setFlyerActiveAction, updateFlyerAction } from "./actions";

export const dynamic = "force-dynamic";

const Stat = ({ label, value, note }: { label: string; value: string; note?: string }) => (
  <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
    <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
    <p className="mt-0.5 text-lg font-semibold tabular-nums text-black dark:text-zinc-50">{value}</p>
    {note && <p className="text-xs text-zinc-500">{note}</p>}
  </div>
);

/**
 * Flyers: businesses that display a ProCam flyer with a QR. A phone that scans it is remembered for 7 days, and a booking or walk-in order from that phone in that
 * time is the flyer place's: the profit after costs on it is split 45% merchant, 45% ProCam and 10% to the flyer place. This page makes the QR, shows each
 * place's scans, bookings and what it is owed, and records the payouts. Each place also has a private link to see its own numbers.
 */
export default async function FlyersPage() {
  const summaries = await loadReferrerSummaries();
  const pct = Math.round(REFERRER_SHARE * 100);
  const totalOwed = summaries.reduce((sum, s) => sum + s.owed, 0);

  return (
    <div className="max-w-3xl space-y-6 pt-4 pb-10">
      <div>
        <h1 className="text-lg font-semibold">Flyers</h1>
        <p className="text-sm text-zinc-500">
          Businesses that display a ProCam flyer with a QR code. Anyone who scans it is remembered for {REFERRAL_DAYS} days (on their phone), and a booking or walk-in order they make in that time is the
          flyer place&apos;s. On those bookings the profit after costs is split 45% merchant, 45% ProCam and {pct}% flyer place, instead of 50 / 50. The scan is counted once per phone; your own scans and test runs are not counted.
        </p>
        {summaries.length > 0 && <p className="mt-2 text-sm font-medium text-black dark:text-zinc-50">Owed to flyer places right now: {formatMyr(Math.round(totalOwed * 100) / 100)}</p>}
      </div>

      <details className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800" open={summaries.length === 0}>
        <summary className="cursor-pointer text-sm font-semibold">Add a flyer place</summary>
        <ActionForm action={createFlyerAction} submitLabel="Add and make its QR" savedText="Added." resetOnSuccess className="mt-3 grid gap-2 sm:grid-cols-2">
          <input name="name" required maxLength={80} placeholder="Business name, e.g. Cafe Pantai" className={inputClass} />
          <input name="contact" maxLength={200} placeholder="Contact (phone or email, optional)" className={inputClass} />
          <input name="notes" maxLength={500} placeholder="Notes, e.g. bank details (optional)" className={`sm:col-span-2 ${inputClass}`} />
        </ActionForm>
      </details>

      {summaries.length === 0 && <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">No flyer places yet. Add one above to get its QR.</p>}

      {summaries.map((s) => {
        const r = s.referrer;
        return (
          <section key={r.id} className="space-y-4 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-black dark:text-zinc-50">
                  {r.name}
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${r.active ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"}`}>{r.active ? "Active" : "Stopped"}</span>
                </h2>
                {r.contact && <p className="text-sm text-zinc-500">{r.contact}</p>}
                {r.notes && <p className="text-sm text-zinc-500">{r.notes}</p>}
              </div>
              <ActionForm action={setFlyerActiveAction} submitLabel={r.active ? "Stop" : "Start again"} savedText="Saved." compact className="flex items-center gap-2">
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="active" value={r.active ? "false" : "true"} />
              </ActionForm>
            </div>

            <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
              <div className="space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- generated QR picture from our own route, not an optimizable asset */}
                <img src={`/go/${r.code}/qr`} alt={`QR code for ${r.name}`} className="h-40 w-40 rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-800" />
                <a href={`/go/${r.code}/qr?download=1`} className="inline-block text-sm underline underline-offset-2">
                  Download QR to print
                </a>
              </div>
              <div className="min-w-0 space-y-2 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500">The QR opens</p>
                  <p className="break-all font-mono text-xs">{flyerUrl(r.code)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500">Their private page (send them this link)</p>
                  <p className="break-all font-mono text-xs">{`${WALKIN_QR_ORIGIN}/flyer/${r.access_token}`}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Phones scanned" value={String(s.scans)} note={`${s.scansThisMonth} this month`} />
              <Stat label="Bookings" value={String(s.bookings)} note={`${s.bookingsThisMonth} this month`} />
              <Stat label="Customers paid" value={formatMyr(s.sales)} />
              <Stat label={`Earned (${pct}%)`} value={formatMyr(s.commission)} note={`${formatMyr(s.commissionThisMonth)} this month`} />
            </div>

            <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-900">
              <div className="text-sm">
                <p>
                  Paid out so far: <span className="font-semibold">{formatMyr(s.paid)}</span>
                </p>
                <p>
                  Owed now: <span className="font-semibold text-black dark:text-zinc-50">{formatMyr(s.owed)}</span>
                </p>
              </div>
              {s.owed > 0 && (
                <ActionForm action={markFlyerPaidAction} submitLabel="Mark as paid" savedText="Recorded." compact className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={r.id} />
                  <input name="amount" type="number" step="0.01" min="0.01" max={s.owed} defaultValue={s.owed.toFixed(2)} required aria-label={`Amount paid to ${r.name}`} className={`w-28 ${inputClass}`} />
                  <input name="note" maxLength={200} placeholder="Note, e.g. bank transfer" aria-label="Payment note" className={`w-44 ${inputClass}`} />
                </ActionForm>
              )}
            </div>

            {s.payouts.length > 0 && (
              <div>
                <p className="mb-1 text-xs uppercase tracking-wide text-zinc-500">Payouts</p>
                <ul className="space-y-0.5 text-sm">
                  {s.payouts.map((p) => (
                    <li key={p.id} className="flex justify-between gap-3">
                      <span className="text-zinc-500">
                        {formatMalaysiaTime(new Date(p.paid_at), "en")}
                        {p.note ? ` · ${p.note}` : ""}
                      </span>
                      <span className="tabular-nums">{formatMyr(Number(p.amount_myr))}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <details>
              <summary className="cursor-pointer text-sm text-zinc-600 dark:text-zinc-400">Change name or details</summary>
              <ActionForm action={updateFlyerAction} submitLabel="Save" savedText="Saved." className="mt-2 grid gap-2 sm:grid-cols-2">
                <input type="hidden" name="id" value={r.id} />
                <input name="name" required maxLength={80} defaultValue={r.name} aria-label="Business name" className={inputClass} />
                <input name="contact" maxLength={200} defaultValue={r.contact ?? ""} placeholder="Contact" aria-label="Contact" className={inputClass} />
                <input name="notes" maxLength={500} defaultValue={r.notes ?? ""} placeholder="Notes" aria-label="Notes" className={`sm:col-span-2 ${inputClass}`} />
              </ActionForm>
            </details>
          </section>
        );
      })}

      <p className="text-xs text-zinc-500">
        Earned is {pct}% of the profit after costs (the platform fee and card fees come off first, as on the merchants&apos; Shop income) on the paid bookings that came from the flyer: the rental, the battery swaps at the shop it was rented from and late fees. A
        cancelled or refunded booking drops out. A deposit kept for damage is not counted.
      </p>
    </div>
  );
}
