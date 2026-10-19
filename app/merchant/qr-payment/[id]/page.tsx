import Link from "next/link";
import { notFound } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import { canAccessShop } from "@/lib/droneRental/access";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { formatMyr } from "@/lib/droneRental/pricingRules";
import { describeQrPayment } from "@/lib/droneRental/qrPaymentLabel";
import { getQrPayment } from "@/lib/droneRental/qrPayments";
import { AutoRefresh } from "@/components/droneRental/AutoRefresh";
import { QrPaymentButtons } from "./QrPaymentButtons";

export const dynamic = "force-dynamic";

/**
 * One incoming QR payment: who is paying, for what, how much. The merchant asks to see the paid screen from the customer's banking app (not a page
 * from our site), checks the amount and that it just went through, and only then confirms. After that it carries on like any other payment.
 */
export default async function QrPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const payment = await getQrPayment(id);
  if (!payment || !(await canAccessShop(await getAuthContext(), payment.shop_id))) notFound();

  const supabase = createServiceRoleClient();
  const { data: booking } = await supabase.from("dr_bookings").select("id,human_id,customer_id").eq("id", payment.booking_id).single();
  const [{ data: customer }, { data: shop }] = await Promise.all([
    booking ? createServiceRoleClient().from("customers").select("name,phone").eq("id", booking.customer_id).single() : Promise.resolve({ data: null }),
    supabase.from("dr_shops").select("name").eq("id", payment.shop_id).single(),
  ]);
  const amount = formatMyr(Number(payment.amount_myr));
  const what = describeQrPayment({ kind: payment.kind, batteryCount: payment.battery_count });

  return (
    <div className="space-y-4 pb-10 pt-4">
      {payment.status === "PENDING" && <AutoRefresh seconds={5} />}
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-300">Incoming QR payment · {shop?.name ?? ""}</p>
        <p className="mt-2 text-2xl font-bold text-black dark:text-zinc-50">{customer?.name ?? "A customer"}</p>
        {customer?.phone && <p className="text-sm text-zinc-500">{customer.phone}</p>}
        <p className="mt-2 text-lg font-semibold text-zinc-800 dark:text-zinc-200">
          {what} · {amount}
        </p>
        {booking && <p className="text-xs text-zinc-400">{booking.human_id}</p>}
      </div>

      {payment.status === "PENDING" ? (
        <>
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            <p className="font-semibold">Check the customer&apos;s proof first</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>Ask to see the paid screen from their banking app on their phone. A page from our site is not proof.</li>
              <li>The amount must be {amount}.</li>
              <li>It must show a successful payment from just now, to ProCam&apos;s account.</li>
            </ul>
          </div>
          <QrPaymentButtons id={payment.id} amount={amount} kind={payment.kind} />
          <p className="px-1 text-center text-xs text-zinc-500">This stays on your dashboard until you confirm it or say it was not received.</p>
        </>
      ) : payment.status === "CONFIRMED" ? (
        <div className="space-y-3">
          <p className="rounded-2xl border border-green-300 bg-green-50 p-4 text-center text-sm font-semibold text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-100">Confirmed. This payment is done.</p>
          {payment.kind === "BATTERY_SWAP_FEE" && (
            <Link
              href={`/merchant/battery-swap/${payment.booking_id}?shop=${payment.shop_id}`}
              className="flex h-14 items-center justify-center rounded-2xl bg-black text-base font-semibold text-white dark:bg-white dark:text-black"
            >
              Hand over the batteries
            </Link>
          )}
        </div>
      ) : (
        <p className="rounded-2xl border border-zinc-200 p-4 text-center text-sm text-zinc-500 dark:border-zinc-800">{payment.status === "USED" ? "Confirmed and used for the swap." : "This payment was closed as not received."}</p>
      )}
    </div>
  );
}
