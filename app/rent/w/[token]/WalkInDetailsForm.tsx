"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { inputClass, primaryButtonClass } from "@/components/formStyles";
import { submitWalkInDetailsAction } from "./actions";

export function WalkInDetailsForm({ token }: { token: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError(null);
    const result = await submitWalkInDetailsAction({ token, name, phone, email });
    if (result.ok) {
      router.refresh();
      return;
    }
    setError(result.message);
    setLoading(false);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="space-y-3"
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Full name"
        autoComplete="name"
        required
        className={`w-full ${inputClass} py-3 text-base`}
      />
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Phone number"
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        required
        className={`w-full ${inputClass} py-3 text-base`}
      />
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        type="email"
        autoComplete="email"
        required
        className={`w-full ${inputClass} py-3 text-base`}
      />
      {error && <p className="text-center text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={loading || !name || !phone || !email} className={`w-full ${primaryButtonClass} h-12 rounded-full text-base disabled:opacity-50`}>
        {loading ? "Sending…" : "Send my details to the shop"}
      </button>
    </form>
  );
}
