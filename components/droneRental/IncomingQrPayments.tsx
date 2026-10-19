import Link from "next/link";
import { formatMyr } from "@/lib/droneRental/pricingRules";
import { describeQrPayment } from "@/lib/droneRental/qrPaymentLabel";
import type { IncomingQrPayment } from "@/lib/droneRental/qrPayments";

/**
 * Incoming QR payments, at the top of the merchant's dashboard. Each one stays here, whatever else happens, until it is resolved: the merchant opens it,
 * looks at the paid screen on the customer's phone, and confirms it (or says it was not received). A confirmed battery swap that has not had its
 * batteries handed over yet stays too, in green, so it is not forgotten.
 */
export function IncomingQrPayments({ items }: { items: IncomingQrPayment[] }) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-2" aria-label="Incoming QR payments">
      {items.map((p) => {
        const confirmedSwap = p.status === "CONFIRMED";
        return (
          <Link
            key={p.id}
            href={confirmedSwap ? `/merchant/battery-swap/${p.bookingId}?shop=${p.shopId}` : `/merchant/qr-payment/${p.id}`}
            className={`flex items-center gap-3 rounded-2xl border-2 p-4 shadow-sm ${
              confirmedSwap ? "border-green-400 bg-green-50 dark:border-green-700 dark:bg-green-950" : "border-red-400 bg-red-50 dark:border-red-700 dark:bg-red-950"
            }`}
          >
            <span className="relative flex h-3 w-3 shrink-0" aria-hidden>
              {!confirmedSwap && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />}
              <span className={`relative inline-flex h-3 w-3 rounded-full ${confirmedSwap ? "bg-green-600" : "bg-red-600"}`} />
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block text-xs font-bold uppercase tracking-wide ${confirmedSwap ? "text-green-800 dark:text-green-300" : "text-red-700 dark:text-red-300"}`}>
                {confirmedSwap ? "QR payment confirmed: hand over the batteries" : "Incoming QR payment"}
              </span>
              <span className="block truncate text-base font-semibold text-black dark:text-zinc-50">{p.customerName}</span>
              <span className="block text-sm text-zinc-700 dark:text-zinc-300">
                {describeQrPayment({ kind: p.kind, batteryCount: p.batteryCount })} · {formatMyr(p.amountMyr)}
              </span>
            </span>
            <span aria-hidden className="text-lg text-zinc-500">
              →
            </span>
          </Link>
        );
      })}
    </section>
  );
}
