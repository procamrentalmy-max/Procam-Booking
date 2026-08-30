import "server-only";
import type { NotificationProvider, SendWhatsAppParams } from "./provider";

/** Dev fallback used whenever WHATSAPP_ACCESS_TOKEN isn't set — logs instead of sending. */
export class ConsoleNotificationProvider implements NotificationProvider {
  async sendWhatsApp({ to, templateName, templateParams }: SendWhatsAppParams): Promise<void> {
    console.log(`[notifications] (no WHATSAPP_ACCESS_TOKEN, logging instead of sending)
  to: ${to}
  template: ${templateName}
  params: ${templateParams.join(", ")}`);
  }
}
