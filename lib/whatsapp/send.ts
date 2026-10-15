import "server-only";
import { WA_LANGUAGE_CODE, WA_TEMPLATES, fillTemplate, type WaKind } from "./templates";
import type { Locale } from "@/lib/i18n/locale";

const GRAPH_VERSION = "v21.0";

/**
 * WhatsApp is connected when the phone number id and the access token are set (Vercel environment variables, set up by the admin from Meta's
 * WhatsApp Business Platform). `WHATSAPP_DRY_RUN=true` is a test mode: nothing is sent, every message is only logged in Admin > WhatsApp.
 */
export function whatsappMode(): "live" | "dry-run" | "off" {
  if (process.env.WHATSAPP_DRY_RUN === "true") return "dry-run";
  return process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN ? "live" : "off";
}

export type SendResult = { ok: true; id: string | null; dryRun: boolean } | { ok: false; error: string };

/** Sends one approved template to a customer: its variables, and the booking token for the View booking button. */
export async function sendWhatsAppTemplate(input: { to: string; kind: WaKind; locale: Locale; variables: string[]; bookingToken: string }): Promise<SendResult> {
  const mode = whatsappMode();
  if (mode === "off") return { ok: false, error: "WhatsApp is not connected." };
  const template = WA_TEMPLATES[input.kind];
  if (mode === "dry-run") {
    console.log(`[whatsapp dry run] to ${input.to}: ${fillTemplate(template.body[input.locale], input.variables)}`);
    return { ok: true, id: null, dryRun: true };
  }
  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: input.to,
        type: "template",
        template: {
          name: template.name,
          language: { code: WA_LANGUAGE_CODE[input.locale] },
          components: [
            { type: "body", parameters: input.variables.map((text) => ({ type: "text", text })) },
            { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: input.bookingToken }] },
          ],
        },
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string; code?: number } };
    if (!res.ok) return { ok: false, error: json.error?.message ?? `WhatsApp refused it (HTTP ${res.status}).` };
    return { ok: true, id: json.messages?.[0]?.id ?? null, dryRun: false };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not reach WhatsApp." };
  }
}
