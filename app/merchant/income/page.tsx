import { getAuthContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { modelProfile } from "@/lib/droneRental/pricingRules";
import { PAID_STATUSES, monthStartMs, summariseIncome, type IncomeBooking } from "@/lib/droneRental/income";
import { COST_SHARES, PARTNER_SHARE } from "@/lib/droneRental/earnings";
import { BarChart, DonutChart } from "@/app/admin/sales/charts";

// The generated types don't know these two relationships, but the foreign keys exist, so PostgREST embeds them.
type BookingRow = Omit<IncomeBooking, "swapFeeMyr" | "lateFeeMyr" | "swapCashMyr" | "lateCashMyr"> & {
  dr_battery_swaps: { fee_myr: number | string; paid_by: string }[] | null;
  dr_payments: { amount_myr: number | string; kind: string; status: string; provider: string }[] | null;
};

const NO_SHOPS = "00000000-0000-0000-0000-000000000000";
const MONTHS_SHOWN = 6;

function myr(n: number): string {
  return `RM${n.toLocaleString("en-MY", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/** Always two decimals, so the lines of a sum line up. */
function myr2(n: number): string {
  return `RM${n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const percent = (n: number) => `${Math.round(n * 100)}%`;

export default async function ShopIncomePage() {
  const ctx = await getAuthContext();
  const supabase = await createServerSupabaseClient();

  // Same scoping as the dashboard: a merchant sees only the shop(s) they're assigned to, an admin sees every shop.
  let shopIds: string[] | null = null;
  if (ctx?.kind === "merchant") {
    const { data: assignments } = await supabase.from("dr_merchant_shops").select("shop_id").eq("staff_user_id", ctx.staffId);
    shopIds = (assignments ?? []).map((a) => a.shop_id);
  }
  const scoped = shopIds ? (shopIds.length ? shopIds : [NO_SHOPS]) : null;

  // Late-fee payments are admin-only under RLS, so this is read with the service role after the layout's merchant/admin gate
  // (same as the dashboard's customer names), still limited to the merchant's own shops.
  const db = createServiceRoleClient();
  const now = new Date().getTime();
  const bookingsQuery = db
    .from("dr_bookings")
    .select(
      "id,status,source,paid_by,start_time,batteries_count,drone_model,rental_fee_myr,drone_charge_myr,controller_charge_myr,dr_battery_swaps(fee_myr,paid_by),dr_payments(amount_myr,kind,status,provider)",
    )
    .in("status", PAID_STATUSES)
    .gte("start_time", new Date(monthStartMs(now, MONTHS_SHOWN - 1)).toISOString());
  const shopsQuery = db.from("dr_shops").select("name");
  const [{ data: rows }, { data: shops }] = await Promise.all([
    (scoped ? bookingsQuery.in("shop_id", scoped) : bookingsQuery).returns<BookingRow[]>(),
    scoped ? shopsQuery.in("id", scoped) : shopsQuery,
  ]);

  const bookings: IncomeBooking[] = (rows ?? []).map((b) => ({
    id: b.id,
    status: b.status,
    source: b.source,
    paid_by: b.paid_by,
    start_time: b.start_time,
    batteries_count: b.batteries_count,
    drone_model: b.drone_model,
    rental_fee_myr: b.rental_fee_myr,
    drone_charge_myr: b.drone_charge_myr,
    controller_charge_myr: b.controller_charge_myr,
    swapFeeMyr: (b.dr_battery_swaps ?? []).reduce((sum, s) => sum + Number(s.fee_myr), 0),
    swapCashMyr: (b.dr_battery_swaps ?? []).filter((s) => s.paid_by === "CASH").reduce((sum, s) => sum + Number(s.fee_myr), 0),
    lateFeeMyr: (b.dr_payments ?? []).filter((p) => p.kind === "LATE_FEE" && p.status === "SUCCEEDED").reduce((sum, p) => sum + Number(p.amount_myr), 0),
    lateCashMyr: (b.dr_payments ?? []).filter((p) => p.kind === "LATE_FEE" && p.status === "SUCCEEDED" && p.provider === "cash").reduce((sum, p) => sum + Number(p.amount_myr), 0),
  }));

  const s = summariseIncome(bookings, now, (key) => modelProfile(key).shortName, MONTHS_SHOWN);
  const e = s.earnings;
  const earnedChange = s.previousEarnings > 0 ? (e.partner - s.previousEarnings) / s.previousEarnings : null;
  const salesChange = s.previousMonthTotal > 0 ? (s.total - s.previousMonthTotal) / s.previousMonthTotal : null;
  const shopNames = (shops ?? []).map((x) => x.name).join(", ");

  return (
    <div className="space-y-8 pt-2 pb-10">
      <div>
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Shop income</h1>
        {shopNames && <p className="text-sm text-zinc-500">{shopNames}</p>}
      </div>

      <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-5 dark:border-emerald-800 dark:bg-emerald-950">
        <p className="text-xs font-medium uppercase tracking-wide text-emerald-800 dark:text-emerald-300">Your earnings in {s.monthLabel}</p>
        <p className="mt-1 text-4xl font-bold text-black dark:text-zinc-50">{myr2(e.partner)}</p>
        <p className="mt-2 text-sm text-emerald-900 dark:text-emerald-200">
          Your {percent(PARTNER_SHARE)} of what&apos;s left after costs, from {s.bookings} paid {s.bookings === 1 ? "booking" : "bookings"}.
        </p>
        <p className="mt-1 text-sm text-emerald-900 dark:text-emerald-200">
          Last month: {myr(s.previousEarnings)}
          {earnedChange !== null && (
            <span className={`ml-2 font-medium ${earnedChange >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-red-600 dark:text-red-400"}`}>
              {earnedChange >= 0 ? "▲" : "▼"} {Math.abs(Math.round(earnedChange * 100))}%
            </span>
          )}
        </p>
      </div>

      <Section title="How your earnings are worked out" note="Every RM a customer pays is shared like this.">
        <div className="overflow-hidden rounded-xl border border-zinc-200 text-sm dark:border-zinc-800">
          <Row label="Customers paid" value={myr2(e.income)} strong />
          <Row label={`Platform fee ${percent(COST_SHARES.platform)}`} value={`− ${myr2(e.costs.platform)}`} />
          <Row label={`Payment processing ${percent(COST_SHARES.payment)} (card only)`} value={`− ${myr2(e.costs.payment)}`} />
          <Row label={`KYC / verification ${percent(COST_SHARES.kyc)}`} value={`− ${myr2(e.costs.kyc)}`} />
          <Row label={`Insurance / protection ${percent(COST_SHARES.insurance)}`} value={`− ${myr2(e.costs.insurance)}`} />
          <Row label="Left after costs" value={myr2(e.net)} strong />
          <Row label={`ProCam ${percent(1 - PARTNER_SHARE)}`} value={myr2(e.procam)} />
          <Row label={`You ${percent(PARTNER_SHARE)}`} value={myr2(e.partner)} strong highlight />
        </div>
        {e.cashIncome > 0 && (
          <p className="text-xs text-zinc-500">{myr2(e.cashIncome)} of that was paid in cash. Cash pays no payment-processing fee, so it leaves you more.</p>
        )}
        <p className="text-xs text-zinc-400">Counted on the rental, battery swaps and late fees. A deposit kept for damage or loss pays for the repair, so it isn&apos;t shared.</p>
      </Section>

      <Section title="Your earnings, last 6 months">
        <BarChart data={s.earningsMonths} formatValue={myr} />
      </Section>

      <div className="space-y-8 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Sales in {s.monthLabel}</p>
          <p className="mt-1 text-3xl font-bold text-black dark:text-zinc-50">{myr(s.total)}</p>
          <p className="mt-2 text-sm text-zinc-500">
            What customers paid the shop, before costs
            {s.bookings > 0 && <> · {myr(s.average)} per booking on average</>}
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            Last month: {myr(s.previousMonthTotal)}
            {salesChange !== null && (
              <span className={`ml-2 font-medium ${salesChange >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                {salesChange >= 0 ? "▲" : "▼"} {Math.abs(Math.round(salesChange * 100))}%
              </span>
            )}
          </p>
        </div>

        <Section title="Sales each day this month" note="By the day the rental starts, Malaysia time. Today is dark.">
          <DailyColumns days={s.daily} today={s.today} />
        </Section>

        <Section title="Sales, last 6 months">
          <BarChart data={s.months} formatValue={myr} />
        </Section>

        <Section title="Where the sales come from" note="Rental fees include the battery choice. Deposit kept is only what was actually taken for damaged or lost items.">
          <DonutChart
            data={[
              { label: "Rental fees", value: s.breakdown.rental },
              { label: "Battery swaps", value: s.breakdown.swap },
              { label: "Late fees", value: s.breakdown.late },
              { label: "Deposit kept (damage or loss)", value: s.breakdown.kept },
            ].filter((d) => d.value > 0)}
            formatValue={myr}
          />
        </Section>

        <Section title="Best days of the week" note="Sales this month added up by weekday.">
          <BarChart data={s.weekdays} formatValue={myr} />
        </Section>

        <Section title="Online or walk-in">
          <DonutChart data={s.bySource.filter((d) => d.value > 0)} formatValue={myr} />
        </Section>

        <Section title="By drone model">
          <BarChart data={s.byModel} formatValue={myr} />
        </Section>

        <p className="text-xs text-zinc-400">A booking counts once it is paid.</p>
      </div>
    </div>
  );
}

function Row({ label, value, strong, highlight }: { label: string; value: string; strong?: boolean; highlight?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between gap-3 border-b border-zinc-100 px-3 py-2 last:border-b-0 dark:border-zinc-800 ${
        highlight ? "bg-emerald-50 dark:bg-emerald-950" : ""
      }`}
    >
      <span className={strong ? "font-semibold text-black dark:text-zinc-50" : "text-zinc-600 dark:text-zinc-400"}>{label}</span>
      <span className={`tabular-nums ${strong ? "font-semibold text-black dark:text-zinc-50" : "text-zinc-700 dark:text-zinc-300"}`}>{value}</span>
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div>
        <h2 className="text-sm font-semibold text-zinc-500">{title}</h2>
        {note && <p className="text-xs text-zinc-400">{note}</p>}
      </div>
      {children}
    </section>
  );
}

/** One column per day of the month, with the amount above the tallest day. Plain CSS, like the other charts. */
function DailyColumns({ days, today }: { days: { day: number; value: number }[]; today: number }) {
  const max = Math.max(...days.map((d) => d.value));
  if (max <= 0) return <p className="text-sm text-zinc-400">No sales yet this month.</p>;
  const best = days.find((d) => d.value === max)!;
  return (
    <div>
      <p className="mb-1 text-xs text-zinc-500">
        Best day so far: {best.day} ({myr(best.value)})
      </p>
      <div className="flex h-32 items-end gap-px">
        {days.map((d) => (
          <div key={d.day} className="flex h-full flex-1 items-end" title={`Day ${d.day}: ${myr(d.value)}`}>
            <div
              className={`w-full rounded-t-sm ${d.day === today ? "bg-black dark:bg-white" : d.day > today ? "bg-zinc-100 dark:bg-zinc-800" : "bg-zinc-400 dark:bg-zinc-500"}`}
              style={{ height: d.value > 0 ? `${Math.max(3, (d.value / max) * 100)}%` : "2px" }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-px text-[10px] text-zinc-400">
        {days.map((d) => (
          <span key={d.day} className="flex-1 text-center">
            {d.day === 1 || d.day % 5 === 0 ? d.day : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
