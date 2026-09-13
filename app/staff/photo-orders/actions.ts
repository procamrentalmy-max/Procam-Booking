"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { uuidSchema } from "@/lib/zod-helpers";
import { getAuthContext, hasStaffAccess } from "@/lib/auth/session";
import { claimPrintBatch, confirmOrdersPrinted } from "@/lib/photoPrint/printQueue";

/**
 * Manual fallback for the automatic print agent (app/api/print-agent):
 * claims every SUBMITTED order the same way the agent would — assigning
 * slot numbers and flipping them to PRINTING — so staff can open each
 * photo link on this page and print by hand if the agent's down. See
 * lib/photoPrint/printQueue.ts for the shared claiming logic.
 */
export async function claimPrintBatchAction() {
  const ctx = await getAuthContext();
  if (!hasStaffAccess(ctx)) throw new Error("Not authorized.");

  await claimPrintBatch();
  revalidatePath("/staff/photo-orders");
}

const confirmSchema = z.object({ orderId: uuidSchema });

/**
 * The manual equivalent of the print agent's confirm-printed callback —
 * staff visually confirming the physical print came out is just as valid
 * a "sure it printed" signal as the agent's own report. Deletes the
 * originally uploaded photo(s); see lib/photoPrint/printQueue.ts.
 */
export async function confirmPrintedAction(formData: FormData) {
  const ctx = await getAuthContext();
  if (!hasStaffAccess(ctx)) throw new Error("Not authorized.");

  const parsed = confirmSchema.parse({ orderId: formData.get("orderId") });
  await confirmOrdersPrinted([parsed.orderId]);
  revalidatePath("/staff/photo-orders");
}
