import "server-only";
import { Resend } from "resend";
import type { NotificationProvider, SendEmailParams } from "./provider";

export class ResendNotificationProvider implements NotificationProvider {
  private client: Resend;

  constructor() {
    this.client = new Resend(process.env.RESEND_API_KEY);
  }

  async sendEmail({ to, subject, text }: SendEmailParams): Promise<void> {
    const from = process.env.NOTIFICATIONS_FROM_EMAIL ?? "bookings@procam.my";
    const { error } = await this.client.emails.send({ from, to, subject, text });
    if (error) throw new Error(`Failed to send email: ${error.message}`);
  }
}
