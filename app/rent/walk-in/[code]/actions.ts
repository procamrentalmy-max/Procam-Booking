"use server";

import { z } from "zod";
import { submitWalkInOrder } from "@/lib/droneRental/walkInRequests";
import { findOrCreateCustomer } from "@/lib/droneRental/createBooking";
import { claimVerification, releaseVerification } from "@/lib/droneRental/kyc";
import { droneText, fieldError } from "@/lib/i18n/drone";
import { getLocale } from "@/lib/i18n/getLocale";
import { toWhatsAppNumber } from "@/lib/whatsapp/phone";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { uuidSchema } from "@/lib/zod-helpers";
import { CONTROLLER_KINDS, ENABLED_DRONE_MODELS, type ControllerKind, type DroneModel } from "@/lib/droneRental/pricingRules";

const schema = z.object({
  code: z.string().min(8).max(64),
  durationMinutes: z.number().int().positive(),
  batteries: z.union([z.literal(1), z.literal(2)]),
  model: z.enum(ENABLED_DRONE_MODELS).default("NEO2"),
  controller: z.enum(CONTROLLER_KINDS).default("NONE"),
  name: z.string().trim().min(1, "Enter your name").max(100),
  phone: z.string().trim().regex(/^[0-9+\-()\s]{6,30}$/, "Enter a valid phone number"),
  email: z.string().trim().email("Enter a valid email").max(200),
  verificationId: uuidSchema,
  whatsappNumber: z.string().trim().max(30).optional(),
});

export type SubmitOrderResult = { ok: true; token: string } | { ok: false; message: string };

/** Public: a customer in the shop scanning its standing QR. Nothing is booked yet; the merchant confirms the order. */
export async function submitWalkInOrderAction(input: {
  code: string;
  durationMinutes: number;
  batteries: 1 | 2;
  model?: DroneModel;
  /** How they will fly it: "NONE" (their own phone), "RC_N3" or "GOGGLES_N3". */
  controller?: ControllerKind;
  name: string;
  phone: string;
  email: string;
  /** The passed ID check this order relies on (see lib/droneRental/kyc.ts). */
  verificationId: string;
  /** The WhatsApp number for the booking messages (see lib/whatsapp); empty means an SMS to the phone number. */
  whatsappNumber?: string;
}): Promise<SubmitOrderResult> {
  const text = droneText(await getLocale());
  const t = text.errors;
  const reasons = { shop_not_found: t.shopNotFound, length_unavailable: t.lengthUnavailable, too_many_open: t.tooManyOpen, too_windy: t.tooWindyNow, shop_closed: t.shopClosedNow } as const;
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, message: fieldError(t, parsed.error.issues[0]?.path[0]) };
  const d = parsed.data;
  if (d.whatsappNumber && !toWhatsAppNumber(d.whatsappNumber)) return { ok: false, message: text.common.whatsappNumberInvalid };

  const customerId = await findOrCreateCustomer({ name: d.name, phone: d.phone, email: d.email });
  if (!(await claimVerification(d.verificationId, customerId))) return { ok: false, message: t.idCheckNeeded };

  const result = await submitWalkInOrder({
    walkinCode: d.code,
    durationMinutes: d.durationMinutes,
    batteries: d.batteries,
    model: d.model,
    controller: d.controller,
    name: d.name,
    phone: d.phone,
    email: d.email,
  });
  if (result.ok) {
    // Kept on the order until the staff confirm it and the booking is made (see acceptWalkInRequest).
    await createServiceRoleClient().from("dr_walkin_requests").update({ whatsapp_number: d.whatsappNumber || null, locale: await getLocale() }).eq("public_token", result.publicToken);
    return { ok: true, token: result.publicToken };
  }
  await releaseVerification(d.verificationId);
  return { ok: false, message: reasons[result.reason] };
}
