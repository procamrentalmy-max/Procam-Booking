import { describe, expect, it } from "vitest";
import { openGaps, openGapsMessage } from "./openReadiness";
import { DEFAULT_SHOP_HOURS } from "./hours";

const ready = { address: "Port Dickson Beach, Negeri Sembilan", lat: 2.4571, lng: 101.8588, hours: DEFAULT_SHOP_HOURS, workingDrones: 3, batteries: 7 };

describe("openGaps", () => {
  it("is empty for a location with everything", () => {
    expect(openGaps(ready)).toEqual([]);
  });
  it("asks for an address and a map position", () => {
    expect(openGaps({ ...ready, address: "" })).toHaveLength(1);
    expect(openGaps({ ...ready, address: "Address to be added" })).toHaveLength(1);
    expect(openGaps({ ...ready, lat: 0, lng: 0 })).toHaveLength(1);
  });
  it("asks for at least one open day", () => {
    expect(openGaps({ ...ready, hours: Array(7).fill(null) })[0]).toContain("opening hours");
  });
  it("asks for a drone and a battery", () => {
    expect(openGaps({ ...ready, workingDrones: 0, batteries: 0 })).toHaveLength(2);
  });
  it("lists everything missing in one message", () => {
    const msg = openGapsMessage(openGaps({ ...ready, address: "", workingDrones: 0 }));
    expect(msg).toContain("address");
    expect(msg).toContain("drone");
  });
});
