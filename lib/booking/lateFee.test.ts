import { describe, expect, it } from "vitest";
import { computeLateFeeMyr, LATE_FEE_GRACE_MINUTES } from "./lateFee";

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

  it("charges nothing within the grace period", () => {
    expect(computeLateFeeMyr(END, new Date(END.getTime() + 20 * 60_000), 10)).toBe(0);
  });

  it("charges nothing at exactly the grace deadline", () => {
    expect(computeLateFeeMyr(END, new Date(END.getTime() + LATE_FEE_GRACE_MINUTES * 60_000), 10)).toBe(0);
  });

  it("charges one full hour for even a minute past the grace deadline", () => {
    expect(computeLateFeeMyr(END, new Date(END.getTime() + (LATE_FEE_GRACE_MINUTES + 1) * 60_000), 10)).toBe(10);
  });

  it("measures hours-late from the real end time, not the end of grace", () => {
    // 1h20m after end_time = 55 minutes past the 25-minute grace deadline,
    // but still only rounds up to 2 hours from end_time, not 1.
    const late = new Date(END.getTime() + 80 * 60_000);
    expect(computeLateFeeMyr(END, late, 10)).toBe(20);
  });

  it("rounds up partial hours", () => {
    expect(computeLateFeeMyr(END, new Date("2026-09-02T13:30:00Z"), 10)).toBe(20);
  });

  it("charges exactly N hours for an exact N-hour overage", () => {
    expect(computeLateFeeMyr(END, new Date("2026-09-02T15:00:00Z"), 10)).toBe(30);
  });
});
