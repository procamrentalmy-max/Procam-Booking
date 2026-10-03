import { describe, expect, it } from "vitest";
import { checkInView } from "./checkIn";

describe("checkInView", () => {
  it("offers Accept for a paid booking that hasn't been accepted", () => {
    expect(checkInView({ status: "CONFIRMED", checked_in_at: null })).toBe("READY");
  });

  it("treats an accepted booking's QR as used", () => {
    expect(checkInView({ status: "CONFIRMED", checked_in_at: "2026-10-03T02:00:00Z" })).toBe("ALREADY_ACCEPTED");
  });

  it("treats the QR as used once the rental has started or finished, even with no check-in recorded", () => {
    expect(checkInView({ status: "ACTIVE", checked_in_at: null })).toBe("ALREADY_ACCEPTED");
    expect(checkInView({ status: "COMPLETED", checked_in_at: null })).toBe("ALREADY_ACCEPTED");
  });

  it("has nothing to accept before payment", () => {
    expect(checkInView({ status: "PENDING_PAYMENT", checked_in_at: null })).toBe("NOT_PAID");
  });

  it("has nothing to accept for a cancelled or expired booking", () => {
    expect(checkInView({ status: "CANCELLED", checked_in_at: null })).toBe("CLOSED");
    expect(checkInView({ status: "EXPIRED", checked_in_at: null })).toBe("CLOSED");
  });
});
