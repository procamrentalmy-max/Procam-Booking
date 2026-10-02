"use server";

import { z } from "zod";
import { submitCustomerDetails } from "@/lib/droneRental/walkInRequests";

const detailsSchema = z.object({
  token: z.string().min(10).max(100),
  name: z.string().trim().min(1, "Enter your name").max(100),
  phone: z.string().trim().regex(/^[0-9+\-()\s]{6,30}$/, "Enter a valid phone number"),
  email: z.string().trim().email("Enter a valid email").max(200),
});

export type SubmitDetailsResult = { ok: true } | { ok: false; message: string };

const REASON_MESSAGES = {
  expired: "This QR code has expired — please ask the staff for a new one.",
  already_submitted: "Your details were already sent. Please wait for the staff to accept.",
  closed: "This booking is no longer open — please ask the staff.",
  not_found: "We couldn't find this booking — please ask the staff for a new QR code.",
} as const;

/** Public — the customer isn't signed in; the unguessable token in the QR is what identifies the walk-in. */
export async function submitWalkInDetailsAction(input: { token: string; name: string; phone: string; email: string }): Promise<SubmitDetailsResult> {
  const parsed = detailsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check your details." };

  const result = await submitCustomerDetails(parsed.data.token, { name: parsed.data.name, phone: parsed.data.phone, email: parsed.data.email });
  if (result.ok) return { ok: true };
  return { ok: false, message: REASON_MESSAGES[result.reason] };
}
