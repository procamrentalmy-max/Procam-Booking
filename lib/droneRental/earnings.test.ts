import { describe, expect, it } from "vitest";
import { addEarnings, cardFeeFor, earningsForBooking, ZERO_EARNINGS } from "./earnings";

describe("cardFeeFor", () => {
  it("is 3.1% plus RM1 on a card payment", () => {
    expect(cardFeeFor({ amount: 30, method: "CARD" })).toBeCloseTo(1.93, 10);
    expect(cardFeeFor({ amount: 12, method: "CARD" })).toBeCloseTo(1.372, 10);
    expect(cardFeeFor({ amount: 100, method: "CARD" })).toBeCloseTo(4.1, 10);
  });
  it("is nothing for cash, or for nothing paid", () => {
    expect(cardFeeFor({ amount: 30, method: "CASH" })).toBe(0);
    expect(cardFeeFor({ amount: 0, method: "CARD" })).toBe(0);
  });
});

describe("earningsForBooking", () => {
  it("a RM30 booking paid by card: platform 18%, card fee 3.1% + RM1, KYC RM1, insurance 8%, then 50/50", () => {
    const e = earningsForBooking([{ amount: 30, method: "CARD" }]);
    expect(e.income).toBe(30);
    expect(e.costs.platform).toBeCloseTo(5.4, 10);
    expect(e.costs.payment).toBeCloseTo(1.93, 10);
    expect(e.costs.kyc).toBe(1);
    expect(e.costs.insurance).toBeCloseTo(2.4, 10);
    expect(e.totalCosts).toBeCloseTo(10.73, 10);
    expect(e.net).toBeCloseTo(19.27, 10);
    expect(e.partner).toBeCloseTo(9.635, 10);
    expect(e.procam).toBeCloseTo(9.635, 10);
  });

  it("the same booking paid in cash has no card fee, but still the KYC", () => {
    const e = earningsForBooking([{ amount: 30, method: "CASH" }]);
    expect(e.costs.payment).toBe(0);
    expect(e.costs.kyc).toBe(1);
    expect(e.net).toBeCloseTo(21.2, 10);
    expect(e.partner).toBeCloseTo(10.6, 10);
  });

  it("every card payment pays its own RM1: a rental and a swap are two payments, the KYC is only once", () => {
    const e = earningsForBooking([
      { amount: 20, method: "CARD" },
      { amount: 7, method: "CARD" },
    ]);
    expect(e.costs.payment).toBeCloseTo(27 * 0.031 + 2, 10);
    expect(e.costs.kyc).toBe(1);
  });

  it("a small booking is hit harder by the fixed RM1 than the old flat 4% said", () => {
    const e = earningsForBooking([{ amount: 12, method: "CARD" }]);
    expect(e.costs.payment).toBeGreaterThan(12 * 0.04 * 2);
  });

  it("nothing paid, nothing earned and no KYC", () => {
    expect(earningsForBooking([])).toEqual(ZERO_EARNINGS);
    expect(earningsForBooking([{ amount: 0, method: "CARD" }])).toEqual(ZERO_EARNINGS);
  });
});

describe("addEarnings", () => {
  it("adds every part", () => {
    const a = earningsForBooking([{ amount: 30, method: "CARD" }]);
    const b = earningsForBooking([{ amount: 30, method: "CASH" }]);
    const sum = addEarnings(a, b);
    expect(sum.income).toBe(60);
    expect(sum.costs.kyc).toBe(2);
    expect(sum.partner).toBeCloseTo(a.partner + b.partner, 10);
  });
});
