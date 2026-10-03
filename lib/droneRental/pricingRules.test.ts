import { describe, expect, it } from "vitest";
import {
  rentalFeeMyr,
  lateFeeMyr,
  computeDepositCapture,
  itemCaptureMyr,
  formatMyr,
  DepositCaptureError,
  HOURLY_RATE_MYR,
  BATTERY_PACKAGE_FEE_MYR,
  isValidRentalMinutes,
  DEPOSIT_MYR,
  DEPOSIT_DRONE_MYR,
  DEPOSIT_CONTROLLER_MYR,
} from "./pricingRules";

describe("rentalFeeMyr", () => {
  it("charges RM10 for every hour, the first included", () => {
    expect(rentalFeeMyr(60, 2) - BATTERY_PACKAGE_FEE_MYR[2]).toBe(HOURLY_RATE_MYR);
    expect(rentalFeeMyr(120, 2) - BATTERY_PACKAGE_FEE_MYR[2]).toBe(2 * HOURLY_RATE_MYR);
    expect(rentalFeeMyr(180, 2) - BATTERY_PACKAGE_FEE_MYR[2]).toBe(3 * HOURLY_RATE_MYR);
  });

  it("adds RM7 for one battery or RM10 for two", () => {
    expect(rentalFeeMyr(60, 1)).toBe(17);
    expect(rentalFeeMyr(60, 2)).toBe(20);
    expect(rentalFeeMyr(120, 1)).toBe(27);
    expect(rentalFeeMyr(120, 2)).toBe(30);
  });

  it("defaults to two batteries", () => {
    expect(rentalFeeMyr(60)).toBe(20);
  });

  it("rounds a partial hour up to a full hour", () => {
    expect(rentalFeeMyr(61, 2)).toBe(30);
    expect(rentalFeeMyr(30, 1)).toBe(17);
  });

  it("returns 0 for a non-positive duration", () => {
    expect(rentalFeeMyr(0)).toBe(0);
  });
});

describe("isValidRentalMinutes", () => {
  it("accepts whole hours from 1 to 6", () => {
    for (const h of [1, 2, 3, 4, 5, 6]) expect(isValidRentalMinutes(h * 60)).toBe(true);
  });

  it("rejects anything else", () => {
    for (const m of [0, 1, 30, 61, 90, 420, 1440, -60, 60.5, Number.NaN]) expect(isValidRentalMinutes(m)).toBe(false);
  });
});

describe("lateFeeMyr", () => {
  it("is 0 when not late", () => {
    expect(lateFeeMyr(0)).toBe(0);
    expect(lateFeeMyr(-5)).toBe(0);
  });

  it("charges one additional-hour rate for any lateness up to an hour", () => {
    expect(lateFeeMyr(1)).toBe(HOURLY_RATE_MYR);
    expect(lateFeeMyr(59)).toBe(HOURLY_RATE_MYR);
    expect(lateFeeMyr(60)).toBe(HOURLY_RATE_MYR);
  });

  it("rounds up to two hours just past the first", () => {
    expect(lateFeeMyr(61)).toBe(2 * HOURLY_RATE_MYR);
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
