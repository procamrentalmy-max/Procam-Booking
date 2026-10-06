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
  CONTROLLER_PROFILES,
  controllerDepositFor,
  controllerLabel,
  effectiveController,
  storedController,
  ENABLED_DRONE_MODELS,
} from "./pricingRules";

// A drone can go out with no controller (the customer's own phone), with the RC-N3 (RM5 an hour more) or with the Goggles N3 +
// Motion 3 set (RM10 an hour more). The older tests below price the drone on its own, so they say so; what the controllers
// change has its own tests further down.
const NO_CONTROLLER = "NONE" as const;

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
  it("holds RM700 for the drone and RM400 for the controller, RM1,100 with both", () => {
    expect(DEPOSIT_DRONE_MYR).toBe(700);
    expect(DEPOSIT_CONTROLLER_MYR).toBe(400);
    expect(DEPOSIT_MYR).toBe(1100);
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
    expect(computeDepositCapture({ outcome: "LOST" }, { outcome: "NONE" })).toMatchObject({ droneChargeMyr: 700, totalMyr: 700, overallOutcome: "LOST" });
    expect(computeDepositCapture({ outcome: "NONE" }, { outcome: "LOST" })).toMatchObject({ controllerChargeMyr: 400, totalMyr: 400, overallOutcome: "LOST" });
  });

  it("captures everything when both are lost", () => {
    expect(computeDepositCapture({ outcome: "LOST" }, { outcome: "LOST" }).totalMyr).toBe(1100);
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
    expect(itemCaptureMyr("drone", 700, { outcome: "DAMAGED", damageMyr: 700 })).toBe(700);
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

describe("the three ways to fly: phone only, the RC-N3 or the Goggles N3 + Motion 3 set", () => {
  it("adds RM5 an hour for the RC-N3 and RM10 for the goggles set: RM10, RM15 or RM20 on the Neo 2", () => {
    expect(hourlyRateFor("NEO2", "NONE")).toBe(10);
    expect(hourlyRateFor("NEO2", "RC_N3")).toBe(15);
    expect(hourlyRateFor("NEO2", "GOGGLES_N3")).toBe(20);
    expect(rentalFeeMyr(60, 1, "NEO2", "NONE")).toBe(17);
    expect(rentalFeeMyr(60, 1, "NEO2", "RC_N3")).toBe(22);
    expect(rentalFeeMyr(60, 1, "NEO2", "GOGGLES_N3")).toBe(27);
    expect(rentalFeeMyr(120, 2, "NEO2", "GOGGLES_N3")).toBe(50);
    expect(rentalFeeMyr(180, 1, "NEO2", "RC_N3")).toBe(52);
  });

  it("charges the same controller prices on every drone: the extra is the same on the Neo and the Neo 2", () => {
    for (const kind of ["RC_N3", "GOGGLES_N3"] as const) {
      expect(hourlyRateFor("NEO", kind) - hourlyRateFor("NEO", "NONE")).toBe(CONTROLLER_PROFILES[kind].hourlyMyr);
      expect(hourlyRateFor("NEO2", kind) - hourlyRateFor("NEO2", "NONE")).toBe(CONTROLLER_PROFILES[kind].hourlyMyr);
      expect(depositMyrFor("NEO", kind) - depositMyrFor("NEO", "NONE")).toBe(CONTROLLER_PROFILES[kind].depositMyr);
      expect(depositMyrFor("NEO2", kind) - depositMyrFor("NEO2", "NONE")).toBe(CONTROLLER_PROFILES[kind].depositMyr);
    }
  });

  it("is with the RC-N3 unless the booking says otherwise, so older rows keep their price", () => {
    expect(rentalFeeMyr(60, 2)).toBe(rentalFeeMyr(60, 2, "NEO2", "RC_N3"));
    expect(lateFeeMyr(10)).toBe(15);
    expect(depositMyrFor("NEO2")).toBe(1100);
    expect(storedController("NEO2", undefined)).toBe("RC_N3");
    expect(storedController("NEO2", "SOMETHING")).toBe("RC_N3");
    expect(storedController("NEO2", "GOGGLES_N3")).toBe("GOGGLES_N3");
    expect(storedController("NEO2", "NONE")).toBe("NONE");
  });

  it("holds RM700 for the drone, RM400 more for the RC-N3 and RM800 more for the goggles set", () => {
    expect(depositMyrFor("NEO2", "NONE")).toBe(700);
    expect(depositMyrFor("NEO2", "RC_N3")).toBe(1100);
    expect(depositMyrFor("NEO2", "GOGGLES_N3")).toBe(1500);
    expect(controllerDepositFor("NEO2", "NONE")).toBe(0);
    expect(controllerDepositFor("NEO2", "GOGGLES_N3")).toBe(800);
  });

  it("bills a late return at the hourly rate for each hour, whichever way it was flown", () => {
    expect(lateFeeMyr(10, "NEO2", "NONE")).toBe(10);
    expect(lateFeeMyr(10, "NEO2", "RC_N3")).toBe(15);
    expect(lateFeeMyr(10, "NEO2", "GOGGLES_N3")).toBe(20);
    expect(lateFeeMyr(61, "NEO2", "GOGGLES_N3")).toBe(40);
    expect(lateFeeMyr(61, "NEO", "GOGGLES_N3")).toBe(38);
  });

  it("holds nothing for a controller that was not rented, whatever the return says about it", () => {
    const capture = computeDepositCapture({ outcome: "NONE" }, { outcome: "LOST" }, "NEO2", "NONE");
    expect(capture).toEqual({ droneChargeMyr: 0, controllerChargeMyr: 0, totalMyr: 0, overallOutcome: "NONE" });
    expect(computeDepositCapture({ outcome: "LOST" }, { outcome: "LOST" }, "NEO2", "NONE").totalMyr).toBe(700);
    expect(computeDepositCapture({ outcome: "LOST" }, { outcome: "LOST" }, "NEO2", "RC_N3").totalMyr).toBe(1100);
  });

  it("captures a lost goggles set at its own RM800 deposit, and caps damage there", () => {
    expect(computeDepositCapture({ outcome: "NONE" }, { outcome: "LOST" }, "NEO2", "GOGGLES_N3")).toMatchObject({ controllerChargeMyr: 800, totalMyr: 800, overallOutcome: "LOST" });
    expect(computeDepositCapture({ outcome: "LOST" }, { outcome: "LOST" }, "NEO2", "GOGGLES_N3").totalMyr).toBe(1500);
    expect(computeDepositCapture({ outcome: "NONE" }, { outcome: "DAMAGED", damageMyr: 800 }, "NEO2", "GOGGLES_N3").totalMyr).toBe(800);
    expect(() => computeDepositCapture({ outcome: "NONE" }, { outcome: "DAMAGED", damageMyr: 801 }, "NEO2", "GOGGLES_N3")).toThrow(/can't be more than/);
    // The RC-N3 is capped at its own RM400.
    expect(() => computeDepositCapture({ outcome: "NONE" }, { outcome: "DAMAGED", damageMyr: 401 }, "NEO2", "RC_N3")).toThrow(/can't be more than/);
  });

  it("leaves the batteries and swaps alone: the same prices whichever way it is flown", () => {
    expect(BATTERY_PACKAGE_FEE_MYR).toEqual({ 1: 7, 2: 10 });
    for (const kind of ["NONE", "RC_N3", "GOGGLES_N3"] as const) {
      expect(rentalFeeMyr(60, 2, "NEO2", kind) - rentalFeeMyr(60, 1, "NEO2", kind)).toBe(3);
    }
  });

  it("names the choice for the customer", () => {
    expect(controllerLabel("NEO2", "NONE")).toBe("Phone only");
    expect(controllerLabel("NEO2", "RC_N3")).toBe("RC-N3");
    expect(controllerLabel("NEO", "GOGGLES_N3")).toBe("Goggles N3 + Motion 3");
  });

  it("only the Neo and the Neo 2 have the choice: a drone whose controller always comes with it is always 'with'", () => {
    expect(DRONE_MODEL_PROFILES.NEO2.controllerOptions).toEqual(["NONE", "RC_N3", "GOGGLES_N3"]);
    expect(DRONE_MODEL_PROFILES.NEO.controllerOptions).toEqual(["NONE", "RC_N3", "GOGGLES_N3"]);
    expect(DRONE_MODEL_PROFILES.GT50.controllerOptions).toEqual(["RC_N3"]);
    expect(includesController("GT50", "NONE")).toBe(true);
    expect(effectiveController("GT50", "GOGGLES_N3")).toBe("RC_N3");
    expect(rentalFeeMyr(60, 1, "GT50", "NONE")).toBe(rentalFeeMyr(60, 1, "GT50", "RC_N3"));
    expect(depositMyrFor("GT50", "NONE")).toBe(150);
  });
});

describe("the DJI Neo (the original)", () => {
  it("is offered alongside the Neo 2, and the GT50 stays parked", () => {
    expect([...ENABLED_DRONE_MODELS]).toEqual(["NEO2", "NEO"]);
    expect(modelProfile("NEO").key).toBe("NEO");
  });

  it("is RM1 cheaper than the Neo 2 on the hour and on both battery choices (also the swap prices)", () => {
    expect(DRONE_MODEL_PROFILES.NEO.hourlyRateMyr).toBe(9);
    expect(DRONE_MODEL_PROFILES.NEO.batteryFeeMyr).toEqual({ 1: 6, 2: 9 });
    expect(rentalFeeMyr(60, 1, "NEO", "NONE")).toBe(15);
    expect(rentalFeeMyr(60, 2, "NEO", "NONE")).toBe(18);
    expect(rentalFeeMyr(120, 2, "NEO", "RC_N3")).toBe(37);
  });

  it("bills a late return at the hourly rate, RM9 on its own", () => {
    expect(lateFeeMyr(10, "NEO", "NONE")).toBe(9);
    expect(lateFeeMyr(61, "NEO", "RC_N3")).toBe(28);
  });

  it("holds a RM600 drone deposit (RM100 less than the Neo 2), with the controller deposits on top", () => {
    expect(depositMyrFor("NEO", "NONE")).toBe(600);
    expect(depositMyrFor("NEO", "RC_N3")).toBe(1000);
    expect(depositMyrFor("NEO", "GOGGLES_N3")).toBe(1400);
  });

  it("takes the same handover photos, with its own batteries named N1, N2...", () => {
    expect(DRONE_MODEL_PROFILES.NEO.photosRequired).toBe(true);
    expect(DRONE_MODEL_PROFILES.NEO.batteryPrefix).toBe("N");
  });
});

describe("the GT50", () => {
  it("is RM3 an hour cheaper than the Neo 2 on its own, and cheaper on both battery choices", () => {
    expect(DRONE_MODEL_PROFILES.GT50.hourlyRateMyr).toBe(HOURLY_RATE_MYR - 3);
    expect(DRONE_MODEL_PROFILES.GT50.batteryFeeMyr[1]).toBeLessThan(BATTERY_PACKAGE_FEE_MYR[1]);
    expect(DRONE_MODEL_PROFILES.GT50.batteryFeeMyr[2]).toBeLessThan(BATTERY_PACKAGE_FEE_MYR[2]);
    for (const hours of [1, 2, 3, 6]) {
      for (const batteries of [1, 2] as const) {
        expect(rentalFeeMyr(hours * 60, batteries, "GT50")).toBeLessThan(rentalFeeMyr(hours * 60, batteries, "NEO2", "NONE"));
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
    expect(lateFeeMyr(61, "NEO2", "NONE")).toBe(20);
  });

  it("holds a RM150 deposit, split between the drone and the controller", () => {
    expect(depositMyrFor("GT50")).toBe(150);
    expect(DRONE_MODEL_PROFILES.GT50.depositDroneMyr + controllerDepositFor("GT50", "RC_N3")).toBe(150);
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
    expect(rentalFeeMyr(60, 2, undefined, "NONE")).toBe(20);
    expect(depositMyrFor(undefined)).toBe(DEPOSIT_MYR);
  });
});
