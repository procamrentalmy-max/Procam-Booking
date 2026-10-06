// A partner's (merchant's) earnings, as set out in the Partner Program pitch: what the customer pays is the booking
// income; platform, payment processing, KYC and insurance costs come off it (32% in total); what is left is split
// 50 / 50 between the partner and ProCam. Worked example from the pitch: RM30 booking, costs RM9.60, net RM20.40,
// RM10.20 each.
//
// When the customer pays cash, no payment processor is involved, so the 4% payment-processing cost does not apply
// and the costs are 28%.

import type { DrPaidBy } from "@/lib/db/types";

export const COST_SHARES = {
  platform: 0.18,
  payment: 0.04,
  kyc: 0.02,
  insurance: 0.08,
} as const;

/** The partner's share of what is left after costs. */
export const PARTNER_SHARE = 0.5;

export type CostKey = keyof typeof COST_SHARES;

/** The cost shares that apply to a booking: all four by card, without payment processing for cash. */
export function costSharesFor(paidBy: DrPaidBy): Record<CostKey, number> {
  return { ...COST_SHARES, payment: paidBy === "CASH" ? 0 : COST_SHARES.payment };
}

export type Earnings = {
  /** What the customer paid (the booking income the percentages are taken from). */
  income: number;
  costs: Record<CostKey, number>;
  totalCosts: number;
  net: number;
  /** The partner's 50%. */
  partner: number;
  /** ProCam's 50%. */
  procam: number;
};

export function earningsFor(income: number, paidBy: DrPaidBy): Earnings {
  const shares = costSharesFor(paidBy);
  const costs = {
    platform: income * shares.platform,
    payment: income * shares.payment,
    kyc: income * shares.kyc,
    insurance: income * shares.insurance,
  };
  const totalCosts = costs.platform + costs.payment + costs.kyc + costs.insurance;
  const net = income - totalCosts;
  return { income, costs, totalCosts, net, partner: net * PARTNER_SHARE, procam: net * (1 - PARTNER_SHARE) };
}
