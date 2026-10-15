import type { Dictionary } from "@/lib/i18n/dictionaries";
import { CONTROLLER_PROFILES, DRONE_MODEL_PROFILES, depositMyrFor, formatMyr, hourlyRateFor, type ControllerKind, type DroneModel } from "./pricingRules";

export type TableGroup = { title: string; rows: string[][] };

/** One comparison table, as plain data (it crosses from the server pages to the client components). `keys[i]` is what column `i` stands for. */
export type CompareData<K extends string> = { title: string; sub: string; source?: string; heads: string[]; keys: K[]; groups: TableGroup[]; label: string };
export type CompareTables = { drone: CompareData<DroneModel>; fly: CompareData<ControllerKind> };

/**
 * The two comparison tables of the landing page (the DJI Neo next to the Neo 2; phone only, RC-N3 or goggles), built once for the landing
 * page and for the Compare buttons beside the choices. Every price comes from the same pricing rules the booking flow charges with, so the
 * tables can't drift from them.
 */
export function buildCompareTables(home: Dictionary["home"]): CompareTables {
  const c = home.compare;
  const fly = home.fly;
  const neo = DRONE_MODEL_PROFILES.NEO;
  const neo2 = DRONE_MODEL_PROFILES.NEO2;
  const both = (pick: (p: typeof neo) => number) => [formatMyr(pick(neo)), formatMyr(pick(neo2))];
  const droneGroups: TableGroup[] = [
    {
      title: c.priceGroup,
      rows: [
        [c.priceRows.perHour, formatMyr(hourlyRateFor("NEO", "NONE")), formatMyr(hourlyRateFor("NEO2", "NONE"))],
        [c.priceRows.battery1, ...both((p) => p.batteryFeeMyr[1])],
        [c.priceRows.battery2, ...both((p) => p.batteryFeeMyr[2])],
        [c.priceRows.swap1, ...both((p) => p.batteryFeeMyr[1])],
        [c.priceRows.swap2, ...both((p) => p.batteryFeeMyr[2])],
        [c.priceRows.late, formatMyr(hourlyRateFor("NEO", "NONE")), formatMyr(hourlyRateFor("NEO2", "NONE"))],
        [c.priceRows.deposit, formatMyr(depositMyrFor("NEO", "NONE")), formatMyr(depositMyrFor("NEO2", "NONE"))],
      ],
    },
    { title: c.specsGroup, rows: c.specs.map((r) => [r.label, r.neo, r.neo2]) },
  ];

  const rc = CONTROLLER_PROFILES.RC_N3;
  const gog = CONTROLLER_PROFILES.GOGGLES_N3;
  const flyGroups: TableGroup[] = [
    {
      title: "",
      rows: [
        [fly.extraHour, "—", `+${formatMyr(rc.hourlyMyr)}`, `+${formatMyr(gog.hourlyMyr)}`],
        [fly.extraDeposit, "—", `+${formatMyr(rc.depositMyr)}`, `+${formatMyr(gog.depositMyr)}`],
        [fly.needsPhone, "✓", "✓", "✗"],
        ...fly.rows.map((r) => [r.label, r.phone, r.rc, r.goggles]),
      ],
    },
  ];

  return {
    drone: { title: c.title, sub: c.sub, source: c.source, heads: [c.neo, c.neo2], keys: ["NEO", "NEO2"], groups: droneGroups, label: c.title },
    fly: { title: fly.title, sub: fly.sub, heads: [fly.phone, fly.rc, fly.goggles], keys: ["NONE", "RC_N3", "GOGGLES_N3"], groups: flyGroups, label: fly.option },
  };
}
