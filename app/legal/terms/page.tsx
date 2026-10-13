import Link from "next/link";
import { CONTROLLER_PROFILES, DRONE_MODEL_PROFILES } from "@/lib/droneRental/pricingRules";
import { BUSINESS, FREE_CANCELLATION_HOURS, HOLD_DAYS, LATE_GRACE_MINUTES, LEGAL_UPDATED } from "@/lib/legal";
import { LegalList, LegalSection, LegalTitle } from "../LegalSection";

export const metadata = {
  title: "Terms & Conditions — ProCam Rental",
  description: "The terms for renting a DJI drone from ProCam Rental: booking, payment, deposit, use, late returns and damage.",
};

const neo2 = DRONE_MODEL_PROFILES.NEO2;
const neo = DRONE_MODEL_PROFILES.NEO;

export default function TermsPage() {
  return (
    <>
      <LegalTitle title="Terms & Conditions" updated={LEGAL_UPDATED} />

      <LegalSection title="1. Who we are and what we rent">
        <p>
          {BUSINESS.brand}
          {BUSINESS.registeredName ? ` (${BUSINESS.registeredName}${BUSINESS.ssmNumber ? `, SSM ${BUSINESS.ssmNumber}` : ""})` : ""} rents small DJI camera drones in Malaysia: the DJI Neo 2 and the original DJI Neo, with an optional RC-N3 controller or Goggles N3 with Motion 3
          controller. You collect and return the drone at one of our partner shops in Kajang or Port Dickson. See our <Link href="/legal/contact" className="underline underline-offset-2">Contact page</Link> for the shops.
        </p>
        <p>By making a booking you agree to these terms, our <Link href="/legal/refunds" className="underline underline-offset-2">Refund & Cancellation Policy</Link> and our <Link href="/legal/privacy" className="underline underline-offset-2">Privacy Policy</Link>.</p>
      </LegalSection>

      <LegalSection title="2. Who can rent">
        <p>
          You must be at least 18 years old and able to make a binding agreement. Before we hold a drone for you, you complete an identity check: a photo of your MyKad or passport and a live selfie, done on your phone through our verification
          provider. Bring the same photo ID when you collect the drone: the shop staff check it against your booking and can refuse the rental if you cannot show it, if it does not match, or if they have good reason to doubt who you are. In that
          case the rental fee is refunded in full.
        </p>
      </LegalSection>

      <LegalSection title="3. Booking, prices and payment">
        <LegalList
          items={[
            "All prices are in Malaysian Ringgit (MYR). The price you see on the booking page before you pay is the price you pay: the hourly rate for the drone you choose, plus the controller if you add one, plus the battery option.",
            "An online booking is only confirmed once your card payment has gone through. Until then no drone is held for you.",
            "If two people pay for the same last drone, the first payment wins. The other person is refunded in full automatically and is asked to choose another time.",
            "Walk-in rentals at a shop can be paid by card, or the rental fee can be paid in cash at the shop. A card is always needed for the deposit.",
            "Card payments are processed by Stripe. We never see or store your card number.",
          ]}
        />
      </LegalSection>

      <LegalSection title="4. Security deposit">
        <p>
          A refundable deposit is held on your card when your booking is paid: {`RM${neo2.depositDroneMyr}`} for the Neo 2 and {`RM${neo.depositDroneMyr}`} for the Neo, plus {`RM${CONTROLLER_PROFILES.RC_N3.depositMyr}`} if you add the RC-N3 controller or{" "}
          {`RM${CONTROLLER_PROFILES.GOGGLES_N3.depositMyr}`} if you add the Goggles N3 and Motion 3 controller. The exact deposit is shown before you pay.
        </p>
        <LegalList
          items={[
            "The deposit is a hold on your card, not a charge. Nothing is taken from it unless something is damaged, lost or owed.",
            `The hold is released when the drone and controller come back in good condition. Your bank may take a few days to show it as released. A hold lasts at most about ${HOLD_DAYS} days.`,
            "The deposit is the most we take for damage to or loss of the equipment. If a repair or replacement costs more than the deposit, we cover the difference. The deposit does not cover late fees, extra batteries or anything else you owe, which are charged separately.",
          ]}
        />
      </LegalSection>

      <LegalSection title="5. Collecting and returning the drone">
        <LegalList
          items={[
            "At pick-up the shop checks the drone, batteries and accessories with you and takes photos. At return they check again and take photos. These photos are our record of the condition.",
            "You are responsible for the drone, batteries, controller and everything in the kit from the moment you take it until the shop has accepted it back.",
            `Return everything by the end time you booked. After a ${LATE_GRACE_MINUTES}-minute grace period, a late fee equal to one hour's rate (drone plus controller) is charged for each hour or part of an hour you are late. It is charged to the card you booked with, or paid in cash at the shop if you choose.`,
            "You can swap used batteries for charged ones at the shop during your rental. Each swap is charged at the battery price shown at the shop, to your saved card or in cash.",
          ]}
        />
      </LegalSection>

      <LegalSection title="6. Damage and loss">
        <LegalList
          items={[
            "If the drone or controller comes back damaged, the shop records what is damaged with photos. Your deposit stays on hold, and we review the damage that evening. We then charge only the cost of the repair, up to the amount held. The rest of the deposit is released.",
            "If a drone, controller or goggles set is lost (including flown out of reach, into the sea or a river, or not returned), we keep the deposit held for that item in full.",
            "Normal wear that comes from careful use is not damage.",
            "If you think a charge is wrong, contact us within 14 days of the return. We will look at the photos with you.",
          ]}
        />
      </LegalSection>

      <LegalSection title="7. Flying safely and legally">
        <p>You are the pilot and are responsible for how the drone is flown. You must:</p>
        <LegalList
          items={[
            "follow Malaysian law and the rules of the Civil Aviation Authority of Malaysia (CAAM), including keeping away from airports, airfields, military and other restricted areas;",
            "keep the drone within your sight, away from people, crowds, roads and other aircraft, and respect other people's privacy;",
            `not fly in rain or strong wind. Online booking is blocked when the forecast wind at the shop is stronger than the drone's limit (${neo2.maxWindMps} m/s for the Neo 2, ${neo.maxWindMps} m/s for the Neo). Even below that limit, do not fly if conditions feel unsafe, especially over water or near a beach;`,
            "not fly under the influence of alcohol or drugs, or use the drone to harm, harass or spy on anyone;",
            "not lend, sublet or resell the equipment, open it, repair it, or remove any labels.",
          ]}
        />
        <p>Breaking these rules can cost you your deposit and may be reported to the authorities. We can refuse a rental, or end it, if we think the equipment or other people are at risk.</p>
      </LegalSection>

      <LegalSection title="8. Cancellations and refunds">
        <p>
          If you cancel at least {FREE_CANCELLATION_HOURS} hours before your start time, you get the rental fee back in full. The full details are in our{" "}
          <Link href="/legal/refunds" className="underline underline-offset-2">Refund & Cancellation Policy</Link>.
        </p>
      </LegalSection>

      <LegalSection title="9. Our responsibility">
        <p>
          We provide the equipment as it is and look after it carefully, but we are not liable for indirect or consequential loss, such as lost footage, missed moments or claims by other people, beyond the rental fee and deposit you paid for that
          booking. You are responsible for any injury, damage to property or claim caused by your flying. Nothing in these terms limits any right or liability that cannot be limited under Malaysian law.
        </p>
      </LegalSection>

      <LegalSection title="10. Changes to these terms">
        <p>We may update these terms. The terms in force when you make a booking apply to that booking.</p>
      </LegalSection>

      <LegalSection title="11. Governing law and contact">
        <p>
          These terms are governed by the laws of Malaysia, and disputes are subject to the courts of Malaysia. Questions? See our{" "}
          <Link href="/legal/contact" className="underline underline-offset-2">Contact page</Link>.
        </p>
      </LegalSection>
    </>
  );
}
