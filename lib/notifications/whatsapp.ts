import "server-only";
import type { NotificationProvider, SendWhatsAppParams } from "./provider";

const GRAPH_API_VERSION = "v21.0";

/**
 * Sends via the WhatsApp Business Cloud API (Meta). Business-initiated
 * messages — which an OTP code always is — must use a pre-approved message
 * template; there's no way around that from this code, the template has to
 * be created and approved in Meta Business Manager first. Set
 * WHATSAPP_OTP_TEMPLATE_NAME to whatever that template is named once it
 * exists; until then this will fail with a clear "template not found" error
 * from the API rather than silently doing nothing.
 */
export class WhatsAppCloudProvider implements NotificationProvider {
  private phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
  private accessToken = process.env.WHATSAPP_ACCESS_TOKEN!;
  private languageCode = process.env.WHATSAPP_TEMPLATE_LANGUAGE ?? "en_US";

  async sendWhatsApp({ to, templateName, templateParams }: SendWhatsAppParams): Promise<void> {
    // WhatsApp Cloud API wants digits only (no "+", spaces, or dashes).
    const digitsOnly = to.replace(/\D/g, "");

    const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${this.phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: digitsOnly,
        type: "template",
        template: {
          name: templateName,
          language: { code: this.languageCode },
          components: [{ type: "body", parameters: templateParams.map((text) => ({ type: "text", text })) }],
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`WhatsApp send failed (${res.status}): ${await res.text()}`);
    }
  }
}
