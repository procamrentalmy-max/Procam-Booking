import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ColumnChart, MarginDial, ProgressBar, RankedBars, shortMyr } from "@/components/droneRental/DroneCharts";
import {
  BATTERY_COST_MYR,
  BATTERY_WEAR_MYR_PER_USE,
  CARD_FEE_FIXED_MYR,
  CARD_FEE_PCT,
  CONTROLLER_COST_MYR,
  DAMAGE_RESERVE_PCT,
  DAY_TYPE_LABEL,
  DAY_TYPES,
  PORT_DICKSON_ARRIVALS_PER_YEAR,
  BASE_CONVERSION,
  SCENARIOS,
  TARGET_MARGIN,
  WHATSAPP_MYR_PER_MESSAGE,
  averageTicketMyr,
  cardFeeMyr,
  dayTypeOf,
  forecastByDayType,
  forecastMonthlySales,
  ymdList,
  type DayType,
} from "@/lib/droneRental/profitModel";
import { DonutChart } from "../../sales/charts";

export const dynamic = "force-dynamic";

// Drone rental only: reads the dr_* tables (and the WhatsApp message log) and nothing from the hotel-locker side.

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MYT_OFFSET_MS = 8 * 60 * 60_000;
const DAY_MS = 24 * 60 * 60_000;
const PAID_STATUSES = ["CONFIRMED", "ACTIVE", "COMPLETED"];
/** A drone has been "handed out with" its batteries once the rental is under way. */
const HANDED_OUT_STATUSES = ["ACTIVE", "COMPLETED"];

const RANGES = [
  { key: "30d", label: "Last 30 days" },
  { key: "month", label: "This month" },
  { key: "90d", label: "Last 90 days" },
  { key: "year", label: "This year" },
  { key: "all", label: "All time" },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

const myr = (n: number) => `RM${n.toLocaleString("en-MY", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const ymdOf = (ms: number) => new Date(ms + MYT_OFFSET_MS).toISOString().slice(0, 10);

function rangeStartMs(range: RangeKey, now: number): number | null {
  if (range === "all") return null;
  if (range === "30d") return now - 30 * DAY_MS;
  if (range === "90d") return now - 90 * DAY_MS;
  const shifted = new Date(now + MYT_OFFSET_MS);
  const monthStart = range === "year" ? 0 : shifted.getUTCMonth();
  return Date.UTC(shifted.getUTCFullYear(), monthStart, 1) - MYT_OFFSET_MS;
}

import { loadFlyerBookings } from "@/lib/referralStats";

export default async function DroneProfitPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { range: rangeParam } = await searchParams;
  const range: RangeKey = RANGES.some((r) => r.key === rangeParam) ? (rangeParam as RangeKey) : "year";

  const supabase = await createServerSupabaseClient();
  const [{ data: bookings }, { data: drones }, { data: swaps }, { data: lateFees }, { data: messages }, { data: batteries }, flyerBookings] = await Promise.all([
    supabase.from("dr_bookings").select("id,status,drone_id,start_time,batteries_count,rental_fee_myr,drone_charge_myr,controller_charge_myr"),
    supabase.from("dr_drones").select("id,human_id,status,cost_price_myr"),
    supabase.from("dr_battery_swaps").select("booking_id,fee_myr"),
    supabase.from("dr_payments").select("booking_id,amount_myr").eq("kind", "LATE_FEE").eq("status", "SUCCEEDED"),
    supabase.from("wa_messages").select("booking_id,status"),
    supabase.from("dr_batteries").select("id"),
    loadFlyerBookings(),
  ]);

  const now = Date.now();
  const nowYmd = ymdOf(now);
  const year = Number(nowYmd.slice(0, 4));
  const everything = (bookings ?? []).filter((b) => PAID_STATUSES.includes(b.status));
  const earliestMs = everything.length ? Math.min(...everything.map((b) => new Date(b.start_time).getTime())) : null;
  const fromMs = rangeStartMs(range, now) ?? earliestMs;

  type Extra = { swaps: number[]; late: number[]; messages: number };
  const extra = new Map<string, Extra>();
  const slot = (id: string) => {
    const e = extra.get(id) ?? { swaps: [], late: [], messages: 0 };
    extra.set(id, e);
    return e;
  };
  for (const s of swaps ?? []) slot(s.booking_id).swaps.push(Number(s.fee_myr));
  for (const p of lateFees ?? []) slot(p.booking_id).late.push(Number(p.amount_myr));
  for (const m of messages ?? []) if (m.booking_id && m.status !== "FAILED") slot(m.booking_id).messages += 1;

  /** What one paid booking brought in and what it cost, in ringgit. */
  const money = (b: (typeof everything)[number]) => {
    const e = extra.get(b.id) ?? { swaps: [], late: [], messages: 0 };
    const rental = Number(b.rental_fee_myr);
    const swapFees = e.swaps.reduce((n, x) => n + x, 0);
    const lateFees = e.late.reduce((n, x) => n + x, 0);
    const kept = Number(b.drone_charge_myr) + Number(b.controller_charge_myr);
    const sales = rental + swapFees + lateFees + kept;
    const cardFees = cardFeeMyr(rental) + e.swaps.reduce((n, x) => n + cardFeeMyr(x), 0) + e.late.reduce((n, x) => n + cardFeeMyr(x), 0);
    const uses = (HANDED_OUT_STATUSES.includes(b.status) ? Number(b.batteries_count) : 0) + e.swaps.length;
    const wear = uses * BATTERY_WEAR_MYR_PER_USE;
    const whatsapp = e.messages * WHATSAPP_MYR_PER_MESSAGE;
    // The flyer place's 10% on a booking that came from its flyer is a cost of that booking.
    const flyer = flyerBookings.get(b.id)?.commission ?? 0;
    return { sales, cardFees, wear, whatsapp, flyer, profit: sales - cardFees - wear - whatsapp - flyer, rentals: 1 };
  };

  const inRange = everything.filter((b) => fromMs === null || new Date(b.start_time).getTime() >= fromMs);
  const totals = { sales: 0, cardFees: 0, wear: 0, whatsapp: 0, flyer: 0, profit: 0 };
  const byWeekday = Array<number>(7).fill(0);
  const byMonth = { sales: Array<number>(12).fill(0), profit: Array<number>(12).fill(0) };
  const actualByType: Record<DayType, number> = { WEEKDAY: 0, HOLIDAY_WEEKDAY: 0, WEEKEND: 0, HOLIDAY_WEEKEND: 0 };
  for (const b of inRange) {
    const m = money(b);
    totals.sales += m.sales;
    totals.cardFees += m.cardFees;
    totals.wear += m.wear;
    totals.whatsapp += m.whatsapp;
    totals.flyer += m.flyer;
    totals.profit += m.profit;
    const when = new Date(new Date(b.start_time).getTime() + MYT_OFFSET_MS);
    byWeekday[when.getUTCDay()] += m.profit;
    actualByType[dayTypeOf(when.toISOString().slice(0, 10))] += m.profit;
  }
  // The year's monthly bars always cover the whole current year, whatever range is chosen above.
  for (const b of everything) {
    const when = new Date(new Date(b.start_time).getTime() + MYT_OFFSET_MS);
    if (when.getUTCFullYear() !== year) continue;
    const m = money(b);
    byMonth.sales[when.getUTCMonth()] += m.sales;
    byMonth.profit[when.getUTCMonth()] += m.profit;
  }

  const margin = totals.sales > 0 ? totals.profit / totals.sales : 0;

  // Days of each type that have gone by in the window, so "profit per day" counts quiet days too.
  const windowStartYmd = fromMs !== null ? ymdOf(fromMs) : `${year}-01-01`;
  const elapsed: Record<DayType, number> = { WEEKDAY: 0, HOLIDAY_WEEKDAY: 0, WEEKEND: 0, HOLIDAY_WEEKEND: 0 };
  for (const ymd of ymdList(Number(windowStartYmd.slice(0, 4))).concat(Number(nowYmd.slice(0, 4)) !== Number(windowStartYmd.slice(0, 4)) ? ymdList(Number(nowYmd.slice(0, 4))) : [])) {
    if (ymd >= windowStartYmd && ymd <= nowYmd) elapsed[dayTypeOf(ymd)] += 1;
  }
  const base = forecastByDayType(year, "BASE");
  const monthlyForecast = forecastMonthlySales(year, "BASE");

  // Payback: the drones' purchase prices (from the database) plus the battery and controller prices if they have been entered.
  const droneCost = (drones ?? []).reduce((n, d) => n + Number(d.cost_price_myr), 0);
  const batteryCount = (batteries ?? []).length;
  const kitCost = droneCost + (BATTERY_COST_MYR !== null ? BATTERY_COST_MYR * batteryCount : 0) + (CONTROLLER_COST_MYR ?? 0);
  const lifetimeProfit = everything.reduce((n, b) => n + money(b).profit, 0);
  const droneLife = new Map<string, number>();
  for (const b of everything) droneLife.set(b.drone_id, (droneLife.get(b.drone_id) ?? 0) + money(b).profit);

  const ticket = averageTicketMyr();
  const rangeLabel = RANGES.find((r) => r.key === range)!.label.toLowerCase();
  const costSplit = [
    { label: "Profit kept", value: Math.max(0, totals.profit) },
    { label: "Card fees", value: totals.cardFees },
    { label: "Battery wear", value: totals.wear },
    { label: "WhatsApp messages", value: totals.whatsapp },
    { label: "Flyer commission (10%)", value: totals.flyer },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-8 pt-2 pb-10">
      <div className="space-y-3">
        <p className="text-sm text-zinc-500">
          Drone rental only, no monthly or fixed costs. Profit is what customers paid ({inRange.length} paid bookings, {rangeLabel}) minus what each rental costs to take: card fees, battery wear and
          WhatsApp messages, and the flyer places' 10% on the bookings that came from a flyer. The 65% line is the goal, not a measurement.
        </p>
        <div className="flex flex-wrap gap-2">
          {RANGES.map((r) => (
            <Link
              key={r.key}
              href={`/admin/drone-rental/profit?range=${r.key}`}
              className={`inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-medium ${
                r.key === range ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black" : "border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
              }`}
            >
              {r.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card label="Sales" value={myr(totals.sales)} sub={`${inRange.length} paid bookings`} />
        <Card label="Costs" value={myr(totals.cardFees + totals.wear + totals.whatsapp)} sub="card fees, battery wear, messages" />
        <Card label="Profit" value={myr(totals.profit)} sub={inRange.length ? `${myr(totals.profit / inRange.length)} per booking` : undefined} />
        <Card label="Plan at 65%" value={myr(totals.sales * TARGET_MARGIN)} sub="what 65% of these sales would be" />
      </div>

      <div className="grid gap-6 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800 sm:grid-cols-2">
        <MarginDial value={margin} target={TARGET_MARGIN} label={`Profit margin so far (goal ${Math.round(TARGET_MARGIN * 100)}%, the tick)`} />
        <div>
          <p className="mb-2 text-sm font-medium text-black dark:text-zinc-50">Where each ringgit goes</p>
          <DonutChart data={costSplit} formatValue={myr} />
        </div>
      </div>

      <Section title={`Sales, profit and plan by month, ${year}`} note="The grey bars are the base forecast for each month (see the planning section); the green and blue bars fill in as rentals are paid.">
        <ColumnChart
          labels={MONTH_NAMES}
          series={[
            { name: "Forecast sales (base)", values: monthlyForecast },
            { name: "Sales", values: byMonth.sales },
            { name: "Profit", values: byMonth.profit },
          ]}
        />
      </Section>

      <Section title="Profit per day: weekday, weekend, holiday" note="Average profit on one day of each kind, against the plan (base forecast sales at 65%). Quiet days with no booking count as zero.">
        <ColumnChart
          labels={DAY_TYPES.map((t) => DAY_TYPE_LABEL[t])}
          series={[
            { name: "Actual per day", values: DAY_TYPES.map((t) => (elapsed[t] ? actualByType[t] / elapsed[t] : 0)) },
            { name: "Plan per day (65%)", values: DAY_TYPES.map((t) => base.find((f) => f.type === t)!.profitMyr) },
          ]}
          format={(n) => `RM${Math.round(n)}`}
        />
      </Section>

      <Section title="Profit by day of the week" note="Which days of the week earn the most (by the day the rental starts).">
        <ColumnChart labels={DAY_NAMES} series={[{ name: "Profit", values: byWeekday }]} />
      </Section>

      <Section title="Paying the kit back" note={`Drone prices come from the database. ${BATTERY_COST_MYR === null || CONTROLLER_COST_MYR === null ? "The battery and controller prices are not entered yet, so they are not counted: add them in lib/droneRental/profitModel.ts." : ""}`}>
        <div className="space-y-4">
          <ProgressBar pct={kitCost > 0 ? (lifetimeProfit / kitCost) * 100 : 0} label="All of it" sub={`${myr(lifetimeProfit)} profit earned since the start, against ${myr(kitCost)} spent`} />
          <RankedBars
            rows={(drones ?? [])
              .map((d) => ({ label: d.human_id, value: droneLife.get(d.id) ?? 0, note: `of ${myr(Number(d.cost_price_myr))}` }))
              .sort((a, b) => b.value - a.value)}
            format={shortMyr}
            emptyText="No drones yet."
          />
        </div>
      </Section>

      <Section
        title="Planning: what a month should bring"
        note={`Built from ${PORT_DICKSON_ARRIVALS_PER_YEAR.toLocaleString("en-US")} Port Dickson visitors a year, ${(BASE_CONVERSION * 100).toFixed(2)}% of them renting (base case), weekends and school holidays busier, and about 3 days in 10 too rainy. An average rental brings ${myr(ticket)}. The low and high cases halve and double the renting rate.`}
      >
        <ColumnChart
          labels={SCENARIOS.map((s) => s.label)}
          series={[
            { name: "Sales a month", values: SCENARIOS.map((s) => forecastMonthlySales(year, s.key).reduce((a, b) => a + b, 0) / 12) },
            { name: "Profit a month at 65%", values: SCENARIOS.map((s) => (forecastMonthlySales(year, s.key).reduce((a, b) => a + b, 0) / 12) * TARGET_MARGIN) },
          ]}
        />
        <Table
          columns={["Kind of day", "Days this year", "Rentals a day", "Sales a day", "Profit a day (65%)"]}
          rows={base.map((f) => [DAY_TYPE_LABEL[f.type], String(f.days), f.rentals.toFixed(1), myr(Math.round(f.salesMyr)), myr(Math.round(f.profitMyr))])}
        />
      </Section>

      <Section title="What is assumed" note="Change these in lib/droneRental/profitModel.ts and this page follows.">
        <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
          <li>
            Card fee: {CARD_FEE_PCT * 100}% + RM{CARD_FEE_FIXED_MYR} on every charge (rental, each swap, each late fee). Foreign cards cost 1% more, not counted.
          </li>
          <li>Battery wear: {myr(BATTERY_WEAR_MYR_PER_USE)} each time a battery goes out (an estimate until the real battery price is entered).</li>
          <li>WhatsApp: {myr(WHATSAPP_MYR_PER_MESSAGE)} for each message actually sent.</li>
          <li>Damage reserve in the forecast: {DAMAGE_RESERVE_PCT * 100}% of sales. Actual damage is already taken from deposits, so it is not taken off twice here.</li>
          <li>Not counted: income tax, repairs, replacing a lost or broken drone, and any money paid to shops.</li>
        </ul>
      </Section>
    </div>
  );
}

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-0.5 text-xl font-semibold text-black dark:text-zinc-50">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-black dark:text-zinc-50">{title}</h2>
        {note && <p className="text-xs text-zinc-500">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function Table({ columns, rows }: { columns: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
          <tr>
            {columns.map((c, i) => (
              <th key={c} className={`px-3 py-2 ${i === 0 ? "" : "text-right"}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[0]} className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-900">
              {r.map((cell, i) => (
                <td key={i} className={`px-3 py-2 ${i === 0 ? "font-medium" : "text-right tabular-nums"}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
