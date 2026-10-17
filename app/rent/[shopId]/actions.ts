"use server";

import { z } from "zod";
import { uuidSchema } from "@/lib/zod-helpers";
import { buildShopFleetSnapshot } from "@/lib/droneRental/snapshot";
import { computeUnavailableStarts } from "@/lib/droneRental/slots";
import { isWithinOperatingHours } from "@/lib/droneRental/hours";
import { getShopHours } from "@/lib/droneRental/shopHours";
import { isValidRentalMinutes, CONTROLLER_KINDS, ENABLED_DRONE_MODELS, effectiveController, type ControllerKind, type DroneModel } from "@/lib/droneRental/pricingRules";
import { findOrCreateCustomer, createPendingDroneBooking, NoControllerAvailableError, NoDroneAvailableError, TooWindyError } from "@/lib/droneRental/createBooking";
import { claimVerification, releaseVerification } from "@/lib/droneRental/kyc";
import { getShopWindForecast } from "@/lib/droneRental/wind";
import { droneText, fieldError } from "@/lib/i18n/drone";
import { getLocale } from "@/lib/i18n/getLocale";
import { toWhatsAppNumber } from "@/lib/whatsapp/phone";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { formatWind } from "@/lib/droneRental/windRules";
import { isTooWindy, maxWindForWindow, windLimitFor } from "@/lib/droneRental/windRules";

const rentalMinutesSchema = z.number().refine(isValidRentalMinutes, "Choose a rental length of 1 to 6 hours.");

const modelSchema = z.enum(ENABLED_DRONE_MODELS).default("NEO2");
const controllerSchema = z.enum(CONTROLLER_KINDS).default("NONE");

const unavailableStartsSchema = z.object({
  shopId: uuidSchema,
  model: modelSchema,
  controller: controllerSchema,
  durationMinutes: rentalMinutesSchema,
  starts: z.array(z.string().min(1)).max(64),
});

/** Which of the candidate 30-minute start times have no drone (and, with a controller, no controller of that kind) free for the selected duration — greys out slots in the table before the customer even taps one. */
export async function getUnavailableDroneStartsAction(input: {
  shopId: string;
  model?: DroneModel;
  controller?: ControllerKind;
  durationMinutes: number;
  starts: string[];
}): Promise<{ unavailable: boolean[]; windy: boolean[]; windLimitMps: number | null; worstWindMps: number | null }> {
  const parsed = unavailableStartsSchema.parse(input);
  const snapshot = await buildShopFleetSnapshot(parsed.shopId, parsed.model, effectiveController(parsed.model, parsed.controller));
  const dates = parsed.starts.map((s) => new Date(s));
  const noDrone = computeUnavailableStarts(snapshot.drones, snapshot.bookings, parsed.durationMinutes, dates, snapshot.controllers);
  // A start the shop is closed for (before opening, or running past closing) is unavailable too.
  const hours = await getShopHours(parsed.shopId);
  const unavailable = dates.map((d, i) => noDrone[i] || !isWithinOperatingHours(d, parsed.durationMinutes, hours));

  // Too windy for this drone then: the strongest hour of the forecast the rental would overlap is over the drone's limit.
  const windLimitMps = windLimitFor(parsed.model);
  const forecast = windLimitMps === null ? null : await getShopWindForecast(parsed.shopId);
  const winds = dates.map((d) => (forecast ? maxWindForWindow(forecast, d, new Date(d.getTime() + parsed.durationMinutes * 60_000)) : null));
  const windy = winds.map((w) => isTooWindy(parsed.model, w));
  const worstWindMps = winds.reduce<number | null>((worst, w, i) => (windy[i] && w !== null && (worst === null || w > worst) ? w : worst), null);
  return { unavailable: unavailable.map((u, i) => u || windy[i]), windy, windLimitMps, worstWindMps };
}

const createBookingSchema = z.object({
  shopId: uuidSchema,
  model: modelSchema,
  durationMinutes: rentalMinutesSchema,
  startTime: z.string().min(1),
  batteries: z.union([z.literal(1), z.literal(2)]),
  controller: controllerSchema,
  name: z.string().trim().min(1, "Enter your name"),
  phone: z.string().trim().regex(/^[0-9+\-()\s]{6,30}$/, "Enter a valid phone number"),
  email: z.string().trim().email("Enter a valid email"),
  verificationId: uuidSchema,
  /** The WhatsApp number to send the booking messages to; empty means they are texted to the phone number. */
  whatsappNumber: z.string().trim().max(30).optional(),
});

export async function createDroneBookingAction(input: {
  shopId: string;
  model?: DroneModel;
  durationMinutes: number;
  startTime: string;
  batteries: 1 | 2;
  /** How they will fly it: "NONE" (their own phone), "RC_N3" or "GOGGLES_N3". */
  controller?: ControllerKind;
  name: string;
  phone: string;
  email: string;
  /** The passed ID check this booking relies on (see lib/droneRental/kyc.ts). */
  verificationId: string;
  /** The WhatsApp number for the booking messages (see lib/whatsapp); empty means an SMS to the phone number. */
  whatsappNumber?: string;
}): Promise<{ secureToken: string; startTime: string; endTime: string } | { slotTaken: true } | { error: string }> {
  // Refusals are returned, not thrown: a thrown message never reaches the customer on the live site.
  const text = droneText(await getLocale());
  const t = text.errors;
  const parsed = createBookingSchema.safeParse(input);
  if (!parsed.success) return { error: fieldError(t, parsed.error.issues[0]?.path[0]) };
  const data = parsed.data;
  if (data.whatsappNumber && !toWhatsAppNumber(data.whatsappNumber)) return { error: text.common.whatsappNumberInvalid };
  const start = new Date(data.startTime);
  if (Number.isNaN(start.getTime())) return { error: t.invalidDate };
  // A location that only shows its rates can't be booked, whatever is sent to this action.
  const { data: shopRow } = await createServiceRoleClient().from("dr_shops").select("active").eq("id", data.shopId).maybeSingle();
  if (!shopRow?.active) return { error: t.closed };
  if (!isWithinOperatingHours(start, data.durationMinutes, await getShopHours(data.shopId))) return { error: t.closed };

  const customerId = await findOrCreateCustomer({ name: data.name, phone: data.phone, email: data.email });
  // Every booking needs its own passed ID check; it is used up here and given back if the booking doesn't go through.
  if (!(await claimVerification(data.verificationId, customerId))) return { error: t.idCheckNeeded };

  try {
    const booking = await createPendingDroneBooking({
      customerId,
      shopId: data.shopId,
      durationMinutes: data.durationMinutes,
      startTime: start,
      batteries: data.batteries,
      model: data.model,
      controller: data.controller,
    });
    // Where the messages go (their WhatsApp number, or an SMS to the phone number) and the language they are using (lib/whatsapp).
    await createServiceRoleClient().from("dr_bookings").update({ whatsapp_number: data.whatsappNumber || null, locale: await getLocale() }).eq("id", booking.id);
    return { secureToken: booking.secure_token, startTime: booking.start_time, endTime: booking.end_time };
  } catch (err) {
    await releaseVerification(data.verificationId);
    if (err instanceof TooWindyError) return { error: t.tooWindy(formatWind(err.windMps), formatWind(err.limitMps)) };
    // Someone paid for the last drone (or the controller) first: the page shows its popup and keeps everything typed.
    if (err instanceof NoDroneAvailableError || err instanceof NoControllerAvailableError) return { slotTaken: true };
    throw err;
  }
}
