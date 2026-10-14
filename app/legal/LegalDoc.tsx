import Link from "next/link";
import type { ReactNode } from "react";
import { CONTROLLER_PROFILES, DRONE_MODEL_PROFILES } from "@/lib/droneRental/pricingRules";
import { BUSINESS, FREE_CANCELLATION_HOURS, HOLD_DAYS, LATE_GRACE_MINUTES, legalUpdatedLabel, registeredNameDiffers } from "@/lib/legal";
import { legalText, type LegalPage } from "@/lib/i18n/legal";
import type { Locale } from "@/lib/i18n/locale";
import { LegalList, LegalSection, LegalTitle } from "./LegalSection";

/** The numbers and names the legal text refers to, taken from the live pricing rules so the pages never disagree with the booking page. */
function legalValues(): Record<string, string> {
  const registered = registeredNameDiffers() ? ` (${BUSINESS.registeredName}${BUSINESS.ssmNumber ? `, SSM ${BUSINESS.ssmNumber}` : ""})` : BUSINESS.ssmNumber ? ` (SSM ${BUSINESS.ssmNumber})` : "";
  return {
    business: `${BUSINESS.brand}${registered}`,
    neo2Dep: `RM${DRONE_MODEL_PROFILES.NEO2.depositDroneMyr}`,
    neoDep: `RM${DRONE_MODEL_PROFILES.NEO.depositDroneMyr}`,
    rcDep: `RM${CONTROLLER_PROFILES.RC_N3.depositMyr}`,
    goggDep: `RM${CONTROLLER_PROFILES.GOGGLES_N3.depositMyr}`,
    holdDays: String(HOLD_DAYS),
    grace: String(LATE_GRACE_MINUTES),
    freeHours: String(FREE_CANCELLATION_HOURS),
    neo2Wind: String(DRONE_MODEL_PROFILES.NEO2.maxWindMps),
    neoWind: String(DRONE_MODEL_PROFILES.NEO.maxWindMps),
  };
}

const LINK_PATHS: Record<string, string> = { terms: "/legal/terms", refunds: "/legal/refunds", privacy: "/legal/privacy", contact: "/legal/contact" };

/** Fills {placeholders} with values and turns {link:name} into a link, named in the visitor's language. */
export function renderLegalText(text: string, locale: Locale): ReactNode[] {
  const values = legalValues();
  const names = legalText(locale).links as Record<string, string>;
  return text.split(/(\{link:\w+\}|\{\w+\})/g).map((part, i) => {
    const link = part.match(/^\{link:(\w+)\}$/);
    if (link && LINK_PATHS[link[1]]) {
      return (
        <Link key={i} href={LINK_PATHS[link[1]]} className="underline underline-offset-2">
          {names[link[1]]}
        </Link>
      );
    }
    const value = part.match(/^\{(\w+)\}$/);
    if (value && value[1] in values) return values[value[1]];
    return part;
  });
}

/** One legal page (Terms, Refunds or Privacy) in the visitor's language. */
export function LegalDoc({ page, locale }: { page: LegalPage; locale: Locale }) {
  const t = legalText(locale);
  return (
    <>
      <LegalTitle title={page.title} updated={t.updated(legalUpdatedLabel(locale))} />
      {page.sections.map((section) => (
        <LegalSection key={section.title} title={section.title}>
          {section.blocks.map((block, i) =>
            "p" in block ? <p key={i}>{renderLegalText(block.p, locale)}</p> : <LegalList key={i} items={block.ul.map((item) => renderLegalText(item, locale))} />
          )}
        </LegalSection>
      ))}
    </>
  );
}
