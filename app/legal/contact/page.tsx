import { BUSINESS, LEGAL_UPDATED, SHOPS } from "@/lib/legal";
import { LegalSection, LegalTitle } from "../LegalSection";

export const metadata = {
  title: "Contact — ProCam Rental",
  description: "How to reach ProCam Rental and where to collect your drone.",
};

export default function ContactPage() {
  return (
    <>
      <LegalTitle title="Contact" updated={LEGAL_UPDATED} />

      <LegalSection title="Questions, cancellations and refunds">
        <p>
          Please include your booking number (it starts with DBK-) and the name and phone number you booked with, so we can find your booking quickly.
        </p>
        {BUSINESS.supportEmail && (
          <p>
            Email: <a href={`mailto:${BUSINESS.supportEmail}`} className="underline underline-offset-2">{BUSINESS.supportEmail}</a>
          </p>
        )}
        {BUSINESS.supportPhone && <p>Phone / WhatsApp: {BUSINESS.supportPhone}</p>}
        <p>You can also ask the staff at the shop where you collect your drone.</p>
      </LegalSection>

      <LegalSection title="Our shops">
        {SHOPS.map((shop) => (
          <p key={shop.name}>
            <span className="font-medium text-black dark:text-zinc-200">{shop.name}</span>
            <br />
            {shop.address}
          </p>
        ))}
      </LegalSection>

      <LegalSection title="The business">
        <p>
          {BUSINESS.registeredName ? `${BUSINESS.registeredName}, trading as ${BUSINESS.brand}, Malaysia.` : `${BUSINESS.brand}, Malaysia.`}
          {BUSINESS.ssmNumber && <> SSM registration number: {BUSINESS.ssmNumber}.</>}
        </p>
      </LegalSection>
    </>
  );
}
