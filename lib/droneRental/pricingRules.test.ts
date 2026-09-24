import { describe, expect, it } from "vitest";
import { rentalFeeMyr, lateFeeMyr, depositDeductionMyr, FIRST_HOUR_RATE_MYR, ADDITIONAL_HOUR_RATE_MYR } from "./pricingRules";

describe("rentalFeeMyr", () => {
  it("charges just the first-hour rate for a 1-hour booking", () => {
    expect(rentalFeeMyr(60)).toBe(FIRST_HOUR_RATE_MYR);
  });

  it("adds the additional-hour rate for each hour after the first", () => {
    expect(rentalFeeMyr(120)).toBe(FIRST_HOUR_RATE_MYR + ADDITIONAL_HOUR_RATE_MYR);
    expect(rentalFeeMyr(180)).toBe(FIRST_HOUR_RATE_MYR + 2 * ADDITIONAL_HOUR_RATE_MYR);
  });

  it("rounds a partial hour up to a full hour", () => {
    expect(rentalFeeMyr(61)).toBe(FIRST_HOUR_RATE_MYR + ADDITIONAL_HOUR_RATE_MYR);
    expect(rentalFeeMyr(30)).toBe(FIRST_HOUR_RATE_MYR);
  });

  it("returns 0 for a non-positive duration", () => {
    expect(rentalFeeMyr(0)).toBe(0);
  });
});

describe("lateFeeMyr", () => {
  it("is 0 when not late", () => {
    expect(lateFeeMyr(0)).toBe(0);
    expect(lateFeeMyr(-5)).toBe(0);
  });

  it("charges one additional-hour rate for any lateness up to an hour", () => {
    expect(lateFeeMyr(1)).toBe(ADDITIONAL_HOUR_RATE_MYR);
    expect(lateFeeMyr(59)).toBe(ADDITIONAL_HOUR_RATE_MYR);
    expect(lateFeeMyr(60)).toBe(ADDITIONAL_HOUR_RATE_MYR);
  });

  it("rounds up to two hours just past the first", () => {
    expect(lateFeeMyr(61)).toBe(2 * ADDITIONAL_HOUR_RATE_MYR);
  });
});

describe("depositDeductionMyr", () => {
  it("keeps nothing when the outcome is NONE", () => {
    expect(depositDeductionMyr("NONE")).toBe(0);
  });

  it("keeps RM50 when damaged and the full deposit when lost", () => {
    expect(depositDeductionMyr("DAMAGED")).toBe(50);
    expect(depositDeductionMyr("LOST")).toBe(100);
  });
});
