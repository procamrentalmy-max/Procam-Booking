import "server-only";
import { randomBytes } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { buildShopFleetSnapshot } from "./snapshot";
import { alignToNextInterval, findEligibleDrone, findEligibleResources, InvalidDroneBookingRequestError } from "./slots";
import {
  rentalFeeMyr,
  depositMyrFor,
  effectiveController,
  controllerLabel,
  DEFAULT_CONTROLLER,
  DEFAULT_DRONE_MODEL,
  type BatteryCount,
  type ControllerKind,
  type DroneModel,
} from "./pricingRules";
import type { DrBookingRow, DrBookingSource } from "@/lib/db/types";

export { InvalidDroneBookingRequestError };

export class NoDroneAvailableError extends Error {
  constructor() {
    super("No drone is available for that time.");
    this.name = "NoDroneAvailableError";
  }
}

/** A drone is free but the controller asked for isn't (the shop has none of that kind, or the one it has is out). */
export class NoControllerAvailableError extends Error {
  constructor(readonly controller: string) {
    super(`The ${controller} isn't free for that time.`);
    this.name = "NoControllerAvailableError";
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
 * time (unlike the locker network's 120-minute rule). Books EXACTLY the slot
 * the customer picked: if a drone was free when the grid was drawn but has
 * been taken since, this throws NoDroneAvailableError so the customer is told
 * and picks again — it never quietly moves them to a different time, which
 * they'd only notice (if at all) on the payment page.
 */
export async function createPendingDroneBooking(params: {
  customerId: string;
  shopId: string;
  durationMinutes: number;
  startTime: Date;
  batteries: BatteryCount;
  model?: DroneModel;
  /** How the customer flies it: their own phone, the RC-N3 or the goggles set (default the RC-N3). */
  controller?: ControllerKind;
}): Promise<DrBookingRow> {
  const supabase = createServiceRoleClient();
  const model = params.model ?? DEFAULT_DRONE_MODEL;
  const controller = effectiveController(model, params.controller ?? DEFAULT_CONTROLLER);

  const { data: shop } = await supabase.from("dr_shops").select("id,active").eq("id", params.shopId).single();
  if (!shop || !shop.active) throw new Error("This shop is not currently active.");
  if (params.durationMinutes <= 0) throw new InvalidDroneBookingRequestError(`durationMinutes must be positive, got ${params.durationMinutes}`);

  const startTime = alignToNextInterval(params.startTime);
  if (startTime.getTime() < Date.now() - 60_000) throw new NoDroneAvailableError();
  const endTime = new Date(startTime.getTime() + params.durationMinutes * 60_000);

  const snapshot = await buildShopFleetSnapshot(params.shopId, model, controller);
  const free = findEligibleResources(snapshot.drones, snapshot.bookings, snapshot.controllers, startTime, endTime);
  if (!free) throw new NoDroneAvailableError();

  return insertBooking(supabase, {
    customerId: params.customerId,
    shopId: params.shopId,
    droneId: free.droneId,
    controllerId: free.controllerId,
    startTime,
    endTime,
    source: "ONLINE",
    batteries: params.batteries,
    model,
    controller,
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
  batteries: BatteryCount;
  model?: DroneModel;
  controller?: ControllerKind;
  createdByStaffId: string;
}): Promise<DrBookingRow> {
  if (params.durationMinutes <= 0) {
    throw new InvalidDroneBookingRequestError(`durationMinutes must be positive, got ${params.durationMinutes}`);
  }
  const supabase = createServiceRoleClient();
  const startTime = new Date();
  const endTime = new Date(startTime.getTime() + params.durationMinutes * 60_000);
  const model = params.model ?? DEFAULT_DRONE_MODEL;
  const controller = effectiveController(model, params.controller ?? DEFAULT_CONTROLLER);

  // The drone is the merchant's to pick; the controller is whichever one of that kind the shop has free for the whole rental.
  let controllerId: string | null = null;
  if (controller !== "NONE") {
    const snapshot = await buildShopFleetSnapshot(params.shopId, model, controller);
    controllerId = snapshot.controllers ? findEligibleDrone(snapshot.controllers.candidates, snapshot.controllers.bookings, startTime, endTime) : null;
    if (!controllerId) throw new NoControllerAvailableError(controllerLabel(model, controller));
  }

  return insertBooking(supabase, {
    customerId: params.customerId,
    shopId: params.shopId,
    droneId: params.droneId,
    controllerId,
    startTime,
    endTime,
    source: "MERCHANT_INSTANT",
    createdByStaffId: params.createdByStaffId,
    batteries: params.batteries,
    model,
    controller,
  });
}

async function insertBooking(
  supabase: ReturnType<typeof createServiceRoleClient>,
  params: {
    customerId: string;
    shopId: string;
    droneId: string;
    controllerId: string | null;
    startTime: Date;
    endTime: Date;
    source: DrBookingSource;
    createdByStaffId?: string;
    batteries: BatteryCount;
    model: DroneModel;
    controller: ControllerKind;
  }
): Promise<DrBookingRow> {
  const durationMinutes = (params.endTime.getTime() - params.startTime.getTime()) / 60_000;

  const { data: booking, error } = await supabase.rpc("create_drone_booking_atomic", {
    p_customer_id: params.customerId,
    p_shop_id: params.shopId,
    p_drone_id: params.droneId,
    p_start_time: params.startTime.toISOString(),
    p_end_time: params.endTime.toISOString(),
    p_rental_fee_myr: rentalFeeMyr(durationMinutes, params.batteries, params.model, params.controller),
    p_deposit_myr: depositMyrFor(params.model, params.controller),
    p_secure_token: generateSecureToken(),
    p_source: params.source,
    p_created_by_staff_id: params.createdByStaffId ?? null,
    p_batteries_count: params.batteries,
    p_drone_model: params.model,
    p_controller_kind: params.controller,
    p_controller_id: params.controllerId,
  });

  if (error) {
    // 23P01 = exclusion_violation — a concurrent booking won the race for
    // this exact drone (or controller) / window between our feasibility check and this insert.
    if (error.code === "23P01") throw new NoDroneAvailableError();
    throw new Error(error.message);
  }
  if (!booking) throw new Error("Booking creation did not return a row.");
  return booking;
}
