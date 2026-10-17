import { createServerSupabaseClient } from "@/lib/supabase/server";
import { WalkInQrList } from "@/components/droneRental/WalkInQrList";

export const dynamic = "force-dynamic";

/** Every shop's standing walk-in QR, to save and print. A QR never changes: it is made from the shop's permanent code, whether or not the shop is open to customers yet. */
export default async function WalkInQrsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: shops } = await supabase.from("dr_shops").select("id,name,walkin_code").order("name");
  return (
    <div className="max-w-md space-y-4 pt-4 pb-10">
      <div>
        <h1 className="text-lg font-semibold">Walk-in QR codes</h1>
        <p className="text-sm text-zinc-500">One for each shop. A shop&apos;s QR never changes, so it can be printed now and stays valid. Each merchant also has theirs on their own Walk-in QR page.</p>
      </div>
      <WalkInQrList shops={shops ?? []} empty="No shops yet." />
    </div>
  );
}
