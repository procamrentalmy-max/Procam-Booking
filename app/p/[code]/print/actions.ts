"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { quotePhotoPrint } from "@/lib/photoPrint/pricing";
import { photoOrderFilePath, uploadPhotoOrderFile } from "@/lib/storage";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale, DEFAULT_LOCALE } from "@/lib/i18n/locale";
import type { PhotoOrderBilledTo } from "@/lib/db/types";

function generateSecureToken(): string {
  return randomBytes(32).toString("base64url");
}

const schema = z.object({
  referralCode: z.string().min(1),
  size: z.enum(["3R", "4R"]),
  quantity: z.enum(["5", "10"]).transform((v) => Number(v) as 5 | 10),
  customerName: z.string().min(1, "Name is required"),
  customerPhone: z.string().min(1, "Phone number is required"),
  customerEmail: z.string().email().optional().or(z.literal("")),
});

/**
 * Creates the order and uploads every photo, then leaves it at
 * PENDING_PAYMENT (GUEST-billed) or SUBMITTED (HOTEL-billed, no payment
 * needed) — see lib/photoPrint/pricing.ts for how billedTo is decided.
 */
export async function createPhotoOrderAction(
  formData: FormData
): Promise<{ secureToken: string; billedTo: PhotoOrderBilledTo }> {
  const rawLocale = formData.get("locale");
  const locale = typeof rawLocale === "string" && isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const dict = getDictionary(locale).photoPrintServer;

  const parsed = schema.safeParse({
    referralCode: formData.get("referralCode"),
    size: formData.get("size"),
    quantity: formData.get("quantity"),
    customerName: formData.get("customerName"),
    customerPhone: formData.get("customerPhone"),
    customerEmail: formData.get("customerEmail"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const photos = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (photos.length !== parsed.data.quantity) throw new Error(dict.wrongPhotoCount(parsed.data.quantity));

  const supabase = createServiceRoleClient();
  const { data: partner } = await supabase
    .from("partners")
    .select("id,status,photo_print_complimentary")
    .eq("referral_code", parsed.data.referralCode.toUpperCase())
    .maybeSingle();
  if (!partner || partner.status !== "ACTIVE") throw new Error(dict.hotelUnavailable);

  const quote = quotePhotoPrint(parsed.data.size, parsed.data.quantity, partner.photo_print_complimentary);
  const secureToken = generateSecureToken();

  const { data: order, error: orderError } = await supabase
    .from("photo_orders")
    .insert({
      partner_id: partner.id,
      secure_token: secureToken,
      customer_name: parsed.data.customerName,
      customer_phone: parsed.data.customerPhone,
      customer_email: parsed.data.customerEmail || null,
      size: parsed.data.size,
      quantity: parsed.data.quantity,
      billed_to: quote.billedTo,
      unit_price_myr: quote.unitPriceMyr,
      total_price_myr: quote.totalPriceMyr,
      status: quote.billedTo === "HOTEL" ? "SUBMITTED" : "PENDING_PAYMENT",
    })
    .select("id")
    .single();
  if (orderError || !order) throw new Error(dict.orderFailed);

  for (const [index, file] of photos.entries()) {
    const path = photoOrderFilePath(order.id, index, file);
    await uploadPhotoOrderFile(path, file);
    const { error: fileError } = await supabase
      .from("photo_order_files")
      .insert({ photo_order_id: order.id, storage_path: path });
    if (fileError) throw new Error(fileError.message);
  }

  return { secureToken, billedTo: quote.billedTo };
}
