import { describe, expect, it } from "vitest";
import { KYC_PER_BOOKING_MYR, PLATFORM_RATE } from "./earnings";
import { bookingEarnings, bookingIncome, summariseIncome, type IncomeBooking } from "./income";

const base: IncomeBooking = {
  id: "b1",
  status: "ACTIVE",
  source: "ONLINE",
  paid_by: "CARD",
  start_time: "2026-10-10T02:00:00Z",
  batteries_count: 2,
  drone_model: "NEO2",
  rental_fee_myr: 40,
  drone_charge_myr: 0,
  controller_charge_myr: 0,
  swaps: [{ feeMyr: 7, paidBy: "CASH" }],
  lateFees: [],
};

describe("a swap done at another shop earns that shop only the swap fee", () => {
  it("counts only the swap in the income, nothing of the rental", () => {
    const swapOnly = { ...base, swapOnly: true };
    expect(bookingIncome(swapOnly)).toEqual({ rental: 0, swap: 7, late: 0, kept: 0, total: 7 });
    expect(bookingIncome(base).total).toBe(47);
  });

  it("does not charge the ID check to the shop that only swapped", () => {
    const swapOnly = bookingEarnings({ ...base, swapOnly: true });
    expect(swapOnly.income).toBe(7);
    expect(swapOnly.costs.kyc).toBe(0);
    // a cash swap has no card fee: the platform fee is the only cost
    expect(swapOnly.costs.platform).toBeCloseTo(7 * PLATFORM_RATE, 5);
    const whole = bookingEarnings(base);
    expect(whole.costs.kyc).toBe(KYC_PER_BOOKING_MYR);
  });

  it("is not counted as one of the shop's bookings", () => {
    const now = new Date("2026-10-15T04:00:00Z").getTime();
    const s = summariseIncome([{ ...base, swapOnly: true }], now, (k) => k, 3);
    expect(s.bookings).toBe(0);
    expect(s.total).toBe(7);
    const own = summariseIncome([base], now, (k) => k, 3);
    expect(own.bookings).toBe(1);
  });
});
