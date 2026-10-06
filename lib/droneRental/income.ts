// Shop income for the merchant's Shop income tab. Pure functions over bookings already loaded for the shop(s):
// no database access here so the month maths (done on Malaysia time, whatever the server's timezone) can be tested.

import type { DrBookingStatus, DrPaidBy } from "@/lib/db/types";
import { earningsFor, type Earnings } from "./earnings";

export const MYT_OFFSET_MS = 8 * 60 * 60_000;
const DAY_MS = 24 * 60 * 60_000;

/** A booking counts as income once it is paid. Everything after that (return, damage) is still income. */
export const PAID_STATUSES: DrBookingStatus[] = ["CONFIRMED", "ACTIVE", "COMPLETED"];

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type IncomeBooking = {
  id: string;
  status: string;
  source: string;
  paid_by: DrPaidBy;
  start_time: string;
  batteries_count: number;
  drone_model: string;
  rental_fee_myr: number | string;
  drone_charge_myr: number | string;
  controller_charge_myr: number | string;
  /** Battery swap fees and succeeded late-fee payments for this booking... */
  swapFeeMyr: number;
  lateFeeMyr: number;
  /** ...and how much of each of those was paid in cash (each payment is card or cash on its own; paid_by is the rental fee's). */
  swapCashMyr: number;
  lateCashMyr: number;
};

/** Year and month (0-11) of an instant as seen on a clock in Malaysia. */
function mytMonth(ms: number) {
  const d = new Date(ms + MYT_OFFSET_MS);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
}

/** The instant (UTC ms) the Malaysia-time month `monthsBack` months before the current one begins. */
export function monthStartMs(now: number, monthsBack = 0): number {
  const { year, month } = mytMonth(now);
  return Date.UTC(year, month - monthsBack, 1) - MYT_OFFSET_MS;
}

const NO_EARNINGS: Earnings = earningsFor(0, "CARD");

export function bookingIncome(b: IncomeBooking) {
  const rental = Number(b.rental_fee_myr);
  const kept = Number(b.drone_charge_myr) + Number(b.controller_charge_myr);
  return { rental, swap: b.swapFeeMyr, late: b.lateFeeMyr, kept, total: rental + b.swapFeeMyr + b.lateFeeMyr + kept };
}

/**
 * The merchant's earnings from one booking (see earnings.ts). The base is what the customer paid for the rental, swaps and
 * late fees; a deposit kept for damage or loss pays for the repair or the replacement, so it isn't shared.
 */
export function bookingEarnings(b: IncomeBooking): Earnings & { cashIncome: number } {
  const inc = bookingIncome(b);
  // Every payment is worked out on its own: a rental paid by card with a swap paid in cash pays the card cost on one and not the other.
  const parts: [number, DrPaidBy][] = [
    [inc.rental, b.paid_by],
    [inc.swap - b.swapCashMyr, "CARD"],
    [b.swapCashMyr, "CASH"],
    [inc.late - b.lateCashMyr, "CARD"],
    [b.lateCashMyr, "CASH"],
  ];
  let total = NO_EARNINGS;
  let cashIncome = 0;
  for (const [amount, method] of parts) {
    if (amount <= 0) continue;
    total = addEarnings(total, earningsFor(amount, method));
    if (method === "CASH") cashIncome += amount;
  }
  return { ...total, cashIncome };
}

function addEarnings(a: Earnings, b: Earnings): Earnings {
  return {
    income: a.income + b.income,
    costs: {
      platform: a.costs.platform + b.costs.platform,
      payment: a.costs.payment + b.costs.payment,
      kyc: a.costs.kyc + b.costs.kyc,
      insurance: a.costs.insurance + b.costs.insurance,
    },
    totalCosts: a.totalCosts + b.totalCosts,
    net: a.net + b.net,
    partner: a.partner + b.partner,
    procam: a.procam + b.procam,
  };
}


export type IncomeSummary = {
  monthLabel: string;
  /** The merchant's earnings this month, and what they are made of (see earnings.ts). */
  earnings: Earnings & { cashIncome: number };
  /** The merchant's earnings for the whole previous month, for the up/down comparison. */
  previousEarnings: number;
  /** The merchant's earnings per month, oldest first, ending with this month. */
  earningsMonths: { label: string; value: number }[];
  /** Sales: everything customers paid this month, including any deposit kept for damage or loss. */
  total: number;
  bookings: number;
  average: number;
  /** Total of the whole previous month, for the up/down comparison. */
  previousMonthTotal: number;
  breakdown: { rental: number; swap: number; late: number; kept: number };
  /** One entry per day of the month (1..last day), including days with no income. */
  daily: { day: number; value: number }[];
  today: number;
  weekdays: { label: string; value: number }[];
  bySource: { label: string; value: number }[];
  byModel: { label: string; value: number }[];
  /** Oldest first, ending with this month. */
  months: { label: string; value: number }[];
};

export function summariseIncome(bookings: IncomeBooking[], now: number, modelName: (key: string) => string, monthsShown = 6): IncomeSummary {
  const thisStart = monthStartMs(now);
  const nextStart = monthStartMs(now, -1);
  const prevStart = monthStartMs(now, 1);
  const { year, month } = mytMonth(now);
  const daysInMonth = Math.round((nextStart - thisStart) / DAY_MS);
  const today = new Date(now + MYT_OFFSET_MS).getUTCDate();

  const paid = bookings.filter((b) => (PAID_STATUSES as string[]).includes(b.status));
  const monthTotals = Array<number>(monthsShown).fill(0);
  const earningsTotals = Array<number>(monthsShown).fill(0);
  let earnings = NO_EARNINGS;
  let cashIncome = 0;
  let previousEarnings = 0;
  const breakdown = { rental: 0, swap: 0, late: 0, kept: 0 };
  const daily = Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1, value: 0 }));
  const weekdayTotals = Array<number>(7).fill(0);
  const source = { walkIn: 0, online: 0 };
  const model = new Map<string, number>();
  let total = 0;
  let count = 0;
  let previousMonthTotal = 0;

  for (const b of paid) {
    const start = new Date(b.start_time).getTime();
    const inc = bookingIncome(b);
    const earned = bookingEarnings(b);
    // Months back counted on the calendar, not in days, so month lengths can't push a booking into the wrong bar.
    const when = mytMonth(start);
    const back = (year - when.year) * 12 + (month - when.month);
    if (back >= 0 && back < monthsShown) {
      monthTotals[monthsShown - 1 - back] += inc.total;
      earningsTotals[monthsShown - 1 - back] += earned.partner;
    }
    if (start >= prevStart && start < thisStart) {
      previousMonthTotal += inc.total;
      previousEarnings += earned.partner;
    }

    if (start < thisStart || start >= nextStart) continue;
    count += 1;
    total += inc.total;
    earnings = addEarnings(earnings, earned);
    cashIncome += earned.cashIncome;
    breakdown.rental += inc.rental;
    breakdown.swap += inc.swap;
    breakdown.late += inc.late;
    breakdown.kept += inc.kept;
    const local = new Date(start + MYT_OFFSET_MS);
    daily[local.getUTCDate() - 1].value += inc.total;
    weekdayTotals[local.getUTCDay()] += inc.total;
    if (b.source === "MERCHANT_INSTANT") source.walkIn += inc.total;
    else source.online += inc.total;
    const name = modelName(b.drone_model);
    model.set(name, (model.get(name) ?? 0) + inc.total);
  }

  return {
    monthLabel: `${MONTHS[month]} ${year}`,
    earnings: { ...earnings, cashIncome },
    previousEarnings,
    earningsMonths: monthTotals.map((_, i) => ({ label: monthLabel(year, month, monthsShown, i), value: earningsTotals[i] })),
    total,
    bookings: count,
    average: count ? total / count : 0,
    previousMonthTotal,
    breakdown,
    daily,
    today,
    weekdays: WEEKDAYS.map((label, i) => ({ label, value: weekdayTotals[i] })),
    bySource: [
      { label: "Booked online", value: source.online },
      { label: "Walk-in at the shop", value: source.walkIn },
    ],
    byModel: [...model.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
    months: monthTotals.map((value, i) => ({ label: monthLabel(year, month, monthsShown, i), value })),
  };
}

function monthLabel(year: number, month: number, monthsShown: number, index: number): string {
  const m = new Date(Date.UTC(year, month - (monthsShown - 1 - index), 1));
  return `${MONTHS[m.getUTCMonth()]} ${String(m.getUTCFullYear()).slice(2)}`;
}
