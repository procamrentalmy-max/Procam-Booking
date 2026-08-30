import "server-only";
import type { NotificationProvider, SendEmailParams } from "./provider";

/** Dev fallback used whenever RESEND_API_KEY isn't set — logs instead of sending. */
export class ConsoleNotificationProvider implements NotificationProvider {
  async sendEmail({ to, subject, text }: SendEmailParams): Promise<void> {
    console.log(`[notifications] (no RESEND_API_KEY, logging instead of sending)
  to: ${to}
  subject: ${subject}
  ${text}`);
  }
}
