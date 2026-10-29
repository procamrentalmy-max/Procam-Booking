import { describe, expect, it } from "vitest";
import { REFERRAL_COOKIE_MAX_AGE_SECONDS, REFERRAL_DAYS, REFERRER_SHARE, flyerUrl, isFlyerCode, makeFlyerCode, parseReferralCookie, referralCookieValue } from "./referral";

describe("flyer codes", () => {
  it("are 8 characters from an alphabet with no look-alikes, for any random bytes", () => {
    const code = makeFlyerCode((n) => Array.from({ length: n }, (_, i) => i * 37 + 5));
    expect(code).toHaveLength(8);
    expect(code).toMatch(/^[a-hj-km-np-z2-9]{8}$/);
    for (let seed = 0; seed < 50; seed++) {
      expect(makeFlyerCode((n) => Array.from({ length: n }, (_, i) => (seed * 31 + i * 17) % 256))).toMatch(/^[a-hj-km-np-z2-9]{8}$/);
    }
  });

  it("are checked before anything is looked up", () => {
    expect(isFlyerCode("abc23456")).toBe(true);
    expect(isFlyerCode("ABCdef12")).toBe(true);
    expect(isFlyerCode("short")).toBe(false);
    expect(isFlyerCode("has-dash1")).toBe(false);
    expect(isFlyerCode("../etc/pa")).toBe(false);
    expect(isFlyerCode(undefined)).toBe(false);
  });
});

describe("the flyer address and cookie", () => {
  it("points the QR at a fixed address, so a printed flyer keeps working", () => {
    expect(flyerUrl("abc23456")).toBe("https://procambooking.app/go/abc23456");
  });

  it("remembers the flyer and the phone, and reads them back", () => {
    const value = referralCookieValue("abc23456", "0f8fad5b-d9cb-469f-a165-70867728950e");
    expect(parseReferralCookie(value)).toEqual({ code: "abc23456", visitorId: "0f8fad5b-d9cb-469f-a165-70867728950e" });
  });

  it("ignores a cookie that is missing or not in that shape", () => {
    expect(parseReferralCookie(undefined)).toBeNull();
    expect(parseReferralCookie("")).toBeNull();
    expect(parseReferralCookie("abc23456")).toBeNull();
    expect(parseReferralCookie("abc23456.short")).toBeNull();
    expect(parseReferralCookie("abc 23456.0f8fad5b-d9cb-469f-a165-70867728950e")).toBeNull();
  });

  it("lasts 7 days, and the flyer place gets 10%", () => {
    expect(REFERRAL_DAYS).toBe(7);
    expect(REFERRAL_COOKIE_MAX_AGE_SECONDS).toBe(7 * 24 * 60 * 60);
    expect(REFERRER_SHARE).toBe(0.1);
  });
});
