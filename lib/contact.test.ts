import { describe, expect, it } from "vitest";
import { isValidEmail, normalizePhone, splitPhone, countryOptions } from "./contact";

describe("normalizePhone", () => {
  it("writes a Malaysian number in full international form, however it is typed", () => {
    expect(normalizePhone("012-345 6789")).toBe("+60123456789");
    expect(normalizePhone("+60 12-345 6789")).toBe("+60123456789");
    expect(normalizePhone("0123456789", "MY")).toBe("+60123456789");
    expect(normalizePhone("123456789", "MY")).toBe("+60123456789");
  });
  it("reads a number as the country that was picked", () => {
    expect(normalizePhone("8123 4567", "SG")).toBe("+6581234567");
    expect(normalizePhone("+44 7911 123456")).toBe("+447911123456");
  });
  it("refuses numbers that are not valid for the country", () => {
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("abc")).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("0123", "MY")).toBeNull();
    expect(normalizePhone("+60 99999999999999")).toBeNull();
  });
});

describe("isValidEmail", () => {
  it("accepts normal addresses", () => {
    for (const e of ["a@b.co", "name.surname@example.com", "n+tag@mail.example.com.my", "x_y-z@sub.domain.org"]) expect(isValidEmail(e)).toBe(true);
  });
  it("refuses broken ones", () => {
    for (const e of ["", "abc", "a@b", "a@b.", "@b.com", "a b@c.com", "a@b..com", "a@@b.com", "a@b.c", ".a@b.com", "a.@b.com", "a@-b.com"]) expect(isValidEmail(e)).toBe(false);
  });
});

describe("country codes", () => {
  it("lists Malaysia first with +60", () => {
    const first = countryOptions()[0];
    expect(first.code).toBe("MY");
    expect(first.dial).toBe("+60");
    expect(countryOptions().length).toBeGreaterThan(200);
  });
  it("splits a saved number back into country and number", () => {
    expect(splitPhone("+60123456789")).toEqual({ country: "MY", national: "123456789" });
    expect(splitPhone("+6581234567")).toEqual({ country: "SG", national: "81234567" });
    expect(splitPhone("")).toEqual({ country: "MY", national: "" });
  });
});
