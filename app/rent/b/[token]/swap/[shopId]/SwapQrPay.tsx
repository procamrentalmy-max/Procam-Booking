"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AutoRefresh } from "@/components/droneRental/AutoRefresh";
import { SaveQrButton } from "@/components/droneRental/SaveQrButton";
import { pressableClass } from "@/components/formStyles";
import { droneText } from "@/lib/i18n/drone";
import type { Locale } from "@/lib/i18n/locale";
import { formatMyr } from "@/lib/droneRental/pricingRules";
import { cancelSwapQrPaymentAction, requestSwapQrPaymentAction } from "./actions";

export type OpenSwapQr = { id: string; status: "PENDING" | "CONFIRMED"; count: number; amountMyr: number; sameShop: boolean };

/**
 * Paying the swap fee by QR, on the customer's phone: pick how many batteries, scan the shop's QR (shown whole), pay, and show the paid screen to the
 * staff. The shop sees an incoming QR payment and confirms it, and this page then says so.
 */
export function SwapQrPay({ token, shopId, locale, payQrUrl, held, fees, open }: { token: string; shopId: string; locale: Locale; payQrUrl: string; held: number; fees: Record<1 | 2, number>; open: OpenSwapQr | null }) {
  const t = droneText(locale).swap;
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start(count: 1 | 2) {
    setBusy(true);
    setError(null);
    const res = await requestSwapQrPaymentAction({ token, shopId, count });
    if ("error" in res) setError(res.error);
    setBusy(false);
    router.refresh();
  }

  async function cancel() {
    setBusy(true);
    await cancelSwapQrPaymentAction({ token });
    setBusy(false);
    router.refresh();
  }

  if (open && !open.sameShop) {
    return <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">{t.qrElsewhere}</p>;
  }

  if (open?.status === "CONFIRMED") {
    return (
      <div className="rounded-2xl border border-green-300 bg-green-50 p-4 text-center dark:border-green-800 dark:bg-green-950">
        <AutoRefresh seconds={4} />
        <p className="text-base font-semibold text-green-900 dark:text-green-100">{t.qrConfirmed}</p>
        <p className="mt-1 text-sm text-green-800 dark:text-green-200">{t.qrConfirmedSub}</p>
      </div>
    );
  }

  if (open?.status === "PENDING") {
    return (
      <div className="space-y-3">
        <AutoRefresh seconds={3} />
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-center dark:border-amber-800 dark:bg-amber-950">
          <p className="text-base font-semibold text-amber-900 dark:text-amber-200">{t.qrWait(formatMyr(open.amountMyr))}</p>
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">{t.qrWaitSub}</p>
        </div>
        {/* The whole picture, as uploaded: full width, its own height, never cropped. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, not a local optimizable asset */}
        <img src={payQrUrl} alt={t.qrAlt} className="mx-auto h-auto w-full rounded-2xl border border-zinc-200 bg-white object-contain dark:border-zinc-800" />
        <SaveQrButton locale={locale} />
        <button type="button" disabled={busy} onClick={cancel} className="w-full text-center text-sm text-zinc-500 underline underline-offset-2 disabled:opacity-50">
          {t.qrPayAnother}
        </button>
      </div>
    );
  }

  const choices = ([1, 2] as const).filter((n) => n <= held);
  if (choices.length === 0) return null;
  return (
    <div className="space-y-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div>
        <p className="text-base font-semibold text-black dark:text-zinc-50">{t.qrTitle}</p>
        <p className="mt-0.5 text-sm text-zinc-500">{t.qrSub}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {choices.map((n) => (
          <button key={n} type="button" disabled={busy} onClick={() => start(n)} className={`rounded-full border py-2.5 text-sm font-semibold disabled:opacity-50 ${pressableClass}`}>
            {t.qrOption(n, formatMyr(fees[n]))}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
