import "server-only";
import { randomBytes } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { isImminent } from "@/lib/state-machine/booking";
import type { BookingRow, BookingSource, AssetStatus } from "@/lib/db/types";

export class NoAssetAvailableError extends Error {
  constructor() {
    super("No equipment is available at that property for the selected time.");
    this.name = "NoAssetAvailableError";
  }
}

export class InvalidStartTimeError extends Error {
  constructor() {
    super("Please choose a start time in the future.");
    this.name = "InvalidStartTimeError";
  }
}

/** Assets/kits in these states are out of rotation regardless of what time slot is requested. */
const OUT_OF_ROTATION_ASSET_STATUSES: AssetStatus[] = ["MAINTENANCE", "LOST", "RETIRED"];
const OUT_OF_ROTATION_KIT_STATUSES = ["MAINTENANCE", "RETIRED"];

function generateSecureToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Creates a PENDING_PAYMENT booking with a rental asset+kit atomically
 * assigned for an arbitrary requested start time (now, or scheduled ahead).
 *
 * Candidate assets are everything at the property not permanently out of
 * rotation (MAINTENANCE/LOST/RETIRED) — NOT just assets currently sitting
 * in AVAILABLE. An asset mid-rental right now can still be booked for next
 * Tuesday. The actual conflict check is the EXCLUDE constraints on
 * bookings(asset_id, ...) and bookings(kit_id, ...): we try candidate
 * pairs and let a losing INSERT (23P01) mean "try the next one" — there's
 * no separate reservation step to race.
 *
 * The asset's own `status` only gets flipped to RESERVED here if the
 * requested start is imminent (see lib/state-machine/booking.ts) — a
 * booking scheduled days out shouldn't make its asset look claimed to
 * every other customer or staff dashboard in the meantime. A scheduled
 * housekeeping job (app/api/cron/housekeeping) promotes it as the time
 * actually approaches.
 */
export async function createPendingBooking(params: {
  customerId: string;
  partnerId: string;
  rentalPackageId: string;
  startTime: Date;
  source: BookingSource;
  referralCode: string | null;
}): Promise<BookingRow> {
  const supabase = createServiceRoleClient();

  // A minute of slack for form-submission latency, not a real grace period.
  if (params.startTime.getTime() < Date.now() - 60_000) {
    throw new InvalidStartTimeError();
  }

  const { data: pkg } = await supabase
    .from("rental_packages")
    .select("duration_minutes,active")
    .eq("id", params.rentalPackageId)
    .single();
  if (!pkg || !pkg.active) throw new Error("This rental package is no longer available.");

  const { data: partner } = await supabase
    .from("partners")
    .select("status")
    .eq("id", params.partnerId)
    .single();
  if (!partner || partner.status !== "ACTIVE") throw new Error("This property is not currently active.");

  const [{ data: allAssets }, { data: allKits }] = await Promise.all([
    supabase.from("rental_assets").select("id,status").eq("partner_id", params.partnerId),
    supabase.from("kits").select("id,status").eq("partner_id", params.partnerId),
  ]);
  const assets = (allAssets ?? []).filter((a) => !OUT_OF_ROTATION_ASSET_STATUSES.includes(a.status));
  const kits = (allKits ?? []).filter((k) => !OUT_OF_ROTATION_KIT_STATUSES.includes(k.status));
  if (!assets.length || !kits.length) throw new NoAssetAvailableError();

  const endTime = new Date(params.startTime.getTime() + pkg.duration_minutes * 60_000);

  for (const asset of assets) {
    for (const kit of kits) {
      const { data: booking, error } = await supabase
        .from("bookings")
        .insert({
          secure_token: generateSecureToken(),
          customer_id: params.customerId,
          partner_id: params.partnerId,
          rental_package_id: params.rentalPackageId,
          asset_id: asset.id,
          kit_id: kit.id,
          status: "PENDING_PAYMENT",
          start_time: params.startTime.toISOString(),
          end_time: endTime.toISOString(),
          source: params.source,
          referral_code: params.referralCode,
        })
        .select("*")
        .single();

      if (error) {
        // 23P01 = exclusion_violation: this asset or kit already has a
        // booking overlapping the requested window. Try the next candidate
        // pair instead of failing the whole attempt.
        if (error.code === "23P01") continue;
        throw new Error(error.message);
      }

      if (isImminent(params.startTime)) {
        const { error: transitionError } = await supabase.rpc("system_transition_asset_status", {
          p_asset_id: asset.id,
          p_to_status: "RESERVED",
          p_actor_type: "CUSTOMER",
          p_booking_id: booking.id,
          p_event_type: "BOOKING_CREATED",
        });

        if (transitionError) {
          // Don't leave a booking holding an asset that still shows as
          // AVAILABLE everywhere else — undo and surface the failure.
          await supabase.from("bookings").delete().eq("id", booking.id);
          throw new Error(transitionError.message);
        }
      }

      return booking;
    }
  }

  throw new NoAssetAvailableError();
}
