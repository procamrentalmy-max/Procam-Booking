"use client";

import { useState } from "react";
import { PaymentForm } from "@/components/PaymentForm";
import { SlotTakenDialog } from "@/components/droneRental/SlotTakenDialog";
import { checkSlotStillFreeAction } from "@/app/rent/b/[token]/pay/actions";

/**
 * The card form for a drone booking, with one extra step: just before the card is charged, the server checks the drone is
 * still free. If someone else got the last one in the meantime nothing is charged and the popup says so.
 */
export function SlotCheckedPayment({ token, shopId, clientSecret, returnUrl }: { token: string; shopId: string; clientSecret: string; returnUrl: string }) {
  const [taken, setTaken] = useState(false);
  return (
    <>
      <PaymentForm
        clientSecret={clientSecret}
        returnUrl={returnUrl}
        locale="en"
        beforePay={async () => {
          const { free } = await checkSlotStillFreeAction(token);
          if (!free) setTaken(true);
          return free;
        }}
      />
      {taken && <SlotTakenDialog shopId={shopId} />}
    </>
  );
}
