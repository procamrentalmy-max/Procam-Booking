"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { Brand } from "@/components/Brand";
import { PHOTO_PRINT_QUANTITIES_BY_SIZE, PHOTO_PRINT_SIZES, quotePhotoPrint } from "@/lib/photoPrint/pricing";
import type { PhotoOrderQuantity, PhotoOrderSize } from "@/lib/db/types";
import { createPhotoOrderAction } from "./actions";
import { CollageEditor } from "./CollageEditor";

type Step = "build" | "review";

export function PrintOrderForm({
  locale,
  logoUrl,
  referralCode,
  hotelName,
  complimentary,
}: {
  locale: Locale;
  logoUrl: string | null;
  referralCode: string;
  hotelName: string;
  complimentary: boolean;
}) {
  const router = useRouter();
  const dict = getDictionary(locale);
  const t = dict.printPage;

  const [step, setStep] = useState<Step>("build");
  const [size, setSize] = useState<PhotoOrderSize>("4R");
  const [quantity, setQuantity] = useState<PhotoOrderQuantity>(7);
  const [slots, setSlots] = useState<(File | null)[]>(() => Array.from({ length: 7 }, () => null));
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const quote = quotePhotoPrint(size, quantity, complimentary);
  const filledCount = slots.filter((s) => s !== null).length;
  const allSlotsFilled = filledCount === quantity;

  // Changing the print count changes how many slots exist, and each
  // slot's crop was framed for the print size at the time — safer to
  // start every slot over than to guess which ones still make sense.
  function selectQuantity(next: PhotoOrderQuantity) {
    setQuantity(next);
    setSlots(Array.from({ length: next }, () => null));
    setEditingIndex(null);
  }

  function selectSize(next: PhotoOrderSize) {
    // Each size offers its own print counts (e.g. 4R doesn't offer 5) — a
    // quantity valid for the old size may not exist for the new one, so
    // fall back to that size's first option rather than carry over a
    // dead selection.
    const validQuantities = PHOTO_PRINT_QUANTITIES_BY_SIZE[next];
    const nextQuantity = validQuantities.includes(quantity) ? quantity : validQuantities[0];
    setSize(next);
    setQuantity(nextQuantity);
    setSlots(Array.from({ length: nextQuantity }, () => null));
    setEditingIndex(null);
  }

  function setSlot(index: number, file: File) {
    setSlots((prev) => prev.map((f, i) => (i === index ? file : f)));
    setEditingIndex(null);
  }

  function removeSlot(index: number) {
    setSlots((prev) => prev.map((f, i) => (i === index ? null : f)));
  }

  const canSubmit = allSlotsFilled && name.trim() !== "" && phone.trim() !== "" && !loading;

  async function handleSubmit() {
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      const formData = new FormData();
      formData.set("referralCode", referralCode);
      formData.set("locale", locale);
      formData.set("size", size);
      formData.set("quantity", String(quantity));
      formData.set("customerName", name);
      formData.set("customerPhone", phone);
      formData.set("customerEmail", email);
      for (const file of slots) formData.append("photos", file!);

      const result = await createPhotoOrderAction(formData);
      router.push(result.billedTo === "HOTEL" ? `/pp/${result.secureToken}` : `/pp/${result.secureToken}/pay`);
    } catch (err) {
      setError(err instanceof Error ? err.message : dict.common.somethingWentWrong);
      setLoading(false);
    }
  }

  // The grid + its inline collage editor is shared by both steps — build
  // fills every slot for the first time, review is where deleting a photo
  // and adding a replacement both happen right on the same screen, without
  // bouncing back to the size/quantity step.
  const printsGrid = (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">{t.printsHeading}</p>
      <p className="text-xs text-zinc-500">{t.printsHint}</p>

      <div className="grid grid-cols-3 gap-2">
        {slots.map((file, i) => (
          <div key={i} className="relative aspect-square overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
            {file ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- local object URL, not optimizable */}
                <img src={URL.createObjectURL(file)} alt="" className="h-full w-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-black/50 py-1">
                  <button type="button" onClick={() => setEditingIndex(i)} className="text-[10px] font-medium text-white">
                    {t.slotEdit}
                  </button>
                  <button type="button" onClick={() => removeSlot(i)} className="text-[10px] font-medium text-white">
                    {t.slotRemove}
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setEditingIndex(i)}
                className="flex h-full w-full items-center justify-center text-2xl text-zinc-300 dark:text-zinc-700"
              >
                +
              </button>
            )}
          </div>
        ))}
      </div>
      <p className="text-center text-xs text-zinc-400">{t.slotsReady(filledCount, quantity)}</p>

      {editingIndex !== null && (
        <CollageEditor
          size={size}
          dict={dict}
          onConfirm={(file) => setSlot(editingIndex, file)}
          onCancel={() => setEditingIndex(null)}
        />
      )}
    </div>
  );

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-10">
      <div className="flex flex-col items-center text-center">
        <Brand logoUrl={logoUrl} size={36} />
        <h1 className="mt-3 text-xl font-semibold text-black dark:text-zinc-50">
          {step === "build" ? t.title : t.reviewHeading}
        </h1>
        {step === "build" && <p className="mt-2 text-sm text-zinc-500">{t.intro}</p>}
        <p className="mt-3 rounded-full bg-black/5 px-4 py-2 text-xs font-medium text-black dark:bg-white/10 dark:text-zinc-50">
          {t.turnaround}
        </p>
      </div>

      {step === "build" && (
        <>
          {/* Price chart — reference only; the actual pick happens in the toggles below. */}
          <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-900">
                  <th className="px-4 py-2 text-left font-medium text-zinc-500">{t.table.size}</th>
                  <th className="px-4 py-2 text-left font-medium text-zinc-500">{t.table.quantity}</th>
                  <th className="px-4 py-2 text-right font-medium text-zinc-500">{t.table.price}</th>
                </tr>
              </thead>
              <tbody>
                {PHOTO_PRINT_SIZES.map((s) =>
                  PHOTO_PRINT_QUANTITIES_BY_SIZE[s].map((q) => {
                    const rowQuote = quotePhotoPrint(s, q, complimentary);
                    return (
                      <tr key={`${s}-${q}`} className="border-t border-zinc-100 dark:border-zinc-800">
                        <td className="px-4 py-2">{t.sizeLabel[s]}</td>
                        <td className="px-4 py-2">{t.quantityLabel(q)}</td>
                        <td className="px-4 py-2 text-right font-semibold">
                          {rowQuote.billedTo === "HOTEL" ? t.freeLine(hotelName) : `RM${rowQuote.totalPriceMyr}`}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">{t.chooseSize}</p>
            <div className="flex gap-2">
              {PHOTO_PRINT_SIZES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => selectSize(s)}
                  className={`flex-1 rounded-full border py-2 text-sm font-medium ${
                    size === s
                      ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                      : "border-zinc-300 dark:border-zinc-700"
                  }`}
                >
                  {t.sizeLabel[s]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">{t.chooseQuantity}</p>
            <div className="flex gap-2">
              {PHOTO_PRINT_QUANTITIES_BY_SIZE[size].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => selectQuantity(q)}
                  className={`flex-1 rounded-full border py-2 text-sm font-medium ${
                    quantity === q
                      ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                      : "border-zinc-300 dark:border-zinc-700"
                  }`}
                >
                  {t.quantityLabel(q)}
                </button>
              ))}
            </div>
          </div>

          {printsGrid}

          <button
            onClick={() => setStep("review")}
            disabled={!allSlotsFilled}
            className="w-full rounded-full bg-black py-3 font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {t.continueToReview}
          </button>
        </>
      )}

      {step === "review" && (
        <>
          {printsGrid}

          <div className="space-y-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.namePlaceholder}
              className="w-full rounded-lg border border-zinc-300 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900"
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t.phonePlaceholder}
              className="w-full rounded-lg border border-zinc-300 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900"
            />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder={t.emailPlaceholder}
              className="w-full rounded-lg border border-zinc-300 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>

          {error && <p className="text-center text-sm text-red-600">{error}</p>}

          {/* Price for the confirmed selection — shown at the bottom, right above the submit button. */}
          <div className="rounded-lg bg-zinc-50 p-3 text-center dark:bg-zinc-900">
            <p className="text-sm text-zinc-500">
              {t.quantityLabel(quantity)} · {t.sizeLabel[size]}
            </p>
            <p className="text-lg font-semibold text-black dark:text-zinc-50">
              {quote.billedTo === "HOTEL" ? t.freeLine(hotelName) : t.summaryTotal(quote.totalPriceMyr)}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep("build")}
              className="flex-1 rounded-full border border-zinc-300 py-3 text-sm font-medium dark:border-zinc-700"
            >
              {dict.common.back}
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="flex-[2] rounded-full bg-black py-3 font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black"
            >
              {loading ? t.submitting : t.submit}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
