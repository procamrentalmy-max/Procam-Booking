import { describe, expect, it } from "vitest";
import { costSharesFor, earningsFor } from "./earnings";

describe("earningsFor", () => {
  it("matches the pitch: RM30 by card is RM9.60 of costs, RM20.40 net and RM10.20 each", () => {
    const e = earningsFor(30, "CARD");
    expect(e.totalCosts).toBeCloseTo(9.6, 10);
    expect(e.net).toBeCloseTo(20.4, 10);
    expect(e.partner).toBeCloseTo(10.2, 10);
    expect(e.procam).toBeCloseTo(10.2, 10);
    expect(e.costs.platform).toBeCloseTo(5.4, 10);
    expect(e.costs.payment).toBeCloseTo(1.2, 10);
    expect(e.costs.kyc).toBeCloseTo(0.6, 10);
    expect(e.costs.insurance).toBeCloseTo(2.4, 10);
  });

  it("drops the 4% payment processing for cash: costs 28%, so RM30 gives the partner RM10.80", () => {
    const e = earningsFor(30, "CASH");
    expect(e.costs.payment).toBe(0);
    expect(e.totalCosts).toBeCloseTo(8.4, 10);
    expect(e.partner).toBeCloseTo(10.8, 10);
    expect(e.partner + e.procam).toBeCloseTo(e.net, 10);
  });

  it("is zero for no income", () => {
    expect(earningsFor(0, "CARD").partner).toBe(0);
  });
});

describe("costSharesFor", () => {
  it("only the payment share changes between card and cash", () => {
    expect(costSharesFor("CARD")).toEqual({ platform: 0.18, payment: 0.04, kyc: 0.02, insurance: 0.08 });
    expect(costSharesFor("CASH")).toEqual({ platform: 0.18, payment: 0, kyc: 0.02, insurance: 0.08 });
  });
});
