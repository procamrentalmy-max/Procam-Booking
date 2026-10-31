"use client";

import { useState } from "react";
import { pressableClass } from "@/components/formStyles";
import { droneText } from "@/lib/i18n/drone";
import type { Locale } from "@/lib/i18n/locale";

/**
 * Saves the payment QR picture to the customer's phone so they can pick it from the gallery in their banking app. Where the phone offers sharing files (most
 * phones) the share sheet comes up with Save Image; otherwise the picture downloads as a file.
 */
export function SaveQrButton({ locale }: { locale: Locale }) {
  const t = droneText(locale).common;
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const blob = await (await fetch("/rent/pay-qr")).blob();
      const file = new File([blob], `procam-payment-qr.${blob.type.includes("jpeg") ? "jpg" : "png"}`, { type: blob.type });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
      } else {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = file.name;
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 10000);
      }
    } catch (e) {
      // Closing the share sheet is not a failure; anything else falls back to the plain download.
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        const link = document.createElement("a");
        link.href = "/rent/pay-qr";
        link.download = "procam-payment-qr.png";
        link.click();
      }
    }
    setBusy(false);
  }

  return (
    <div className="space-y-1 text-center">
      <button type="button" disabled={busy} onClick={save} className={`w-full rounded-full border py-2.5 text-sm font-semibold disabled:opacity-50 ${pressableClass}`}>
        {t.saveQr}
      </button>
      <p className="text-xs text-zinc-500">{t.saveQrHint}</p>
    </div>
  );
}
