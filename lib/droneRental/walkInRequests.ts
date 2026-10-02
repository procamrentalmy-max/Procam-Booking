import "server-only";
import { randomBytes } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { buildShopFleetSnapshot } from "./snapshot";
import { computeMerchantInstantOptions } from "./merchantBooking";
import { findOrCreateCustomer, createMerchantInstantBooking, NoDroneAvailableError } from "./createBooking";
import { walkInExpiry, walkInView, type WalkInView } from "./walkIn";
import type { DrWalkInRequestRow } from "@/lib/db/types";

export class WalkInError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WalkInError";
  }
}

function newPublicToken(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * Starts a walk-in: checks the drone really is free for this long right
 * now (same rule the old typed-in flow used), then stores a request the
 * customer can fill in from a QR code. No booking exists yet.
 */
export async function createWalkInRequest(params: {
  shopId: string;
  droneId: string;
  durationMinutes: number;
  createdByStaffId: string;
}): Promise<{ id: string; publicToken: string }> {
  const supabase = createServiceRoleClient();

  const { data: drone } = await supabase.from("dr_drones").select("id,shop_id,status").eq("id", params.droneId).maybeSingle();
  if (!drone || drone.shop_id !== params.shopId) throw new WalkInError("That drone isn't at this shop.");
  if (drone.status !== "AVAILABLE") throw new WalkInError("That drone isn't available right now.");

  const snapshot = await buildShopFleetSnapshot(params.shopId);
  const options = computeMerchantInstantOptions(snapshot.bookings, params.droneId, new Date());
  if (!options.allowed || !options.offeredDurationsMinutes.includes(params.durationMinutes)) {
    throw new WalkInError("This drone can't be booked for that long right now — check the available durations again.");
  }

  const publicToken = newPublicToken();
  const { data, error } = await supabase
    .from("dr_walkin_requests")
    .insert({
      public_token: publicToken,
      shop_id: params.shopId,
      drone_id: params.droneId,
      duration_minutes: params.durationMinutes,
      created_by_staff_id: params.createdByStaffId,
      expires_at: walkInExpiry(new Date()).toISOString(),
    })
    .select("id")
    .single();
  if (error || !data) throw new WalkInError("Could not start the walk-in. Try again.");
  return { id: data.id, publicToken };
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

/**
 * The customer's submission. One shot: the update only matches a request
 * that's still WAITING and unexpired, so a second submit (or a stale tab)
 * can't overwrite the details the merchant is already looking at.
 */
export async function submitCustomerDetails(
  token: string,
  details: { name: string; phone: string; email: string }
): Promise<{ ok: true } | { ok: false; reason: "expired" | "already_submitted" | "closed" | "not_found" }> {
  const request = await getWalkInRequestByToken(token);
  if (!request) return { ok: false, reason: "not_found" };

  const view = viewOf(request);
  if (view === "EXPIRED") return { ok: false, reason: "expired" };
  if (view === "SUBMITTED") return { ok: false, reason: "already_submitted" };
  if (view !== "WAITING") return { ok: false, reason: "closed" };

  const supabase = createServiceRoleClient();
  const { data: updated } = await supabase
    .from("dr_walkin_requests")
    .update({
      status: "SUBMITTED",
      customer_name: details.name,
      customer_phone: details.phone,
      customer_email: details.email.toLowerCase(),
      submitted_at: new Date().toISOString(),
    })
    .eq("id", request.id)
    .eq("status", "WAITING")
    .gt("expires_at", new Date().toISOString())
    .select("id");

  if (!updated || updated.length === 0) return { ok: false, reason: "already_submitted" };
  return { ok: true };
}

/**
 * The merchant accepts what the customer submitted: claims the request
 * first (SUBMITTED -> ACCEPTED, only one caller can win), then creates the
 * customer and the booking. If booking creation fails — the drone got
 * booked in the meantime, say — the claim is released so the merchant can
 * decline or start over instead of being left with a dead request.
 *
 * The availability rule is re-checked here, not trusted from when the QR
 * was made: minutes may have passed and another booking may have landed.
 */
export async function acceptWalkInRequest(requestId: string, staffId: string): Promise<{ bookingId: string; bookingToken: string }> {
  const supabase = createServiceRoleClient();
  const request = await getWalkInRequestById(requestId);
  if (!request) throw new WalkInError("Walk-in not found.");
  if (viewOf(request) !== "SUBMITTED") throw new WalkInError("This walk-in isn't waiting for approval.");
  if (!request.customer_name || !request.customer_phone || !request.customer_email) throw new WalkInError("The customer hasn't filled in their details yet.");

  const snapshot = await buildShopFleetSnapshot(request.shop_id);
  const options = computeMerchantInstantOptions(snapshot.bookings, request.drone_id, new Date());
  if (!options.allowed || request.duration_minutes > options.maxDurationMinutes) {
    throw new WalkInError("This drone can no longer be booked for that long — another booking is too close. Decline and start a new walk-in.");
  }

  const { data: claimed } = await supabase
    .from("dr_walkin_requests")
    .update({ status: "ACCEPTED" })
    .eq("id", request.id)
    .eq("status", "SUBMITTED")
    .select("id");
  if (!claimed || claimed.length === 0) throw new WalkInError("This walk-in was already handled.");

  try {
    const customerId = await findOrCreateCustomer({
      name: request.customer_name,
      phone: request.customer_phone,
      email: request.customer_email,
    });
    const booking = await createMerchantInstantBooking({
      customerId,
      shopId: request.shop_id,
      droneId: request.drone_id,
      durationMinutes: request.duration_minutes,
      createdByStaffId: staffId,
    });
    await supabase.from("dr_walkin_requests").update({ booking_id: booking.id }).eq("id", request.id);
    return { bookingId: booking.id, bookingToken: booking.secure_token };
  } catch (err) {
    await supabase.from("dr_walkin_requests").update({ status: "SUBMITTED" }).eq("id", request.id).eq("status", "ACCEPTED").is("booking_id", null);
    if (err instanceof NoDroneAvailableError) throw new WalkInError("That drone was just booked by someone else. Decline and start a new walk-in.");
    throw err;
  }
}

/** Merchant turns the customer away, or gives up on a QR nobody scanned. Only open requests can be closed. */
export async function closeWalkInRequest(requestId: string, outcome: "DECLINED" | "CANCELLED"): Promise<void> {
  const supabase = createServiceRoleClient();
  await supabase.from("dr_walkin_requests").update({ status: outcome }).eq("id", requestId).in("status", ["WAITING", "SUBMITTED"]);
}
