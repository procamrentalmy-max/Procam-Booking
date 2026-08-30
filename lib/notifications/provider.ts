export interface SendEmailParams {
  to: string;
  subject: string;
  text: string;
}

/**
 * Every notification (OTP codes, booking confirmations, return reminders,
 * ...) goes through this interface rather than calling an email/SMS/WhatsApp
 * SDK directly, so a second channel can be added later without touching
 * call sites — see plan section 26 / spec section 26.
 */
export interface NotificationProvider {
  sendEmail(params: SendEmailParams): Promise<void>;
}
