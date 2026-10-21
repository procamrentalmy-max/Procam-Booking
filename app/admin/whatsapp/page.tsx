import { createServerSupabaseClient } from "@/lib/supabase/server";
import { whatsappMode } from "@/lib/whatsapp/send";
import { smsMode } from "@/lib/sms/send";
import { WA_APP_URL, WA_BUTTON_URL, WA_KINDS, WA_LANGUAGE_CODE, WA_TEMPLATES, fillTemplate } from "@/lib/whatsapp/templates";
import { formatMalaysiaTime } from "@/lib/i18n/locale";

export const dynamic = "force-dynamic";

const LANGS = [
  { key: "en", label: "English" },
  { key: "ms", label: "Bahasa Melayu" },
  { key: "zh", label: "中文" },
] as const;

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  SENT: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  DELIVERED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  READ: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  FAILED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  DRY_RUN: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
};

const mask = (phone: string) => `•••• ${phone.slice(-4)}`;

/** Admin > WhatsApp: is it connected, the exact templates to approve in Meta, and what has been sent. */
export default async function AdminWhatsAppPage() {
  const supabase = await createServerSupabaseClient();
  const { data: messages } = await supabase.from("wa_messages").select("id,booking_id,kind,to_phone,locale,channel,status,error,created_at").order("created_at", { ascending: false }).limit(60);
  const mode = whatsappMode();
  const sms = smsMode();
  const env = [
    { name: "WHATSAPP_PHONE_NUMBER_ID", set: !!process.env.WHATSAPP_PHONE_NUMBER_ID, what: "The id of the WhatsApp number (Meta > WhatsApp > API setup)" },
    { name: "WHATSAPP_ACCESS_TOKEN", set: !!process.env.WHATSAPP_ACCESS_TOKEN, what: "A permanent access token from a System User" },
    { name: "WHATSAPP_APP_SECRET", set: !!process.env.WHATSAPP_APP_SECRET, what: "The app secret (Meta app > Settings > Basic), to check the callbacks are really from WhatsApp" },
    { name: "WHATSAPP_VERIFY_TOKEN", set: !!process.env.WHATSAPP_VERIFY_TOKEN, what: "Any long random text you make up; Meta asks for it when you set the callback address" },
  ];
  const bookingIds = [...new Set((messages ?? []).map((m) => m.booking_id))];
  const { data: bookings } = bookingIds.length ? await supabase.from("dr_bookings").select("id,human_id").in("id", bookingIds) : { data: [] as { id: string; human_id: string }[] };
  const humanId = new Map((bookings ?? []).map((b) => [b.id, b.human_id]));

  return (
    <div className="max-w-4xl space-y-8 pt-4 pb-10">
      <div>
        <h1 className="text-lg font-semibold">WhatsApp</h1>
        <p className="text-sm text-zinc-500">
          Booking messages: confirmation, a walk-in payment received, a reminder before pickup, how to swap a battery after handover, each battery swap done, a return reminder, a late notice, the return and what happens to the deposit, a deposit nudge, and a refund notice, in the language the customer was using. A customer who gave a
          WhatsApp number gets them on WhatsApp; one who left it empty gets the same words as an SMS to their phone number.
        </p>
      </div>

      <section className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <p className="text-sm font-semibold">
          Status:{" "}
          <span className={mode === "live" ? "text-green-700 dark:text-green-400" : mode === "dry-run" ? "text-amber-700 dark:text-amber-400" : "text-zinc-500"}>
            {mode === "live" ? "Connected: messages are being sent" : mode === "dry-run" ? "Test mode (dry run): nothing is sent, messages are only listed below" : "Not connected yet: nothing is sent"}
          </span>
        </p>
        <p className="text-sm font-semibold">
          SMS (for customers with no WhatsApp number):{" "}
          <span className={sms === "live" ? "text-green-700 dark:text-green-400" : sms === "dry-run" ? "text-amber-700 dark:text-amber-400" : "text-red-600 dark:text-red-400"}>
            {sms === "live" ? "Connected: texts are being sent" : sms === "dry-run" ? "Test mode (dry run): nothing is sent, texts are only listed below" : "Not connected yet: these customers get no messages until an SMS account is set up (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_SMS_FROM in Vercel)"}
          </span>
        </p>
        <ul className="space-y-1.5 text-sm">
          {env.map((e) => (
            <li key={e.name} className="flex flex-wrap items-baseline gap-2">
              <span className={e.set ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}>{e.set ? "✓ set" : "✗ missing"}</span>
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-900">{e.name}</code>
              <span className="text-xs text-zinc-500">{e.what}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-zinc-500">
          Callback address for Meta (WhatsApp &gt; Configuration, subscribe to <b>messages</b>): <code className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-900">{WA_APP_URL}/api/webhooks/whatsapp</code>. Add the four values in Vercel (Production) and redeploy. The
          setting <code>WHATSAPP_DRY_RUN=true</code> is a test mode: nothing is sent and each message is only listed below.
        </p>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold">The templates to approve in Meta</h2>
          <p className="text-xs text-zinc-500">
            In Meta&apos;s WhatsApp Manager &gt; Message templates, create each one as category <b>Utility</b>, with exactly this name, and add the three languages (English, Malay, Chinese (CHN)). Paste the text
            as it is, including {"{{1}}"}, {"{{2}}"}... and give Meta the sample values. Add one button, type <b>Visit website</b> with a dynamic URL, set to <code>{WA_BUTTON_URL}</code> (sample: <code>{WA_APP_URL}/rent/b/abc123</code>).
            Approval usually takes minutes to a day or two.
          </p>
        </div>
        {WA_KINDS.map((kind) => {
          const t = WA_TEMPLATES[kind];
          return (
            <details key={kind} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <summary className="cursor-pointer text-sm font-medium">
                <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-900">{t.name}</code> <span className="text-zinc-500">· {t.when}</span>
              </summary>
              <div className="mt-3 space-y-3 text-sm">
                <p className="text-xs text-zinc-500">
                  Variables: {t.variables.map((v, i) => `{{${i + 1}}} ${v}`).join(" · ")}. Samples: {t.examples.join(" · ")}.
                </p>
                {LANGS.map((l) => (
                  <div key={l.key}>
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      {l.label} (language code {WA_LANGUAGE_CODE[l.key]}) · button: {t.button[l.key]}
                    </p>
                    <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-zinc-100 p-3 text-xs dark:bg-zinc-900">{t.body[l.key]}</pre>
                    <p className="mt-1 text-xs text-zinc-500">Looks like: {fillTemplate(t.body[l.key], t.examples)}</p>
                  </div>
                ))}
              </div>
            </details>
          );
        })}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Recent messages</h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Booking</th>
                <th className="px-3 py-2">Message</th>
                <th className="px-3 py-2">To</th>
                <th className="px-3 py-2">Via</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {(messages ?? []).map((m) => (
                <tr key={m.id} className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-900">
                  <td className="px-3 py-2 text-zinc-500">{formatMalaysiaTime(new Date(m.created_at), "en")}</td>
                  <td className="px-3 py-2">{humanId.get(m.booking_id) ?? "—"}</td>
                  <td className="px-3 py-2">{WA_TEMPLATES[m.kind as keyof typeof WA_TEMPLATES]?.name ?? m.kind}</td>
                  <td className="px-3 py-2 text-zinc-500">{mask(m.to_phone)}</td>
                  <td className="px-3 py-2">{m.channel === "SMS" ? "SMS" : "WhatsApp"}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[m.status] ?? ""}`}>{m.status.replace("_", " ")}</span>
                    {m.error && <p className="mt-0.5 max-w-xs text-xs text-red-600 dark:text-red-400">{m.error}</p>}
                  </td>
                </tr>
              ))}
              {(messages ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-zinc-500">
                    No messages yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
