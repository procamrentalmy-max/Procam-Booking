"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { uuidSchema } from "@/lib/zod-helpers";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getAuthContext, isAdmin } from "@/lib/auth/session";
import { makeFlyerCode } from "@/lib/referral";
import { loadReferrerSummaries } from "@/lib/referralStats";

/**
 * Admin > Flyers: the businesses that display a ProCam flyer with a QR, what each is owed and what has been paid. Actions return { ok, error } (never throw),
 * so a refusal reaches the screen on the live site.
 */
export type FlyerResult = { ok: true } | { ok: false; error: string };

const firstIssue = (e: z.ZodError) => e.issues.map((i) => i.message).join(", ");

async function requireAdmin(): Promise<FlyerResult | null> {
  return isAdmin(await getAuthContext()) ? null : { ok: false, error: "Not authorized." };
}

function refresh() {
  revalidatePath("/admin/flyers");
}

const detailsSchema = z.object({
  name: z.string().trim().min(1, "Enter the name of the business").max(80, "Keep the name to 80 characters or fewer"),
  contact: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(500).optional(),
  address: z.string().trim().max(200).optional(),
  map_url: z
    .string()
    .trim()
    .max(500)
    .optional()
    .refine((v) => !v || v.toLowerCase().startsWith("http://") || v.toLowerCase().startsWith("https://"),"The Google Maps link must start with https://"),
});

const detailsFrom = (formData: FormData) => ({
  name: formData.get("name"),
  contact: formData.get("contact") ?? undefined,
  notes: formData.get("notes") ?? undefined,
  address: formData.get("address") ?? undefined,
  map_url: formData.get("map_url") ?? undefined,
});

export async function createFlyerAction(formData: FormData): Promise<FlyerResult> {
  const denied = await requireAdmin();
  if (denied) return denied;
  const parsed = detailsSchema.safeParse(detailsFrom(formData));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const db = createServiceRoleClient();
  // A code that is already used (very unlikely) just gets another try.
  for (let attempt = 0; attempt < 5; attempt++) {
    const { error } = await db.from("dr_referrers").insert({
      name: parsed.data.name,
      contact: parsed.data.contact || null,
      notes: parsed.data.notes || null,
      address: parsed.data.address || null,
      map_url: parsed.data.map_url || null,
      code: makeFlyerCode((n) => randomBytes(n)),
      access_token: randomBytes(24).toString("base64url"),
    });
    if (!error) {
      refresh();
      return { ok: true };
    }
    if (error.code !== "23505") return { ok: false, error: error.message };
  }
  return { ok: false, error: "Could not make a code. Try again." };
}

const updateSchema = detailsSchema.extend({ id: uuidSchema });

export async function updateFlyerAction(formData: FormData): Promise<FlyerResult> {
  const denied = await requireAdmin();
  if (denied) return denied;
  const parsed = updateSchema.safeParse({ id: formData.get("id"), ...detailsFrom(formData) });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { error } = await createServiceRoleClient()
    .from("dr_referrers")
    .update({ name: parsed.data.name, contact: parsed.data.contact || null, notes: parsed.data.notes || null, address: parsed.data.address || null, map_url: parsed.data.map_url || null })
    .eq("id", parsed.data.id);
  if (error) return { ok: false, error: error.message };
  refresh();
  revalidatePath("/flyer", "layout");
  return { ok: true };
}

/** Stops or restarts a flyer place. A stopped flyer's QR just opens the home page and no new booking is counted for it; what it already earned stays. */
export async function setFlyerActiveAction(formData: FormData): Promise<FlyerResult> {
  const denied = await requireAdmin();
  if (denied) return denied;
  const parsed = z.object({ id: uuidSchema, active: z.enum(["true", "false"]) }).safeParse({ id: formData.get("id"), active: formData.get("active") });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { error } = await createServiceRoleClient().from("dr_referrers").update({ active: parsed.data.active === "true" }).eq("id", parsed.data.id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

const payoutSchema = z.object({
  id: uuidSchema,
  amount: z.coerce.number().positive("Enter the amount you paid"),
  note: z.string().trim().max(200).optional(),
});

/** Records a payout (the admin pays by bank transfer outside the app). It cannot be more than what is owed. */
export async function markFlyerPaidAction(formData: FormData): Promise<FlyerResult> {
  const denied = await requireAdmin();
  if (denied) return denied;
  const parsed = payoutSchema.safeParse({ id: formData.get("id"), amount: formData.get("amount"), note: formData.get("note") ?? undefined });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const amount = Math.round(parsed.data.amount * 100) / 100;

  const [summary] = await loadReferrerSummaries({ referrerId: parsed.data.id });
  if (!summary) return { ok: false, error: "That flyer place was not found." };
  if (amount > summary.owed + 0.005) return { ok: false, error: `Only RM${summary.owed.toFixed(2)} is owed to ${summary.referrer.name} right now.` };

  const { error } = await createServiceRoleClient().from("dr_referral_payouts").insert({ referrer_id: parsed.data.id, amount_myr: amount, note: parsed.data.note || null });
  if (error) return { ok: false, error: error.message };
  refresh();
  revalidatePath(`/flyer/${summary.referrer.access_token}`);
  return { ok: true };
}
