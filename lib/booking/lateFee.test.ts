import { describe, expect, it } from "vitest";
import { computeLateFeeMyr } from "./lateFee";

const END = new Date("2026-09-02T12:00:00Z");

describe("computeLateFeeMyr", () => {
  it("charges nothing when returned on time", () => {
    expect(computeLateFeeMyr(END, END, 10)).toBe(0);
  });

  it("charges nothing when returned early", () => {
    expect(computeLateFeeMyr(END, new Date("2026-09-02T11:00:00Z"), 10)).toBe(0);
  });

  it("charges nothing when the package has no late fee configured", () => {
    expect(computeLateFeeMyr(END, new Date("2026-09-02T15:00:00Z"), 0)).toBe(0);
  });

  it("charges one full hour for even a minute late", () => {
    expect(computeLateFeeMyr(END, new Date("2026-09-02T12:01:00Z"), 10)).toBe(10);
  });

  it("rounds up partial hours", () => {
    expect(computeLateFeeMyr(END, new Date("2026-09-02T13:30:00Z"), 10)).toBe(20);
  });

  it("charges exactly N hours for an exact N-hour overage", () => {
    expect(computeLateFeeMyr(END, new Date("2026-09-02T15:00:00Z"), 10)).toBe(30);
  });
});
