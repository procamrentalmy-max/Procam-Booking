import { describe, expect, it } from "vitest";
import { DRONE_ID_CHECK_ENABLED } from "@/lib/features";
import { KYC_PER_BOOKING_MYR, earningsForBooking } from "./earnings";

// While the online ID check is switched off (lib/features.ts) it costs nothing, so a booking has no ID check cost in the earnings.
describe("the online ID check switched off", () => {
  it("is off", () => {
    expect(DRONE_ID_CHECK_ENABLED).toBe(false);
  });
  it("costs nothing per booking", () => {
    expect(KYC_PER_BOOKING_MYR).toBe(0);
    const e = earningsForBooking([{ amount: 30, method: "CARD" }]);
    expect(e.costs.kyc).toBe(0);
    // platform 18% (5.40) and the card fee 3.1% + RM1 (1.93), then 50/50
    expect(e.net).toBeCloseTo(30 - 5.4 - 1.93, 10);
  });
});
