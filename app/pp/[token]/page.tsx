import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getLocale } from "@/lib/i18n/getLocale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLogoUrl } from "@/lib/branding";
import { formatMalaysiaTime } from "@/lib/i18n/locale";
import { Brand } from "@/components/Brand";

export default async function PhotoOrderConfirmPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const locale = await getLocale();
  const dict = getDictionary(locale).photoPrintConfirm;
  const logoUrl = await getLogoUrl();
  const supabase = createServiceRoleClient();

  const { data: order } = await supabase
    .from("photo_orders")
    .select("status,billed_to,partner_id,slot_number,collect_by,destroy_by")
    .eq("secure_token", token)
    .maybeSingle();
  if (!order) notFound();

  // A GUEST-billed order that hasn't paid yet belongs on the payment page,
  // not here — this page is only for orders that actually went through.
  if (order.billed_to === "GUEST" && order.status === "PENDING_PAYMENT") redirect(`/pp/${token}/pay`);

  const { data: partner } = await supabase.from("partners").select("name").eq("id", order.partner_id).single();
  const hotelName = partner?.name ?? "";

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-10">
      <div className="flex flex-col items-center text-center">
        <Brand logoUrl={logoUrl} size={36} />

        {order.status === "DELIVERED" && order.slot_number !== null ? (
          <>
            <h1 className="mt-3 text-xl font-semibold text-black dark:text-zinc-50">{dict.readyTitle}</h1>
            <p className="mt-2 text-lg font-semibold text-black dark:text-zinc-50">
              {dict.readyBody(order.slot_number, hotelName)}
            </p>
            <p className="mt-1 text-sm text-zinc-500">{dict.askReception}</p>
            {order.destroy_by && (
              <p className="mt-3 rounded-full bg-amber-50 px-4 py-2 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                {dict.boxWarning(formatMalaysiaTime(new Date(order.destroy_by), locale))}
              </p>
            )}
          </>
        ) : order.status === "DELIVERED" && order.slot_number === null ? (
          // Either the 50 numbered slots were already full at delivery
          // time, or it sat in one long enough to get swept into the box
          // (see app/staff/route/actions.ts) — either way it's still
          // physically at the hotel, just not in a numbered slot anymore.
          <>
            <h1 className="mt-3 text-xl font-semibold text-black dark:text-zinc-50">{dict.movedToBoxTitle}</h1>
            <p className="mt-2 text-lg font-semibold text-black dark:text-zinc-50">{dict.movedToBoxBody(hotelName)}</p>
            <p className="mt-1 text-sm text-zinc-500">{dict.askReception}</p>
          </>
        ) : order.status === "CANCELLED" ? (
          <>
            <h1 className="mt-3 text-xl font-semibold text-black dark:text-zinc-50">{dict.cancelledTitle}</h1>
            <p className="mt-2 text-sm text-zinc-500">{dict.cancelledBody}</p>
          </>
        ) : (
          <>
            <h1 className="mt-3 text-xl font-semibold text-black dark:text-zinc-50">{dict.title}</h1>
            <p className="mt-2 text-sm text-zinc-500">
              {order.billed_to === "HOTEL" ? dict.freeBody(hotelName) : dict.paidBody}
            </p>
            <p className="mt-3 rounded-full bg-black/5 px-4 py-2 text-xs font-medium text-black dark:bg-white/10 dark:text-zinc-50">
              {dict.turnaround}
            </p>
          </>
        )}
      </div>

      <Link href="/" className="text-center text-xs text-zinc-400 underline underline-offset-2">
        {dict.back}
      </Link>
    </div>
  );
}
