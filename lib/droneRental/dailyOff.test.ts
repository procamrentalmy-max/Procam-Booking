import { describe, expect, it, vi } from "vitest";

// The switch is pinned off here so the off state stays covered whichever way lib/features.ts is set.
vi.mock("@/lib/features", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/features")>()), DAILY_RENTAL_ENABLED: false }));
import { DAILY_RENTAL_ENABLED } from "@/lib/features";
import { faqEn, faqMs, faqZh } from "@/lib/i18n/faq";
import { hasDailyRate, offersDaily, rentalFeeMyr } from "./pricingRules";
import { packageQuery, parsePackagePreset } from "./packagePreset";

// While renting by the day is switched off (DAILY_RENTAL_ENABLED in lib/features.ts) customers can only choose hours, and nothing says otherwise. What exists is kept for when it comes back.
describe("renting by the day switched off", () => {
  it("is off in this test", () => {
    expect(DAILY_RENTAL_ENABLED).toBe(false);
  });

  it("offers no drone by the day, though the daily prices are still there", () => {
    expect(offersDaily("NEO2", "NONE")).toBe(false);
    expect(offersDaily("NEO2", "RC_N3")).toBe(false);
    expect(hasDailyRate("NEO2", "NONE")).toBe(true);
    expect(rentalFeeMyr(1440, 2, "NEO2", "NONE")).toBe(98);
  });

  it("does not take a daily package from the address, but hours still work", () => {
    expect(parsePackagePreset({ drone: "NEO2", fly: "NONE", days: "2" })).toBeNull();
    expect(parsePackagePreset({ drone: "NEO2", fly: "RC_N3", batteries: "2", hours: "3" })).toEqual({ model: "NEO2", controller: "RC_N3", batteries: 2, minutes: 180 });
    expect(packageQuery({ model: "NEO2", controller: "NONE", batteries: 2, minutes: 120 })).toContain("hours=2");
  });

  it("leaves the daily rate out of the FAQ in every language", () => {
    for (const faq of [faqEn, faqMs, faqZh]) {
      const text = JSON.stringify(faq);
      expect(text).not.toContain("{maxDays}");
      expect(text).not.toContain("{dayRate}");
    }
  });
});
