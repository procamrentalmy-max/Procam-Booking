import { describe, expect, it } from "vitest";
import { walkInView, walkInExpiry, WALKIN_REQUEST_TTL_MINUTES } from "./walkIn";

const now = new Date("2026-10-03T10:00:00Z");
const future = new Date("2026-10-03T10:10:00Z");
const past = new Date("2026-10-03T09:59:00Z");

describe("walkInExpiry", () => {
  it("is the TTL after now", () => {
    expect(walkInExpiry(now).getTime() - now.getTime()).toBe(WALKIN_REQUEST_TTL_MINUTES * 60_000);
  });
});

describe("walkInView", () => {
  it("passes the stored status through while the request is still open", () => {
    expect(walkInView("WAITING", future, now)).toBe("WAITING");
    expect(walkInView("SUBMITTED", future, now)).toBe("SUBMITTED");
  });

  it("reads an unaccepted request past its expiry as EXPIRED", () => {
    expect(walkInView("WAITING", past, now)).toBe("EXPIRED");
    expect(walkInView("SUBMITTED", past, now)).toBe("EXPIRED");
  });

  it("treats the exact expiry instant as expired", () => {
    expect(walkInView("WAITING", now, now)).toBe("EXPIRED");
  });

  it("never expires a request that has already been accepted — its booking exists", () => {
    expect(walkInView("ACCEPTED", past, now)).toBe("ACCEPTED");
  });

  it("leaves declined and cancelled requests as they are", () => {
    expect(walkInView("DECLINED", past, now)).toBe("DECLINED");
    expect(walkInView("CANCELLED", past, now)).toBe("CANCELLED");
  });
});
