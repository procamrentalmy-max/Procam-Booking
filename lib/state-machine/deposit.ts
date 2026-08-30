import type { DepositStatus } from "@/lib/db/types";

/**
 * Deposit status transitions (spec section 6 / plan section 3).
 *
 * RELEASED only follows an inspection PASS. CAPTURED/PARTIALLY_CAPTURED only
 * follow an admin decision on a DAMAGE_REVIEW booking — never a reception or
 * ProCam-staff action. This module is the enforcement point for that rule;
 * callers pass the actor role in and get rejected before any write happens.
 */
export const DEPOSIT_TRANSITIONS: Record<DepositStatus, DepositStatus[]> = {
  AUTHORIZED: ["RELEASED", "CAPTURED", "PARTIALLY_CAPTURED", "VOIDED", "EXPIRED"],
  RELEASED: [],
  CAPTURED: [],
  PARTIALLY_CAPTURED: [],
  VOIDED: [],
  EXPIRED: [],
};

export type DepositActor = "SYSTEM" | "ADMIN";

const ADMIN_ONLY_TARGETS: DepositStatus[] = ["CAPTURED", "PARTIALLY_CAPTURED"];

export class InvalidDepositTransitionError extends Error {
  constructor(from: DepositStatus, to: DepositStatus) {
    super(`Deposit cannot transition from ${from} to ${to}`);
    this.name = "InvalidDepositTransitionError";
  }
}

export class UnauthorizedDepositActionError extends Error {
  constructor(to: DepositStatus) {
    super(`Only an admin may move a deposit to ${to}`);
    this.name = "UnauthorizedDepositActionError";
  }
}

export function assertValidDepositTransition(from: DepositStatus, to: DepositStatus, actor: DepositActor): void {
  if (!DEPOSIT_TRANSITIONS[from].includes(to)) {
    throw new InvalidDepositTransitionError(from, to);
  }
  if (ADMIN_ONLY_TARGETS.includes(to) && actor !== "ADMIN") {
    throw new UnauthorizedDepositActionError(to);
  }
}
