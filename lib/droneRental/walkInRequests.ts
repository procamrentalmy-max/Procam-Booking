import "server-only";
import { randomBytes } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { buildShopFleetSnapshot } from "./snapshot";
import { eligibleWalkInDrones, walkInDurationsForShop } from "./merchantBooking";
import { findOrCreateCustomer, createMerchantInstantBooking, NoDroneAvailableError } from "./createBooking";
import { walkInExpiry, walkInView, type WalkInView } from "./walkIn";
import type { DrWalkInRequestRow } from "@/lib/db/types";
import { DEFAULT_DRONE_MODEL, ENABLED_DRONE_MODELS, includesController, isDroneModel, type BatteryCount, type DroneModel } from "./pricingRules";

export class WalkInError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WalkInError";
  }
}

function newPublicToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Open orders a shop will hold at once. A standing QR is public, so this stops it being used to flood the merchant's screen. */
export const MAX_OPEN_WALKIN_ORDERS_PER_SHOP = 10;

export async function findShopByWalkInCode(code: string): Promise<{ id: string; name: string; address: string } | null> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from("dr_shops").select("id,name,address,active").eq("walkin_code", code).maybeSingle();
  if (!data || !data.active) return null;
  return { id: data.id, name: data.name, address: data.address };
}

/** The lengths (in minutes) a customer scanning this shop's QR can choose right now for one model — only what some drone of that model at the shop can actually take. */
export async function walkInDurationOptions(shopId: string, model: DroneModel = DEFAULT_DRONE_MODEL): Promise<number[]> {
  const snapshot = await buildShopFleetSnapshot(shopId, model);
  return walkInDurationsForShop(snapshot.drones, snapshot.bookings, new Date());
}

/** The same, for every model: only models with at least one length on offer appear. */
export async function walkInOptionsByModel(shopId: string): Promise<Partial<Record<DroneModel, number[]>>> {
  const entries = await Promise.all(ENABLED_DRONE_MODELS.map(async (m) => [m, await walkInDurationOptions(shopId, m)] as const));
  return Object.fromEntries(entries.filter(([, durations]) => durations.length > 0));
}

export type SubmitWalkInOrderResult =
  | { ok: true; publicToken: string }
  | { ok: false; reason: "shop_not_found" | "length_unavailable" | "too_many_open" };

/**
 * A customer's walk-in order, made from the shop's standing QR: the length and batteries they chose plus their
 * own details. Nothing is booked and no drone is chosen yet — the merchant confirms it (and the drone is assigned)
 * from their dashboard, then the customer pays on their own phone.
 *
 * If this phone number already has an order waiting at the shop, that order is returned instead of making a second.
 */
export async function submitWalkInOrder(params: {
  walkinCode: string;
  durationMinutes: number;
  batteries: BatteryCount;
  model?: DroneModel;
  withController?: boolean;
  name: string;
  phone: string;
  email: string;
}): Promise<SubmitWalkInOrderResult> {
  const model = params.model ?? DEFAULT_DRONE_MODEL;
  const shop = await findShopByWalkInCode(params.walkinCode);
  if (!shop) return { ok: false, reason: "shop_not_found" };

  const supabase = createServiceRoleClient();
  const now = new Date();

  const { data: open } = await supabase
    .from("dr_walkin_requests")
    .select("public_token,customer_phone")
    .eq("shop_id", shop.id)
    .eq("status", "SUBMITTED")
    .gt("expires_at", now.toISOString());
  const existing = (open ?? []).find((r) => r.customer_phone === params.phone);
  if (existing) return { ok: true, publicToken: existing.public_token };
  if ((open ?? []).length >= MAX_OPEN_WALKIN_ORDERS_PER_SHOP) return { ok: false, reason: "too_many_open" };

  const allowed = await walkInDurationOptions(shop.id, model);
  if (!allowed.includes(params.durationMinutes)) return { ok: false, reason: "length_unavailable" };

  const publicToken = newPublicToken();
  const { error } = await supabase.from("dr_walkin_requests").insert({
    public_token: publicToken,
    shop_id: shop.id,
    drone_id: null,
    duration_minutes: params.durationMinutes,
    batteries_count: params.batteries,
    drone_model: model,
    with_controller: includesController(model, params.withController ?? true),
    status: "SUBMITTED",
    customer_name: params.name,
    customer_phone: params.phone,
    customer_email: params.email.toLowerCase(),
    submitted_at: now.toISOString(),
    expires_at: walkInExpiry(now).toISOString(),
  });
  if (error) throw new Error("Could not send your order. Please try again.");
  return { ok: true, publicToken };
}

export async function getWalkInRequestByToken(token: string): Promise<DrWalkInRequestRow | null> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from("dr_walkin_requests").select("*").eq("public_token", token).maybeSingle();
  return data ?? null;
}

export async function getWalkInRequestById(id: string): Promise<DrWalkInRequestRow | null> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from("dr_walkin_requests").select("*").eq("id", id).maybeSingle();
  return data ?? null;
}

export function viewOf(request: DrWalkInRequestRow, now: Date = new Date()): WalkInView {
  return walkInView(request.status, new Date(request.expires_at), now);
}

/** The drones that could be handed to this order right now, lowest number first. The merchant never picks one: the first is assigned. */
export async function eligibleDronesForRequest(request: DrWalkInRequestRow): Promise<{ id: string; humanId: string }[]> {
  const snapshot = await buildShopFleetSnapshot(request.shop_id, isDroneModel(request.drone_model) ? request.drone_model : DEFAULT_DRONE_MODEL);
  return eligibleWalkInDrones(snapshot.drones, snapshot.bookings, request.duration_minutes, new Date()).map((d) => ({ id: d.id, humanId: d.humanId }));
}

/**
 * The merchant confirms the customer's order: any free drone is assigned (the first one, by drone number; the
 * merchant doesn't choose), claims the request first (SUBMITTED -> ACCEPTED, only one caller can win), then creates the customer and
 * the booking, which the customer's phone then follows to payment. If booking creation fails — the drone got
 * booked in the meantime, say — the claim is released so the merchant can decline instead of being left with a
 * dead request.
 *
 * Availability is worked out here, at confirmation, not when the customer ordered: minutes may have passed and
 * another booking may have landed.
 */
export async function acceptWalkInRequest(requestId: string, staffId: string): Promise<{ bookingId: string; bookingToken: string }> {
  const supabase = createServiceRoleClient();
  const request = await getWalkInRequestById(requestId);
  if (!request) throw new WalkInError("Order not found.");
  if (viewOf(request) !== "SUBMITTED") throw new WalkInError("This order isn't waiting for confirmation.");
  if (!request.customer_name || !request.customer_phone || !request.customer_email) throw new WalkInError("The customer's details are missing.");

  const eligible = await eligibleDronesForRequest(request);
  const drone = eligible[0];
  if (!drone) throw new WalkInError("No drone is free for that long right now. Decline this order, or wait for a drone to come back.");

  const { data: claimed } = await supabase
    .from("dr_walkin_requests")
    .update({ status: "ACCEPTED", drone_id: drone.id })
    .eq("id", request.id)
    .eq("status", "SUBMITTED")
    .select("id");
  if (!claimed || claimed.length === 0) throw new WalkInError("This order was already handled.");

  try {
    const customerId = await findOrCreateCustomer({
      name: request.customer_name,
      phone: request.customer_phone,
      email: request.customer_email,
    });
    const booking = await createMerchantInstantBooking({
      customerId,
      shopId: request.shop_id,
      droneId: drone.id,
      durationMinutes: request.duration_minutes,
      batteries: request.batteries_count === 1 ? 1 : 2,
      model: isDroneModel(request.drone_model) ? request.drone_model : DEFAULT_DRONE_MODEL,
      withController: request.with_controller,
      createdByStaffId: staffId,
    });
    await supabase.from("dr_walkin_requests").update({ booking_id: booking.id }).eq("id", request.id);
    return { bookingId: booking.id, bookingToken: booking.secure_token };
  } catch (err) {
    await supabase.from("dr_walkin_requests").update({ status: "SUBMITTED", drone_id: null }).eq("id", request.id).eq("status", "ACCEPTED").is("booking_id", null);
    if (err instanceof NoDroneAvailableError) throw new WalkInError("That drone was just booked by someone else. Try confirming again.");
    throw err;
  }
}

/** The merchant turns the order away. Only open orders can be closed. */
export async function closeWalkInRequest(requestId: string, outcome: "DECLINED" | "CANCELLED"): Promise<void> {
  const supabase = createServiceRoleClient();
  await supabase.from("dr_walkin_requests").update({ status: outcome }).eq("id", requestId).in("status", ["WAITING", "SUBMITTED"]);
}
