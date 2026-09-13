import { notFound, redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { createPhotoPrintPaymentIntent } from "@/lib/stripe/photoPrint";
import { getLocale } from "@/lib/i18n/getLocale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { PaymentForm } from "@/components/PaymentForm";

export default async function PhotoOrderPayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const locale = await getLocale();
  const dict = getDictionary(locale).photoPrintPay;
  const supabase = createServiceRoleClient();

  const { data: order } = await supabase
    .from("photo_orders")
    .select("id,status,billed_to,size,quantity,total_price_myr")
    .eq("secure_token", token)
    .maybeSingle();
  if (!order) notFound();
  if (order.billed_to !== "GUEST") redirect(`/pp/${token}`);
  if (order.status !== "PENDING_PAYMENT") redirect(`/pp/${token}`);

  // Stripe isn't configured with a real key in this environment yet — the
  // page still needs to render without it.
  let clientSecret: string | null = null;
  try {
    ({ clientSecret } = await createPhotoPrintPaymentIntent(order.id));
  } catch {
    clientSecret = null;
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-10">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">{dict.title}</h1>
        <p className="mt-1 text-sm text-zinc-500">{dict.summary(order.quantity, order.size, order.total_price_myr)}</p>
      </div>
      {clientSecret ? (
        <PaymentForm clientSecret={clientSecret} returnUrl={`${process.env.NEXT_PUBLIC_APP_URL}/pp/${token}`} locale={locale} />
      ) : (
        <p className="rounded-xl border border-zinc-200 p-4 text-center text-sm text-zinc-500 dark:border-zinc-800">
          {dict.unavailable}
        </p>
      )}
    </div>
  );
}
