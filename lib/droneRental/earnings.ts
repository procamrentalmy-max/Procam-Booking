// A partner's (merchant's) earnings, following the Partner Program pitch: what customers pay is the booking income; the
// platform, payment, identity-check and insurance costs come off it; what is left is split 50 / 50 between the partner
// and ProCam.
//
// The pitch gave every cost as a flat percentage (platform 18%, payment 4%, KYC 2%, insurance 8%). Platform and insurance
// stay percentages. The other two are worked out from what they really cost:
//   - payment processing: Stripe charges a percentage plus a fixed RM1 on every card payment, so it is charged per
//     payment, and not at all on cash;
//   - KYC: a flat RM1.00 for every drone booking.

import type { DrPaidBy } from "@/lib/db/types";

export const PLATFORM_RATE = 0.18;
export const INSURANCE_RATE = 0.08;

/**
 * Stripe Malaysia: 3% + RM1 on domestic cards, 4% + RM1 on international cards. About one card in ten is assumed to be
 * international, which makes the percentage 3.1%.
 */
export const CARD_FEE_RATE = 0.031;
export const CARD_FEE_FIXED_MYR = 1;

/** The identity check, per drone booking. */
export const KYC_PER_BOOKING_MYR = 1;

/** The partner's share of what is left after costs. */
export const PARTNER_SHARE = 0.5;

export type CostKey = "platform" | "payment" | "kyc" | "insurance";

/** One payment a customer made on a booking (the rental fee, a swap, a late fee), by card or in cash. */
export type Payment = { amount: number; method: DrPaidBy };

export type Earnings = {
  /** What the customer paid (the booking income the costs are taken from). */
  income: number;
  costs: Record<CostKey, number>;
  totalCosts: number;
  net: number;
  /** The partner's 50%. */
  partner: number;
  /** ProCam's 50%. */
  procam: number;
};

/** The card fee on one payment: nothing for cash, otherwise a percentage plus the fixed RM1. */
export function cardFeeFor(payment: Payment): number {
  return payment.method === "CASH" || payment.amount <= 0 ? 0 : payment.amount * CARD_FEE_RATE + CARD_FEE_FIXED_MYR;
}

export const ZERO_EARNINGS: Earnings = { income: 0, costs: { platform: 0, payment: 0, kyc: 0, insurance: 0 }, totalCosts: 0, net: 0, partner: 0, procam: 0 };

/** The earnings from one booking, from the payments made on it. The identity check is charged once per booking. */
export function earningsForBooking(payments: Payment[]): Earnings {
  const paid = payments.filter((p) => p.amount > 0);
  if (paid.length === 0) return ZERO_EARNINGS;
  const income = paid.reduce((sum, p) => sum + p.amount, 0);
  const costs = {
    platform: income * PLATFORM_RATE,
    payment: paid.reduce((sum, p) => sum + cardFeeFor(p), 0),
    kyc: KYC_PER_BOOKING_MYR,
    insurance: income * INSURANCE_RATE,
  };
  const totalCosts = costs.platform + costs.payment + costs.kyc + costs.insurance;
  const net = income - totalCosts;
  return { income, costs, totalCosts, net, partner: net * PARTNER_SHARE, procam: net * (1 - PARTNER_SHARE) };
}

export function addEarnings(a: Earnings, b: Earnings): Earnings {
  return {
    income: a.income + b.income,
    costs: {
      platform: a.costs.platform + b.costs.platform,
      payment: a.costs.payment + b.costs.payment,
      kyc: a.costs.kyc + b.costs.kyc,
      insurance: a.costs.insurance + b.costs.insurance,
    },
    totalCosts: a.totalCosts + b.totalCosts,
    net: a.net + b.net,
    partner: a.partner + b.partner,
    procam: a.procam + b.procam,
  };
}
