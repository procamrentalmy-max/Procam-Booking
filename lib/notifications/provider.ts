export interface SendWhatsAppParams {
  /** Phone number including country code, e.g. "+60123456789". */
  to: string;
  /** Name of a pre-approved WhatsApp message template (Meta requires templates for business-initiated messages). */
  templateName: string;
  /** Values for the template's body variables, in order. */
  templateParams: string[];
}

/**
 * Every customer notification (OTP codes, booking confirmations, return
 * reminders, ...) goes through this interface rather than calling the
 * WhatsApp Cloud API directly, so a second channel (SMS, email) can be
 * added later without touching call sites — see plan/spec section 26.
 */
export interface NotificationProvider {
  sendWhatsApp(params: SendWhatsAppParams): Promise<void>;
}
