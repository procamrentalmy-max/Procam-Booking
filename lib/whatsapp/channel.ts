import { toWhatsAppNumber } from "./phone";

export type MessageChannel = { channel: "WHATSAPP" | "SMS"; to: string | null };

/**
 * How to reach a customer about their booking. A WhatsApp number given on the form means WhatsApp, always (never an SMS instead). With none, the phone
 * number they booked with gets an SMS. Bookings made before the number field existed keep what they chose then: ticking "WhatsApp me" means WhatsApp
 * to their phone number. `to` is the number as digits with the country code (60123456789), or null when it can't be a mobile number.
 */
export function chooseChannel(input: { whatsappNumber: string | null; whatsappOptIn: boolean; phone: string }): MessageChannel {
  const given = input.whatsappNumber?.trim();
  if (given) return { channel: "WHATSAPP", to: toWhatsAppNumber(given) };
  if (input.whatsappOptIn) return { channel: "WHATSAPP", to: toWhatsAppNumber(input.phone) };
  return { channel: "SMS", to: toWhatsAppNumber(input.phone) };
}
