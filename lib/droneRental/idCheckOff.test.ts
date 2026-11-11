import { describe, expect, it } from "vitest";
import { DRONE_ID_CHECK_ENABLED } from "@/lib/features";
import { KYC_PER_BOOKING_MYR, earningsForBooking } from "./earnings";

// The online ID check is optional (lib/features.ts): a customer who does it has only 40% of the deposit held, and the check's cost is counted only on that booking.
describe("the optional online ID check", () => {
  it("is on", () => {
    expect(DRONE_ID_CHECK_ENABLED).toBe(true);
    expect(KYC_PER_BOOKING_MYR).toBe(1.3);
  });
  it("costs nothing on a booking that did not do it", () => {
    const e = earningsForBooking([{ amount: 30, method: "CARD" }]);
    expect(e.costs.kyc).toBe(0);
    // platform 18% (5.40) and the card fee 3.1% + RM1 (1.93), then 50/50
    expect(e.net).toBeCloseTo(30 - 5.4 - 1.93, 10);
  });
  it("costs RM1.30 on a booking that did", () => {
    const e = earningsForBooking([{ amount: 30, method: "CARD" }], { kyc: true });
    expect(e.costs.kyc).toBeCloseTo(1.3, 10);
  });
});
