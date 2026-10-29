import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { formatMyr } from "@/lib/droneRental/pricingRules";
import { formatMalaysiaTime } from "@/lib/i18n/locale";
import { REFERRAL_DAYS, REFERRER_SHARE } from "@/lib/referral";
import { loadReferrerSummaries } from "@/lib/referralStats";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your flyer numbers", robots: { index: false, follow: false } };

const Stat = ({ label, value, note }: { label: string; value: string; note?: string }) => (
  <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
    <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
    <p className="mt-0.5 text-xl font-semibold tabular-nums text-black dark:text-zinc-50">{value}</p>
    {note && <p className="text-xs text-zinc-500">{note}</p>}
  </div>
);

/**
 * A flyer place's own page, opened by the private link the admin sends it (the link is the key, so it is never listed or indexed): how many phones
 * scanned its flyer, the bookings that came from it, what it has earned, what has been paid and what is owed. No customer details are shown.
 */
export default async function FlyerOwnerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) notFound();
  const { data: referrer } = await createServiceRoleClient().from("dr_referrers").select("id").eq("access_token", token).maybeSingle();
  if (!referrer) notFound();
  const [s] = await loadReferrerSummaries({ referrerId: referrer.id });
  if (!s) notFound();
  const pct = Math.round(REFERRER_SHARE * 100);

  return (
    <div className="mx-auto max-w-md space-y-5 px-6 py-8">
      <div>
        <p className="text-xs uppercase tracking-wide text-zinc-400">ProCam Rental · Flyer partner</p>
        <h1 className="mt-1 text-2xl font-semibold text-black dark:text-zinc-50">{s.referrer.name}</h1>
        {!s.referrer.active && <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">Your flyer is stopped, so new bookings are not counted. What you already earned is still owed to you.</p>}
      </div>

      <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-5 dark:border-emerald-800 dark:bg-emerald-950">
        <p className="text-xs font-medium uppercase tracking-wide text-emerald-800 dark:text-emerald-300">Owed to you now</p>
        <p className="mt-1 text-4xl font-bold text-black dark:text-zinc-50">{formatMyr(s.owed)}</p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Earned {formatMyr(s.commission)} in all, paid to you so far {formatMyr(s.paid)}.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Phones scanned" value={String(s.scans)} note={`${s.scansThisMonth} this month`} />
        <Stat label="Bookings" value={String(s.bookings)} note={`${s.bookingsThisMonth} this month`} />
        <Stat label="Earned this month" value={formatMyr(s.commissionThisMonth)} />
        <Stat label="Customers paid" value={formatMyr(s.sales)} />
      </div>

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        You earn {pct}% of the profit on every booking made by someone who scanned your flyer&apos;s QR code in the {REFERRAL_DAYS} days before they booked. The profit is what is left after the platform fee and card fees.
      </p>

      {s.recent.length > 0 && (
        <div>
          <p className="mb-1 text-xs uppercase tracking-wide text-zinc-500">Latest bookings from your flyer</p>
          <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 text-sm dark:divide-zinc-900 dark:border-zinc-800">
            {s.recent.map((b, i) => (
              <li key={i} className="flex justify-between gap-3 px-3 py-2">
                <span className="text-zinc-500">{formatMalaysiaTime(new Date(b.start_time), "en")}</span>
                <span className="tabular-nums">
                  {formatMyr(b.commission)} <span className="text-xs text-zinc-400">of {formatMyr(b.sales)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {s.payouts.length > 0 && (
        <div>
          <p className="mb-1 text-xs uppercase tracking-wide text-zinc-500">Payments to you</p>
          <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 text-sm dark:divide-zinc-900 dark:border-zinc-800">
            {s.payouts.map((p) => (
              <li key={p.id} className="flex justify-between gap-3 px-3 py-2">
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

      <p className="text-center text-xs text-zinc-400">Questions? Ask ProCam. This page is private: only people with your link can see it.</p>
    </div>
  );
}
