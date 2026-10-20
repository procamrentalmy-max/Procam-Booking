"use client";

import { useEffect } from "react";
import { logDroneFunnelAction, logLocationEventAction } from "@/app/funnelActions";
import { DEVICE_ID_KEY, FUNNEL_PAYING_KEY, FUNNEL_SESSION_KEY, type DroneFunnelStep } from "@/lib/droneFunnel";

/**
 * A random id for this browser on this device, kept for good (localStorage), so the same device is counted once however many times it comes back,
 * not once per visit. It is not linked to a person or an account. Where the browser has no lasting memory it falls back to the tab's own, and where
 * it has neither (a private window, say) that visit simply isn't counted.
 */
function sessionId(): string | null {
  const make = () => crypto.randomUUID();
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = make();
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    try {
      let id = sessionStorage.getItem(FUNNEL_SESSION_KEY);
      if (!id) {
        id = make();
        sessionStorage.setItem(FUNNEL_SESSION_KEY, id);
      }
      return id;
    } catch {
      return null;
    }
  }
}

/** Counts that this device reached a step of the booking flow (see lib/droneFunnel.ts). Never breaks the page it is called from. */
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

/** Counts something a visit did with a location (see logLocationEventAction). Never breaks the page it is called from. */
export function trackLocation(kind: "SELECT" | "OPEN" | "DIRECTIONS", shopId: string): void {
  try {
    const id = sessionId();
    if (id) void logLocationEventAction({ sessionId: id, shopId, kind }).catch(() => {});
  } catch {
    // counting is best effort
  }
}

/** On a location's page: counts that this visit opened it, whether it is open for booking or only shows the rates. */
export function LocationBeacon({ shopId }: { shopId: string }) {
  useEffect(() => {
    trackLocation("OPEN", shopId);
  }, [shopId]);
  return null;
}
