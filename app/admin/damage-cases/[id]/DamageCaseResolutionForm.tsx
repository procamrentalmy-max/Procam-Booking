"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { inputClass, primaryButtonClass } from "@/components/formStyles";
import { resolveDamageCaseAction } from "./actions";

type DepositActionChoice = "NONE" | "PARTIALLY_CAPTURED" | "CAPTURED";

export function DamageCaseResolutionForm({
  damageCaseId,
  bookingId,
  depositAmountMyr,
  lateFeeMyr,
}: {
  damageCaseId: string;
  bookingId: string;
  depositAmountMyr: number;
  lateFeeMyr: number;
}) {
  const router = useRouter();
  const [depositAction, setDepositAction] = useState<DepositActionChoice>("NONE");
  const [damageAmountMyr, setDamageAmountMyr] = useState("0");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const totalToCapture =
    depositAction === "CAPTURED"
      ? depositAmountMyr
      : Math.min(
          (depositAction === "PARTIALLY_CAPTURED" ? Number(damageAmountMyr) || 0 : 0) + lateFeeMyr,
          depositAmountMyr
        );

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      const fd = new FormData();
      fd.set("damageCaseId", damageCaseId);
      fd.set("bookingId", bookingId);
      fd.set("depositAction", depositAction);
      fd.set("damageAmountMyr", depositAction === "PARTIALLY_CAPTURED" ? damageAmountMyr : "0");
      fd.set("resolutionNotes", resolutionNotes);
      await resolveDamageCaseAction(fd);
      router.push("/admin/damage-cases");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="text-sm font-semibold text-zinc-500">Resolve — Deposit Decision</h2>

      <div className="space-y-2 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={depositAction === "NONE"}
            onChange={() => setDepositAction("NONE")}
          />
          No charge for damage
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={depositAction === "PARTIALLY_CAPTURED"}
            onChange={() => setDepositAction("PARTIALLY_CAPTURED")}
          />
          Charge a specific amount for damage
          {depositAction === "PARTIALLY_CAPTURED" && (
            <input
              type="number"
              min="0"
              step="0.01"
              value={damageAmountMyr}
              onChange={(e) => setDamageAmountMyr(e.target.value)}
              className={`${inputClass} w-28`}
            />
          )}
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={depositAction === "CAPTURED"}
            onChange={() => setDepositAction("CAPTURED")}
          />
          Capture the full deposit
        </label>
      </div>

      <p className="text-sm text-zinc-500">
        {lateFeeMyr > 0 && `Includes RM${lateFeeMyr.toFixed(2)} outstanding late fee. `}
        Total to capture from the RM{depositAmountMyr.toFixed(2)} deposit:{" "}
        <span className="font-semibold text-black dark:text-zinc-50">RM{totalToCapture.toFixed(2)}</span>
      </p>

      <textarea
        value={resolutionNotes}
        onChange={(e) => setResolutionNotes(e.target.value)}
        placeholder="Resolution notes (required — what was decided and why)"
        className={`${inputClass} w-full`}
        rows={3}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={loading || !resolutionNotes.trim()}
        className={`${primaryButtonClass} w-full disabled:opacity-50`}
      >
        {loading ? "Resolving…" : "Resolve Damage Case"}
      </button>
    </section>
  );
}
