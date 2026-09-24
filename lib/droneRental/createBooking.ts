import "server-only";
import { randomBytes } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { buildShopFleetSnapshot } from "./snapshot";
import { findNextAvailableSlot, InvalidDroneBookingRequestError } from "./slots";
import { rentalFeeMyr, DEPOSIT_MYR } from "./pricingRules";
import type { DrBookingRow, DrBookingSource } from "@/lib/db/types";

export { InvalidDroneBookingRequestError };

export class NoDroneAvailableError extends Error {
  constructor() {
    super("No drone is available for that time.");
    this.name = "NoDroneAvailableError";
  }
}

function generateSecureToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Finds a customer by phone (the durable identity for this vertical — no KYC/email verification gate here, unlike the locker network), or creates one. */
export async function findOrCreateCustomer(params: { name: string; phone: string; email: string }): Promise<string> {
  const supabase = createServiceRoleClient();
  const { data: existing } = await supabase.from("customers").select("id").eq("phone", params.phone).maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("customers")
    .insert({ name: params.name, phone: params.phone, email: params.email.toLowerCase() })
    .select("id")
    .single();
  if (error || !created) throw new Error("Could not create your customer record.");
  return created.id;
}

/**
 * Creates a PENDING_PAYMENT booking for the online flow: no minimum lead
 * time (unlike the locker network's 120-minute rule) — the earliest start is
 * just the next 30-minute slot at or after `earliestStartTime`, which may
 * end up later than requested if the shop's drones are all busy right then
 * (the caller should surface the booking's own start/end, not just echo
 * back what was asked for).
 */
export async function createPendingDroneBooking(params: {
  customerId: string;
  shopId: string;
  durationMinutes: number;
  earliestStartTime: Date;
}): Promise<DrBookingRow> {
  const supabase = createServiceRoleClient();

  const { data: shop } = await supabase.from("dr_shops").select("id,active").eq("id", params.shopId).single();
  if (!shop || !shop.active) throw new Error("This shop is not currently active.");

  const snapshot = await buildShopFleetSnapshot(params.shopId);
  const result = findNextAvailableSlot(snapshot.drones, snapshot.bookings, params.durationMinutes, params.earliestStartTime);
  if (result.outcome === "INFEASIBLE") throw new NoDroneAvailableError();

  return insertBooking(supabase, {
    customerId: params.customerId,
    shopId: params.shopId,
    droneId: result.droneId,
    startTime: result.startTime,
    endTime: result.endTime,
    source: "ONLINE",
  });
}

/**
 * Creates a PENDING_PAYMENT booking for a merchant walk-in — starts
 * literally now (no grid rounding: see lib/droneRental/merchantBooking.ts),
 * for a merchant-chosen duration already validated against
 * computeMerchantInstantOptions by the caller. `droneId` is fixed (the
 * merchant is standing at a specific shop with a specific drone in hand),
 * so this skips the fleet search entirely and just re-checks that exact
 * drone/window is actually free — the exclude constraint in
 * create_drone_booking_atomic is still the real backstop against a race.
 *
 * Goes through the same pay -> webhook -> CONFIRMED (+ deposit hold) path
 * as an online booking (see app/rent/b/[token]/pay/page.tsx) — the caller
 * should send the customer straight to that page next, on the merchant's
 * own device, rather than treating this booking as ready for pickup yet.
 */
export async function createMerchantInstantBooking(params: {
  customerId: string;
  shopId: string;
  droneId: string;
  durationMinutes: number;
  createdByStaffId: string;
}): Promise<DrBookingRow> {
  if (params.durationMinutes <= 0) {
    throw new InvalidDroneBookingRequestError(`durationMinutes must be positive, got ${params.durationMinutes}`);
  }
  const supabase = createServiceRoleClient();
  const startTime = new Date();
  const endTime = new Date(startTime.getTime() + params.durationMinutes * 60_000);

  return insertBooking(supabase, {
    customerId: params.customerId,
    shopId: params.shopId,
    droneId: params.droneId,
    startTime,
    endTime,
    source: "MERCHANT_INSTANT",
    createdByStaffId: params.createdByStaffId,
  });
}

async function insertBooking(
  supabase: ReturnType<typeof createServiceRoleClient>,
  params: {
    customerId: string;
    shopId: string;
    droneId: string;
    startTime: Date;
    endTime: Date;
    source: DrBookingSource;
    createdByStaffId?: string;
  }
): Promise<DrBookingRow> {
  const durationMinutes = (params.endTime.getTime() - params.startTime.getTime()) / 60_000;

  const { data: booking, error } = await supabase.rpc("create_drone_booking_atomic", {
    p_customer_id: params.customerId,
    p_shop_id: params.shopId,
    p_drone_id: params.droneId,
    p_start_time: params.startTime.toISOString(),
    p_end_time: params.endTime.toISOString(),
    p_rental_fee_myr: rentalFeeMyr(durationMinutes),
    p_deposit_myr: DEPOSIT_MYR,
    p_secure_token: generateSecureToken(),
    p_source: params.source,
    p_created_by_staff_id: params.createdByStaffId ?? null,
  });

  if (error) {
    // 23P01 = exclusion_violation — a concurrent booking won the race for
    // this exact drone/window between our feasibility check and this insert.
    if (error.code === "23P01") throw new NoDroneAvailableError();
    throw new Error(error.message);
  }
  if (!booking) throw new Error("Booking creation did not return a row.");
  return booking;
}
