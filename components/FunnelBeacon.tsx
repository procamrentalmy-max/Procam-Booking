"use client";

import { useEffect } from "react";
import { logDroneFunnelAction } from "@/app/funnelActions";
import { FUNNEL_PAYING_KEY, FUNNEL_SESSION_KEY, type DroneFunnelStep } from "@/lib/droneFunnel";

function sessionId(): string | null {
  try {
    let id = sessionStorage.getItem(FUNNEL_SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(FUNNEL_SESSION_KEY, id);
    }
    return id;
  } catch {
    return null; // no tab memory (a private window, say): that visit simply isn't counted
  }
}

/** Counts that this visit reached a step of the booking flow (see lib/droneFunnel.ts). Never breaks the page it is called from. */
export function trackStep(step: DroneFunnelStep, shopId?: string): void {
  try {
    const id = sessionId();
    if (id) void logDroneFunnelAction({ sessionId: id, step, shopId }).catch(() => {});
  } catch {
    // counting is best effort
  }
}

/** Put on a page to count it as a step when it opens. On the payment page it also notes that this tab is paying, so "Paid" is counted once, by the visit that paid. */
export function FunnelBeacon({ step, shopId }: { step: DroneFunnelStep; shopId?: string }) {
  useEffect(() => {
    trackStep(step, shopId);
    if (step === "PAY") {
      try {
        sessionStorage.setItem(FUNNEL_PAYING_KEY, "1");
      } catch {
        // ignore
      }
    }
  }, [step, shopId]);
  return null;
}

/** On the booking page of a paid booking: if this tab came through the payment page, counts "Paid" once. */
export function PaidBeacon() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem(FUNNEL_PAYING_KEY)) {
        sessionStorage.removeItem(FUNNEL_PAYING_KEY);
        trackStep("PAID");
      }
    } catch {
      // ignore
    }
  }, []);
  return null;
}
