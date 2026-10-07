"use server";

import { z } from "zod";
import { uuidSchema } from "@/lib/zod-helpers";
import { buildShopFleetSnapshot } from "@/lib/droneRental/snapshot";
import { computeUnavailableStarts } from "@/lib/droneRental/slots";
import { isWithinOperatingHours } from "@/lib/droneRental/hours";
import { isValidRentalMinutes, CONTROLLER_KINDS, ENABLED_DRONE_MODELS, effectiveController, type ControllerKind, type DroneModel } from "@/lib/droneRental/pricingRules";
import { findOrCreateCustomer, createPendingDroneBooking, NoControllerAvailableError, NoDroneAvailableError, TooWindyError } from "@/lib/droneRental/createBooking";
import { getShopWindForecast } from "@/lib/droneRental/wind";
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
  const unavailable = dates.map((d, i) => noDrone[i] || !isWithinOperatingHours(d, parsed.durationMinutes));

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
}): Promise<{ secureToken: string; startTime: string; endTime: string }> {
  const parsed = createBookingSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Check your details and try again.");
  const data = parsed.data;
  const start = new Date(data.startTime);
  if (Number.isNaN(start.getTime())) throw new Error("Invalid date/time.");
  if (!isWithinOperatingHours(start, data.durationMinutes)) throw new Error("The shop is closed at that time — pick another slot.");

  const customerId = await findOrCreateCustomer({ name: data.name, phone: data.phone, email: data.email });

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
    return { secureToken: booking.secure_token, startTime: booking.start_time, endTime: booking.end_time };
  } catch (err) {
    if (err instanceof TooWindyError) throw new Error(err.message);
    if (err instanceof NoDroneAvailableError) throw new Error("Sorry, that time was just taken — pick another slot.");
    if (err instanceof NoControllerAvailableError) throw new Error(`Sorry, the ${err.controller} was just taken for that time — pick another slot or another way to fly.`);
    throw err;
  }
}
