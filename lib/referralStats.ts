import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import type { DrPaidBy, DrReferralPayoutRow, DrReferrerRow } from "@/lib/db/types";
import { PAID_STATUSES, bookingEarnings, monthStartMs, type IncomeBooking } from "@/lib/droneRental/income";

export type ReferrerSummary = {
  referrer: DrReferrerRow;
  /** Different phones that scanned the flyer, all time and this month (Malaysia time). */
  scans: number;
  scansThisMonth: number;
  /** Paid bookings and walk-ins that came from the flyer, and what customers paid on them. */
  bookings: number;
  bookingsThisMonth: number;
  sales: number;
  /** The flyer place's 10% of the profit after costs on those bookings, all time and this month. */
  commission: number;
  commissionThisMonth: number;
  paid: number;
  owed: number;
  payouts: DrReferralPayoutRow[];
  /** Every paid booking that came from this flyer: its id, when it started, what customers paid and the commission on it. */
  all: { id: string; start_time: string; sales: number; commission: number }[];
  /** The latest bookings, newest first: when it started, what customers paid and the commission on it. No customer details. */
  recent: { start_time: string; sales: number; commission: number }[];
};

type BookingRow = {
  id: string;
  shop_id: string;
  referrer_id: string | null;
  status: string;
  source: string;
  paid_by: DrPaidBy;
  start_time: string;
  batteries_count: number;
  drone_model: string;
  rental_fee_myr: number | string;
  drone_charge_myr: number | string;
  controller_charge_myr: number | string;
  dr_battery_swaps: { fee_myr: number | string; paid_by: string; swap_shop_id: string | null }[] | null;
  dr_payments: { amount_myr: number | string; kind: string; status: string; provider: string | null }[] | null;
};

const paidBy = (p: string | null | undefined): DrPaidBy => (p === "CASH" ? "CASH" : p === "QR" ? "QR" : "CARD");

/** A booking as the earnings maths wants it: the rental, this shop's own swaps and the late fees, each by card, cash or QR (the same as the merchant's Shop income). */
function toIncomeBooking(b: BookingRow): IncomeBooking {
  return {
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
    swaps: (b.dr_battery_swaps ?? []).filter((s) => Number(s.fee_myr) > 0 && (!s.swap_shop_id || s.swap_shop_id === b.shop_id)).map((s) => ({ feeMyr: Number(s.fee_myr), paidBy: paidBy(s.paid_by) })),
    lateFees: (b.dr_payments ?? []).filter((p) => p.kind === "LATE_FEE" && p.status === "SUCCEEDED").map((p) => ({ amountMyr: Number(p.amount_myr), paidBy: p.provider === "cash" ? ("CASH" as const) : ("CARD" as const) })),
    referred: true,
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Every flyer place (or just one) with its scans, the bookings that came from it, the commission on them and what has been paid out.
 * A booking counts once it is paid (CONFIRMED, ACTIVE or COMPLETED), like the merchant's income, so a cancelled or refunded one drops out.
 */
export async function loadReferrerSummaries(options: { referrerId?: string; now?: number } = {}): Promise<ReferrerSummary[]> {
  const db = createServiceRoleClient();
  const now = options.now ?? Date.now();
  const monthStart = monthStartMs(now);

  const referrersQuery = db.from("dr_referrers").select("*").order("created_at", { ascending: true });
  const scansQuery = db.from("dr_referral_scans").select("referrer_id,created_at").limit(100000);
  const payoutsQuery = db.from("dr_referral_payouts").select("*").order("paid_at", { ascending: false });
  const bookingsQuery = db
    .from("dr_bookings")
    .select("id,shop_id,referrer_id,status,source,paid_by,start_time,batteries_count,drone_model,rental_fee_myr,drone_charge_myr,controller_charge_myr,dr_battery_swaps(fee_myr,paid_by,swap_shop_id),dr_payments(amount_myr,kind,status,provider)")
    .not("referrer_id", "is", null)
    .in("status", PAID_STATUSES)
    .order("start_time", { ascending: false })
    .limit(20000);
  const id = options.referrerId;
  const [{ data: referrers }, { data: scans }, { data: payouts }, { data: bookings }] = await Promise.all([
    id ? referrersQuery.eq("id", id) : referrersQuery,
    id ? scansQuery.eq("referrer_id", id) : scansQuery,
    id ? payoutsQuery.eq("referrer_id", id) : payoutsQuery,
    (id ? bookingsQuery.eq("referrer_id", id) : bookingsQuery).returns<BookingRow[]>(),
  ]);

  return (referrers ?? []).map((referrer) => {
    const myScans = (scans ?? []).filter((s) => s.referrer_id === referrer.id);
    const myPayouts = (payouts ?? []).filter((p) => p.referrer_id === referrer.id);
    const mine = (bookings ?? []).filter((b) => b.referrer_id === referrer.id);
    let sales = 0;
    let commission = 0;
    let commissionThisMonth = 0;
    let bookingsThisMonth = 0;
    const recent: ReferrerSummary["recent"] = [];
    const all: ReferrerSummary["all"] = [];
    for (const b of mine) {
      const earned = bookingEarnings(toIncomeBooking(b));
      sales += earned.income;
      commission += earned.referrer;
      if (new Date(b.start_time).getTime() >= monthStart) {
        bookingsThisMonth += 1;
        commissionThisMonth += earned.referrer;
      }
      all.push({ id: b.id, start_time: b.start_time, sales: round2(earned.income), commission: round2(earned.referrer) });
      if (recent.length < 30) recent.push({ start_time: b.start_time, sales: round2(earned.income), commission: round2(earned.referrer) });
    }
    const paid = round2(myPayouts.reduce((sum, p) => sum + Number(p.amount_myr), 0));
    const earned = round2(commission);
    return {
      referrer,
      scans: myScans.length,
      scansThisMonth: myScans.filter((s) => new Date(s.created_at).getTime() >= monthStart).length,
      bookings: mine.length,
      bookingsThisMonth,
      sales: round2(sales),
      commission: earned,
      commissionThisMonth: round2(commissionThisMonth),
      paid,
      // Never below zero, and never "-0": a payout rounded to the cent can be a hair over what the unrounded sum came to.
      owed: Math.max(0, round2(earned - paid)) || 0,
      payouts: myPayouts.map((p) => ({ ...p, amount_myr: Number(p.amount_myr) })),
      all,
      recent,
    };
  });
}

export type FlyerBooking = { id: string; referrerName: string; start_time: string; sales: number; commission: number };

/** Every paid booking that came from a flyer, by booking id, with its flyer place and the flyer place's 10% (for the admin pages that list bookings or add up costs). */
export async function loadFlyerBookings(): Promise<Map<string, FlyerBooking>> {
  const byBooking = new Map<string, FlyerBooking>();
  for (const s of await loadReferrerSummaries()) for (const b of s.all) byBooking.set(b.id, { ...b, referrerName: s.referrer.name });
  return byBooking;
}
