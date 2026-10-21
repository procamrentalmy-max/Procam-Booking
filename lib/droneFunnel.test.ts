import { describe, expect, it } from "vitest";
import { countryFromHeaders, countryName, devicesByCountry, isTestTraffic } from "./droneFunnel";

const PHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const DESKTOP = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

describe("isTestTraffic", () => {
  it("never counts the local copy of the site, whatever the port", () => {
    expect(isTestTraffic("localhost:3000", DESKTOP)).toBe(true);
    expect(isTestTraffic("localhost", PHONE)).toBe(true);
    expect(isTestTraffic("127.0.0.1:3000", DESKTOP)).toBe(true);
    expect(isTestTraffic("[::1]:3000", DESKTOP)).toBe(true);
    expect(isTestTraffic("app.localhost:3000", DESKTOP)).toBe(true);
  });

  it("never counts automated browsers and bots", () => {
    expect(isTestTraffic("procambooking.app", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/126.0.0.0 Safari/537.36")).toBe(true);
    expect(isTestTraffic("procambooking.app", "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")).toBe(true);
    expect(isTestTraffic("procambooking.app", "Lighthouse")).toBe(true);
    expect(isTestTraffic("procambooking.app", "Mozilla/5.0 Playwright")).toBe(true);
  });

  it("counts real phones and computers on the real site", () => {
    expect(isTestTraffic("procambooking.app", PHONE)).toBe(false);
    expect(isTestTraffic("procambooking.app", DESKTOP)).toBe(false);
    expect(isTestTraffic("procam-booking.vercel.app", DESKTOP)).toBe(false);
  });

  it("counts a visit with nothing to go on (no header) as real rather than hiding a customer", () => {
    expect(isTestTraffic(null, null)).toBe(false);
    expect(isTestTraffic(undefined, "")).toBe(false);
  });
});

describe("countryFromHeaders", () => {
  const headers = (h: Record<string, string>) => (name: string) => h[name] ?? null;

  it("reads the code the host passes along, in capitals", () => {
    expect(countryFromHeaders(headers({ "x-vercel-ip-country": "MY" }))).toBe("MY");
    expect(countryFromHeaders(headers({ "x-vercel-ip-country": "sg" }))).toBe("SG");
    expect(countryFromHeaders(headers({ "cf-ipcountry": "ID" }))).toBe("ID");
  });

  it("is null when there is nothing, or the network does not know", () => {
    expect(countryFromHeaders(headers({}))).toBeNull();
    expect(countryFromHeaders(headers({ "x-vercel-ip-country": "" }))).toBeNull();
    expect(countryFromHeaders(headers({ "cf-ipcountry": "XX" }))).toBeNull();
    expect(countryFromHeaders(headers({ "cf-ipcountry": "T1" }))).toBeNull();
  });

  it("never keeps anything but a two-letter code", () => {
    expect(countryFromHeaders(headers({ "x-vercel-ip-country": "Malaysia" }))).toBeNull();
    expect(countryFromHeaders(headers({ "x-vercel-ip-country": "203.0.113.7" }))).toBeNull();
    expect(countryFromHeaders(headers({ "x-vercel-ip-country": "M1" }))).toBeNull();
  });
});

describe("countryName", () => {
  it("gives the English name, and 'Not known' for none", () => {
    expect(countryName("MY")).toBe("Malaysia");
    expect(countryName("SG")).toBe("Singapore");
    expect(countryName(null)).toBe("Not known");
  });
});

describe("devicesByCountry", () => {
  it("counts a device once, under its country, biggest first, with 'not known' last", () => {
    const rows = [
      { session_id: "a", country: "MY" },
      { session_id: "a", country: "MY" },
      { session_id: "b", country: "SG" },
      { session_id: "c", country: "MY" },
      { session_id: "d", country: null },
    ];
    const groups = devicesByCountry(rows).map((g) => [g.country, g.devices.size]);
    expect(groups).toEqual([["MY", 2], ["SG", 1], [null, 1]]);
  });

  it("uses the country of a later row when the first one had none", () => {
    const groups = devicesByCountry([{ session_id: "a", country: null }, { session_id: "a", country: "MY" }]).map((g) => [g.country, g.devices.size]);
    expect(groups).toEqual([["MY", 1]]);
  });
});
