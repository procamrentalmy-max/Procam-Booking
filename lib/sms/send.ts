import "server-only";

/**
 * SMS is connected when an account is set up (Vercel environment variables): TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN, plus either TWILIO_SMS_FROM (a sender
 * number or name) or TWILIO_MESSAGING_SERVICE_SID. `SMS_DRY_RUN=true` is a test mode: nothing is sent, every message is only logged in Admin > WhatsApp.
 * Only this file knows the provider, so another one can replace it without touching the rest.
 */
export function smsMode(): "live" | "dry-run" | "off" {
  if (process.env.SMS_DRY_RUN === "true") return "dry-run";
  const ready = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && (process.env.TWILIO_SMS_FROM || process.env.TWILIO_MESSAGING_SERVICE_SID);
  return ready ? "live" : "off";
}

export type SmsResult = { ok: true; id: string | null; dryRun: boolean } | { ok: false; error: string };

/** Sends one text message. `to` is digits with the country code (60123456789); the plus is added here. */
export async function sendSms(input: { to: string; body: string }): Promise<SmsResult> {
  const mode = smsMode();
  if (mode === "off") return { ok: false, error: "SMS is not connected." };
  if (mode === "dry-run") {
    console.log(`[sms dry run] to +${input.to}: ${input.body}`);
    return { ok: true, id: null, dryRun: true };
  }
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID!;
    const params = new URLSearchParams({ To: `+${input.to}`, Body: input.body });
    if (process.env.TWILIO_MESSAGING_SERVICE_SID) params.set("MessagingServiceSid", process.env.TWILIO_MESSAGING_SERVICE_SID);
    else params.set("From", process.env.TWILIO_SMS_FROM!);
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
    const json = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
    if (!res.ok) return { ok: false, error: json.message ?? `The SMS service refused it (HTTP ${res.status}).` };
    return { ok: true, id: json.sid ?? null, dryRun: false };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not reach the SMS service." };
  }
}
