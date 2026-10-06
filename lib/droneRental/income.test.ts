import { describe, expect, it } from "vitest";
import { monthStartMs, summariseIncome, type IncomeBooking } from "./income";

const NOW = new Date("2026-10-06T10:00:00Z").getTime(); // 18:00 on 6 Oct, Malaysia time

function booking(over: Partial<IncomeBooking> & { start_time: string }): IncomeBooking {
  return {
    id: Math.random().toString(36).slice(2),
    status: "COMPLETED",
    source: "ONLINE",
    paid_by: "CARD",
    batteries_count: 1,
    drone_model: "NEO2",
    rental_fee_myr: 27,
    drone_charge_myr: 0,
    controller_charge_myr: 0,
    swaps: [],
    lateFees: [],
    ...over,
  };
}

const model = (k: string) => (k === "GT50" ? "GT50" : "Neo 2");

describe("monthStartMs", () => {
  it("is the first of the month at midnight Malaysia time", () => {
    expect(new Date(monthStartMs(NOW)).toISOString()).toBe("2026-09-30T16:00:00.000Z");
    expect(new Date(monthStartMs(NOW, 1)).toISOString()).toBe("2026-08-31T16:00:00.000Z");
  });
  it("counts a booking at 00:30 on the 1st (Malaysia) in the new month even though it is still the 30th in UTC", () => {
    const s = summariseIncome([booking({ start_time: "2026-09-30T16:30:00Z" })], NOW, model);
    expect(s.total).toBe(27);
    expect(s.daily[0].value).toBe(27);
  });
});

describe("summariseIncome", () => {
  it("adds rental, swap, late and kept deposit into the month total and the breakdown", () => {
    const s = summariseIncome(
      [booking({ start_time: "2026-10-03T03:00:00Z", swaps: [{ feeMyr: 7, paidBy: "CARD" }], lateFees: [{ amountMyr: 4, paidBy: "CARD" }], drone_charge_myr: 100, controller_charge_myr: 50 })],
      NOW,
      model,
    );
    expect(s.total).toBe(27 + 7 + 4 + 150);
    expect(s.breakdown).toEqual({ rental: 27, swap: 7, late: 4, kept: 150 });
    expect(s.bookings).toBe(1);
    expect(s.average).toBe(188);
  });

  it("ignores bookings that never got paid", () => {
    const s = summariseIncome(
      ["PENDING_PAYMENT", "CANCELLED", "EXPIRED"].map((status) => booking({ status, start_time: "2026-10-03T03:00:00Z" })),
      NOW,
      model,
    );
    expect(s.total).toBe(0);
    expect(s.bookings).toBe(0);
    expect(s.average).toBe(0);
  });

  it("puts each booking on its Malaysia-time day and weekday", () => {
    // 2026-10-04 is a Sunday; 17:00 UTC on the 3rd is 01:00 on the 4th in Malaysia
    const s = summariseIncome([booking({ start_time: "2026-10-03T17:00:00Z" })], NOW, model);
    expect(s.daily).toHaveLength(31);
    expect(s.daily[3].value).toBe(27);
    expect(s.daily[2].value).toBe(0);
    expect(s.weekdays[0]).toEqual({ label: "Sun", value: 27 });
    expect(s.today).toBe(6);
  });

  it("compares with last month and fills the last six months, oldest first", () => {
    const s = summariseIncome(
      [
        booking({ start_time: "2026-09-10T03:00:00Z" }),
        booking({ start_time: "2026-09-11T03:00:00Z" }),
        booking({ start_time: "2026-05-20T03:00:00Z", rental_fee_myr: 10 }),
        booking({ start_time: "2026-04-20T03:00:00Z", rental_fee_myr: 99 }), // older than six months shown
        booking({ start_time: "2026-10-02T03:00:00Z" }),
      ],
      NOW,
      model,
    );
    expect(s.previousMonthTotal).toBe(54);
    expect(s.months.map((m) => m.label)).toEqual(["May 26", "Jun 26", "Jul 26", "Aug 26", "Sep 26", "Oct 26"]);
    expect(s.months.map((m) => m.value)).toEqual([10, 0, 0, 0, 54, 27]);
    expect(s.total).toBe(27);
  });

  it("splits online and walk-in, and by model", () => {
    const s = summariseIncome(
      [
        booking({ start_time: "2026-10-02T03:00:00Z" }),
        booking({ start_time: "2026-10-02T04:00:00Z", source: "MERCHANT_INSTANT", drone_model: "GT50", rental_fee_myr: 12 }),
      ],
      NOW,
      model,
    );
    expect(s.bySource).toEqual([
      { label: "Booked online", value: 27 },
      { label: "Walk-in at the shop", value: 12 },
    ]);
    expect(s.byModel).toEqual([
      { label: "Neo 2", value: 27 },
      { label: "GT50", value: 12 },
    ]);
  });

  it("handles a year boundary", () => {
    const jan = new Date("2027-01-10T04:00:00Z").getTime();
    const s = summariseIncome([booking({ start_time: "2026-12-15T04:00:00Z" })], jan, model);
    expect(s.monthLabel).toBe("Jan 2027");
    expect(s.previousMonthTotal).toBe(27);
    expect(s.months.map((m) => m.label)).toEqual(["Aug 26", "Sep 26", "Oct 26", "Nov 26", "Dec 26", "Jan 27"]);
  });

  it("works out the merchant's earnings: a card booking pays the card fee, a cash one does not, both pay the KYC", () => {
    const s = summariseIncome(
      [
        booking({ start_time: "2026-10-02T03:00:00Z", rental_fee_myr: 30 }),
        booking({ start_time: "2026-10-03T03:00:00Z", rental_fee_myr: 30, paid_by: "CASH" }),
        booking({ start_time: "2026-09-10T03:00:00Z", rental_fee_myr: 30 }),
      ],
      NOW,
      model,
    );
    expect(s.earnings.partner).toBeCloseTo(9.635 + 10.6, 10);
    expect(s.earnings.income).toBe(60);
    expect(s.earnings.costs.payment).toBeCloseTo(1.93, 10); // only the card booking pays it
    expect(s.earnings.costs.kyc).toBe(2); // RM1 for each of the two bookings this month
    expect(s.earnings.cashIncome).toBe(30);
    expect(s.previousEarnings).toBeCloseTo(9.635, 10);
    expect(s.earningsMonths.map((m) => m.label)).toEqual(s.months.map((m) => m.label));
    expect(s.earningsMonths[5].value).toBeCloseTo(20.235, 10);
    expect(s.earningsMonths[4].value).toBeCloseTo(9.635, 10);
  });

  it("includes swap and late fees in the earnings, each as its own card payment, but not a deposit kept for damage", () => {
    const s = summariseIncome(
      [
        booking({
          start_time: "2026-10-03T03:00:00Z",
          rental_fee_myr: 20,
          swaps: [{ feeMyr: 7, paidBy: "CARD" }],
          lateFees: [{ amountMyr: 3, paidBy: "CARD" }],
          drone_charge_myr: 100,
        }),
      ],
      NOW,
      model,
    );
    expect(s.earnings.income).toBe(30);
    expect(s.earnings.costs.payment).toBeCloseTo(30 * 0.031 + 3, 10); // three card payments, each with its RM1
    expect(s.earnings.partner).toBeCloseTo(8.635, 10);
    expect(s.total).toBe(130); // sales still count the kept deposit
  });

  it("treats each payment on a booking on its own: rental by card, swap in cash", () => {
    const s = summariseIncome(
      [booking({ start_time: "2026-10-03T03:00:00Z", rental_fee_myr: 30, swaps: [{ feeMyr: 10, paidBy: "CASH" }] })],
      NOW,
      model,
    );
    expect(s.earnings.income).toBe(40);
    expect(s.earnings.costs.payment).toBeCloseTo(1.93, 10); // only the RM30 by card
    expect(s.earnings.partner).toBeCloseTo(13.335, 10);
    expect(s.earnings.cashIncome).toBe(10);
  });

  it("a cash rental with a late fee on the card: only the late fee pays a card fee", () => {
    const s = summariseIncome(
      [booking({ start_time: "2026-10-03T03:00:00Z", rental_fee_myr: 30, paid_by: "CASH", lateFees: [{ amountMyr: 10, paidBy: "CARD" }] })],
      NOW,
      model,
    );
    expect(s.earnings.costs.payment).toBeCloseTo(10 * 0.031 + 1, 10);
    expect(s.earnings.partner).toBeCloseTo(13.645, 10);
    expect(s.earnings.cashIncome).toBe(30);
  });

  it("a two-battery swap (a second row with no fee) is one payment", () => {
    const s = summariseIncome(
      [booking({ start_time: "2026-10-03T03:00:00Z", rental_fee_myr: 20, swaps: [{ feeMyr: 10, paidBy: "CARD" }, { feeMyr: 0, paidBy: "CARD" }] })],
      NOW,
      model,
    );
    expect(s.earnings.costs.payment).toBeCloseTo(30 * 0.031 + 2, 10); // the rental and the swap
  });
});
