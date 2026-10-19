import { describe, expect, it } from "vitest";
import { describeQrPayment } from "./qrPaymentLabel";

describe("describeQrPayment", () => {
  it("names a walk-in rental", () => {
    expect(describeQrPayment({ kind: "RENTAL_FEE", batteryCount: null })).toBe("Walk-in rental");
  });
  it("names a battery swap with how many batteries", () => {
    expect(describeQrPayment({ kind: "BATTERY_SWAP_FEE", batteryCount: 1 })).toBe("Battery swap, 1 battery");
    expect(describeQrPayment({ kind: "BATTERY_SWAP_FEE", batteryCount: 2 })).toBe("Battery swap, 2 batteries");
  });
});
