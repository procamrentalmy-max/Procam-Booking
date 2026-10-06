"use server";

import { z } from "zod";
import { submitWalkInOrder } from "@/lib/droneRental/walkInRequests";
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
});

export type SubmitOrderResult = { ok: true; token: string } | { ok: false; message: string };

const REASON_MESSAGES = {
  shop_not_found: "We couldn't find this shop. Please ask the staff.",
  length_unavailable: "That rental length or controller isn't available right now. Pick another, or ask the staff.",
  too_many_open: "The shop has a lot of orders waiting. Please ask the staff.",
} as const;

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
}): Promise<SubmitOrderResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check your details." };
  const d = parsed.data;

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
  if (result.ok) return { ok: true, token: result.publicToken };
  return { ok: false, message: REASON_MESSAGES[result.reason] };
}
