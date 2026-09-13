import Link from "next/link";

/**
 * The camera mark used when no logo has been uploaded yet (lib/branding.ts).
 * The lens rings are cut out with an SVG mask rather than filled to match a
 * background color, so it reads correctly on any page background, light or
 * dark, with no per-page tuning.
 */
function DefaultMark({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <defs>
        <mask id="procam-logo-lens" maskUnits="userSpaceOnUse">
          <rect width="100" height="100" fill="white" />
          <circle cx="50" cy="58" r="21" fill="black" />
          <circle cx="50" cy="58" r="13" fill="white" />
          <circle cx="50" cy="58" r="5" fill="black" />
        </mask>
      </defs>
      <rect x="14" y="34" width="72" height="46" rx="10" fill="currentColor" mask="url(#procam-logo-lens)" />
      <polygon points="40,34 60,34 54,22 46,22" fill="currentColor" />
    </svg>
  );
}

/** The site's brand mark: the admin-uploaded logo if one exists, otherwise the default camera mark — always paired with the "ProCam Rental" name and linking home. */
export function Brand({
  logoUrl,
  href = "/",
  size = 28,
  className = "",
}: {
  logoUrl: string | null;
  href?: string;
  size?: number;
  className?: string;
}) {
  return (
    <Link href={href} className={`inline-flex items-center gap-2 text-black dark:text-zinc-50 ${className}`}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, not a local optimizable asset
        <img src={logoUrl} alt="" style={{ height: size, width: "auto" }} />
      ) : (
        <DefaultMark size={size} />
      )}
      <span className="font-semibold" style={{ fontSize: size * 0.6 }}>
        ProCam Rental
      </span>
    </Link>
  );
}
