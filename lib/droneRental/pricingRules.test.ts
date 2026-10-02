import { describe, expect, it } from "vitest";
import {
  rentalFeeMyr,
  lateFeeMyr,
  computeDepositCapture,
  itemCaptureMyr,
  formatMyr,
  DepositCaptureError,
  FIRST_HOUR_RATE_MYR,
  ADDITIONAL_HOUR_RATE_MYR,
  DEPOSIT_MYR,
  DEPOSIT_DRONE_MYR,
  DEPOSIT_CONTROLLER_MYR,
} from "./pricingRules";

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

describe("deposit amounts", () => {
  it("holds RM900 for the drone and RM400 for the controller, RM1,300 in total", () => {
    expect(DEPOSIT_DRONE_MYR).toBe(900);
    expect(DEPOSIT_CONTROLLER_MYR).toBe(400);
    expect(DEPOSIT_MYR).toBe(1300);
  });

  it("formats with a thousands separator", () => {
    expect(formatMyr(1300)).toBe("RM1,300");
    expect(formatMyr(900)).toBe("RM900");
    expect(formatMyr(49.5)).toBe("RM49.5");
  });
});

describe("computeDepositCapture", () => {
  it("captures nothing when both items come back fine — the whole hold is released", () => {
    expect(computeDepositCapture({ outcome: "NONE" }, { outcome: "NONE" })).toEqual({
      droneChargeMyr: 0,
      controllerChargeMyr: 0,
      totalMyr: 0,
      overallOutcome: "NONE",
    });
  });

  it("captures the full item value when it's lost", () => {
    expect(computeDepositCapture({ outcome: "LOST" }, { outcome: "NONE" })).toMatchObject({ droneChargeMyr: 900, totalMyr: 900, overallOutcome: "LOST" });
    expect(computeDepositCapture({ outcome: "NONE" }, { outcome: "LOST" })).toMatchObject({ controllerChargeMyr: 400, totalMyr: 400, overallOutcome: "LOST" });
  });

  it("captures everything when both are lost", () => {
    expect(computeDepositCapture({ outcome: "LOST" }, { outcome: "LOST" }).totalMyr).toBe(1300);
  });

  it("captures the assessed damage amount for a damaged item", () => {
    const result = computeDepositCapture({ outcome: "DAMAGED", damageMyr: 150 }, { outcome: "NONE" });
    expect(result).toEqual({ droneChargeMyr: 150, controllerChargeMyr: 0, totalMyr: 150, overallOutcome: "DAMAGED" });
  });

  it("adds damage on one item to a loss on the other, and reports LOST as the headline", () => {
    const result = computeDepositCapture({ outcome: "DAMAGED", damageMyr: 80.5 }, { outcome: "LOST" });
    expect(result.totalMyr).toBe(480.5);
    expect(result.overallOutcome).toBe("LOST");
  });

  it("allows a damage charge up to exactly the item's deposit", () => {
    expect(itemCaptureMyr("drone", 900, { outcome: "DAMAGED", damageMyr: 900 })).toBe(900);
  });

  it("rejects a damaged item with no amount, a zero amount, or a negative one", () => {
    expect(() => itemCaptureMyr("drone", 900, { outcome: "DAMAGED" })).toThrow(DepositCaptureError);
    expect(() => itemCaptureMyr("drone", 900, { outcome: "DAMAGED", damageMyr: 0 })).toThrow(DepositCaptureError);
    expect(() => itemCaptureMyr("drone", 900, { outcome: "DAMAGED", damageMyr: -5 })).toThrow(DepositCaptureError);
    expect(() => itemCaptureMyr("drone", 900, { outcome: "DAMAGED", damageMyr: Number.NaN })).toThrow(DepositCaptureError);
  });

  it("rejects a damage charge larger than the item's own deposit", () => {
    expect(() => computeDepositCapture({ outcome: "NONE" }, { outcome: "DAMAGED", damageMyr: 401 })).toThrow(/can't be more than/);
  });

  it("ignores a stray damage amount on an item that isn't damaged", () => {
    expect(computeDepositCapture({ outcome: "NONE", damageMyr: 500 }, { outcome: "NONE" }).totalMyr).toBe(0);
  });
});
