import { notFound, redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { createRentalFeePaymentIntent } from "@/lib/stripe/rental";
import { PaymentForm } from "./PaymentForm";

export default async function PayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createServiceRoleClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("id,status,rental_package_id")
    .eq("secure_token", token)
    .maybeSingle();
  if (!booking) notFound();
  if (booking.status !== "PENDING_PAYMENT") redirect(`/r/${token}`);

  const { data: pkg } = await supabase
    .from("rental_packages")
    .select("name,price_myr,deposit_myr")
    .eq("id", booking.rental_package_id)
    .single();

  const { clientSecret } = await createRentalFeePaymentIntent(booking.id);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-10">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Pay &amp; Confirm</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {pkg?.name} — RM{pkg?.price_myr} rental fee now. A refundable RM{pkg?.deposit_myr} deposit is held on the
          same card right after — you won&apos;t be asked to pay again.
        </p>
      </div>
      <PaymentForm clientSecret={clientSecret} returnUrl={`${process.env.NEXT_PUBLIC_APP_URL}/r/${token}`} />
    </div>
  );
}
