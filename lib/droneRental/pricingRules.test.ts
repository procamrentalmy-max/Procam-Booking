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
  DRONE_MODEL_PROFILES,
  depositMyrFor,
  hourlyRateFor,
  includesController,
  modelProfile,
} from "./pricingRules";

// The Neo 2 can go out without its controller (RM10 an hour) or with it (RM15 an hour). The older tests below price the
// drone on its own, so they say so; what the controller changes has its own tests at the end.
const NO_CONTROLLER = false;

describe("rentalFeeMyr (Neo 2, drone only)", () => {
  it("charges RM10 for every hour, the first included", () => {
    expect(rentalFeeMyr(60, 2, "NEO2", NO_CONTROLLER) - BATTERY_PACKAGE_FEE_MYR[2]).toBe(HOURLY_RATE_MYR);
    expect(rentalFeeMyr(120, 2, "NEO2", NO_CONTROLLER) - BATTERY_PACKAGE_FEE_MYR[2]).toBe(2 * HOURLY_RATE_MYR);
    expect(rentalFeeMyr(180, 2, "NEO2", NO_CONTROLLER) - BATTERY_PACKAGE_FEE_MYR[2]).toBe(3 * HOURLY_RATE_MYR);
  });

  it("adds RM7 for one battery or RM10 for two", () => {
    expect(rentalFeeMyr(60, 1, "NEO2", NO_CONTROLLER)).toBe(17);
    expect(rentalFeeMyr(60, 2, "NEO2", NO_CONTROLLER)).toBe(20);
    expect(rentalFeeMyr(120, 1, "NEO2", NO_CONTROLLER)).toBe(27);
    expect(rentalFeeMyr(120, 2, "NEO2", NO_CONTROLLER)).toBe(30);
  });

  it("defaults to two batteries", () => {
    expect(rentalFeeMyr(60, undefined, "NEO2", NO_CONTROLLER)).toBe(20);
  });

  it("rounds a partial hour up to a full hour", () => {
    expect(rentalFeeMyr(61, 2, "NEO2", NO_CONTROLLER)).toBe(30);
    expect(rentalFeeMyr(30, 1, "NEO2", NO_CONTROLLER)).toBe(17);
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

describe("lateFeeMyr (Neo 2, drone only)", () => {
  it("is 0 when not late", () => {
    expect(lateFeeMyr(0)).toBe(0);
    expect(lateFeeMyr(-5)).toBe(0);
  });

  it("charges one additional-hour rate for any lateness up to an hour", () => {
    expect(lateFeeMyr(1, "NEO2", NO_CONTROLLER)).toBe(HOURLY_RATE_MYR);
    expect(lateFeeMyr(59, "NEO2", NO_CONTROLLER)).toBe(HOURLY_RATE_MYR);
    expect(lateFeeMyr(60, "NEO2", NO_CONTROLLER)).toBe(HOURLY_RATE_MYR);
  });

  it("rounds up to two hours just past the first", () => {
    expect(lateFeeMyr(61, "NEO2", NO_CONTROLLER)).toBe(2 * HOURLY_RATE_MYR);
  });
});

describe("deposit amounts", () => {
  it("holds RM800 for the drone and RM400 for the controller, RM1,200 with both", () => {
    expect(DEPOSIT_DRONE_MYR).toBe(800);
    expect(DEPOSIT_CONTROLLER_MYR).toBe(400);
    expect(DEPOSIT_MYR).toBe(1200);
  });

  it("formats with a thousands separator", () => {
    expect(formatMyr(1200)).toBe("RM1,200");
    expect(formatMyr(800)).toBe("RM800");
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
    expect(computeDepositCapture({ outcome: "LOST" }, { outcome: "NONE" })).toMatchObject({ droneChargeMyr: 800, totalMyr: 800, overallOutcome: "LOST" });
    expect(computeDepositCapture({ outcome: "NONE" }, { outcome: "LOST" })).toMatchObject({ controllerChargeMyr: 400, totalMyr: 400, overallOutcome: "LOST" });
  });

  it("captures everything when both are lost", () => {
    expect(computeDepositCapture({ outcome: "LOST" }, { outcome: "LOST" }).totalMyr).toBe(1200);
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
    expect(itemCaptureMyr("drone", 800, { outcome: "DAMAGED", damageMyr: 800 })).toBe(800);
  });

  it("rejects a damaged item with no amount, a zero amount, or a negative one", () => {
    expect(() => itemCaptureMyr("drone", 800, { outcome: "DAMAGED" })).toThrow(DepositCaptureError);
    expect(() => itemCaptureMyr("drone", 800, { outcome: "DAMAGED", damageMyr: 0 })).toThrow(DepositCaptureError);
    expect(() => itemCaptureMyr("drone", 800, { outcome: "DAMAGED", damageMyr: -5 })).toThrow(DepositCaptureError);
    expect(() => itemCaptureMyr("drone", 800, { outcome: "DAMAGED", damageMyr: Number.NaN })).toThrow(DepositCaptureError);
  });

  it("rejects a damage charge larger than the item's own deposit", () => {
    expect(() => computeDepositCapture({ outcome: "NONE" }, { outcome: "DAMAGED", damageMyr: 401 })).toThrow(/can't be more than/);
  });

  it("ignores a stray damage amount on an item that isn't damaged", () => {
    expect(computeDepositCapture({ outcome: "NONE", damageMyr: 500 }, { outcome: "NONE" }).totalMyr).toBe(0);
  });
});

describe("the Neo 2 with or without its controller", () => {
  it("adds RM5 an hour for the controller: RM10 without, RM15 with", () => {
    expect(hourlyRateFor("NEO2", false)).toBe(10);
    expect(hourlyRateFor("NEO2", true)).toBe(15);
    expect(rentalFeeMyr(60, 1, "NEO2", false)).toBe(17);
    expect(rentalFeeMyr(60, 1, "NEO2", true)).toBe(22);
    expect(rentalFeeMyr(120, 2, "NEO2", false)).toBe(30);
    expect(rentalFeeMyr(120, 2, "NEO2", true)).toBe(40);
    expect(rentalFeeMyr(180, 1, "NEO2", true)).toBe(52);
  });

  it("is with the controller unless the booking says otherwise, so older rows keep their price", () => {
    expect(rentalFeeMyr(60, 2)).toBe(rentalFeeMyr(60, 2, "NEO2", true));
    expect(lateFeeMyr(10)).toBe(15);
    expect(depositMyrFor("NEO2")).toBe(1200);
  });

  it("holds RM800 without the controller and RM1,200 with it", () => {
    expect(depositMyrFor("NEO2", false)).toBe(800);
    expect(depositMyrFor("NEO2", true)).toBe(1200);
  });

  it("bills a late return at the hourly rate for each hour: RM10 without, RM15 with", () => {
    expect(lateFeeMyr(10, "NEO2", false)).toBe(10);
    expect(lateFeeMyr(10, "NEO2", true)).toBe(15);
    expect(lateFeeMyr(61, "NEO2", false)).toBe(20);
    expect(lateFeeMyr(61, "NEO2", true)).toBe(30);
  });

  it("holds nothing for a controller that was not rented, whatever the return says about it", () => {
    const capture = computeDepositCapture({ outcome: "NONE" }, { outcome: "LOST" }, "NEO2", false);
    expect(capture).toEqual({ droneChargeMyr: 0, controllerChargeMyr: 0, totalMyr: 0, overallOutcome: "NONE" });
    expect(computeDepositCapture({ outcome: "LOST" }, { outcome: "LOST" }, "NEO2", false).totalMyr).toBe(800);
    expect(computeDepositCapture({ outcome: "LOST" }, { outcome: "LOST" }, "NEO2", true).totalMyr).toBe(1200);
  });

  it("leaves the batteries and swaps alone: the same RM7 and RM10 either way", () => {
    expect(BATTERY_PACKAGE_FEE_MYR).toEqual({ 1: 7, 2: 10 });
    expect(rentalFeeMyr(60, 2, "NEO2", true) - rentalFeeMyr(60, 1, "NEO2", true)).toBe(3);
    expect(rentalFeeMyr(60, 2, "NEO2", false) - rentalFeeMyr(60, 1, "NEO2", false)).toBe(3);
  });

  it("only the Neo 2 has the choice: a drone whose controller always comes with it is always 'with'", () => {
    expect(DRONE_MODEL_PROFILES.NEO2.controllerOptional).toBe(true);
    expect(DRONE_MODEL_PROFILES.GT50.controllerOptional).toBe(false);
    expect(includesController("GT50", false)).toBe(true);
    expect(rentalFeeMyr(60, 1, "GT50", false)).toBe(rentalFeeMyr(60, 1, "GT50", true));
    expect(depositMyrFor("GT50", false)).toBe(150);
  });
});

describe("the GT50", () => {
  it("is RM3 an hour cheaper than the Neo 2 on its own, and cheaper on both battery choices", () => {
    expect(DRONE_MODEL_PROFILES.GT50.hourlyRateMyr).toBe(HOURLY_RATE_MYR - 3);
    expect(DRONE_MODEL_PROFILES.GT50.batteryFeeMyr[1]).toBeLessThan(BATTERY_PACKAGE_FEE_MYR[1]);
    expect(DRONE_MODEL_PROFILES.GT50.batteryFeeMyr[2]).toBeLessThan(BATTERY_PACKAGE_FEE_MYR[2]);
    for (const hours of [1, 2, 3, 6]) {
      for (const batteries of [1, 2] as const) {
        expect(rentalFeeMyr(hours * 60, batteries, "GT50")).toBeLessThan(rentalFeeMyr(hours * 60, batteries, "NEO2", false));
      }
    }
  });

  it("prices a booking as RM7 an hour plus RM5 for 1 battery or RM8 for 2", () => {
    expect(DRONE_MODEL_PROFILES.GT50.batteryFeeMyr).toEqual({ 1: 5, 2: 8 });
    expect(rentalFeeMyr(60, 1, "GT50")).toBe(12);
    expect(rentalFeeMyr(60, 2, "GT50")).toBe(15);
    expect(rentalFeeMyr(180, 2, "GT50")).toBe(29);
  });

  it("bills a late return at RM7 an hour", () => {
    expect(lateFeeMyr(10, "GT50")).toBe(7);
    expect(lateFeeMyr(61, "GT50")).toBe(14);
    expect(lateFeeMyr(61, "NEO2", false)).toBe(20);
  });

  it("holds a RM150 deposit, split between the drone and the controller", () => {
    expect(depositMyrFor("GT50")).toBe(150);
    expect(DRONE_MODEL_PROFILES.GT50.depositDroneMyr + DRONE_MODEL_PROFILES.GT50.depositControllerMyr).toBe(150);
    expect(depositMyrFor("NEO2")).toBe(DEPOSIT_MYR);
  });

  it("caps a damage charge at the GT50's own item deposit, not the Neo 2's", () => {
    const { depositDroneMyr } = DRONE_MODEL_PROFILES.GT50;
    expect(computeDepositCapture({ outcome: "DAMAGED", damageMyr: depositDroneMyr }, { outcome: "NONE" }, "GT50").totalMyr).toBe(depositDroneMyr);
    expect(() => computeDepositCapture({ outcome: "DAMAGED", damageMyr: depositDroneMyr + 1 }, { outcome: "NONE" }, "GT50")).toThrow(/can't be more than/);
    // The same amount is fine on a Neo 2.
    expect(computeDepositCapture({ outcome: "DAMAGED", damageMyr: depositDroneMyr + 1 }, { outcome: "NONE" }, "NEO2").totalMyr).toBe(depositDroneMyr + 1);
  });

  it("keeps a lost GT50 drone's whole item deposit and nothing more", () => {
    const capture = computeDepositCapture({ outcome: "LOST" }, { outcome: "NONE" }, "GT50");
    expect(capture.droneChargeMyr).toBe(DRONE_MODEL_PROFILES.GT50.depositDroneMyr);
    expect(capture.totalMyr).toBe(DRONE_MODEL_PROFILES.GT50.depositDroneMyr);
  });

  it("takes the same handover and return photos as the Neo 2", () => {
    expect(DRONE_MODEL_PROFILES.GT50.photosRequired).toBe(true);
    expect(DRONE_MODEL_PROFILES.NEO2.photosRequired).toBe(true);
  });

  it("treats a missing or unknown model as the Neo 2, so older rows keep their prices", () => {
    expect(modelProfile(undefined).key).toBe("NEO2");
    expect(modelProfile(null).key).toBe("NEO2");
    expect(modelProfile("SOMETHING_ELSE").key).toBe("NEO2");
    expect(rentalFeeMyr(60, 2, undefined, false)).toBe(20);
    expect(depositMyrFor(undefined)).toBe(DEPOSIT_MYR);
  });
});
