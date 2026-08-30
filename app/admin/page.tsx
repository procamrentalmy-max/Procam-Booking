import Link from "next/link";

const SECTIONS = [
  { href: "/admin/partners", label: "Partners", note: "Properties, commission rates, QR codes" },
  { href: "/admin/rental-packages", label: "Rental Packages", note: "Durations, pricing, deposits" },
  { href: "/admin/cameras", label: "Cameras", note: "Fleet status by property" },
  { href: "/admin/kits", label: "Kits", note: "Accessory pouches" },
  { href: "/admin/batteries", label: "Batteries", note: "Battery fleet by property" },
];

export default function AdminHome() {
  return (
    <div className="grid gap-3 pt-4 sm:grid-cols-2">
      {SECTIONS.map((s) => (
        <Link
          key={s.href}
          href={s.href}
          className="rounded-xl border border-zinc-200 p-4 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
        >
          <p className="font-medium text-black dark:text-zinc-50">{s.label}</p>
          <p className="text-sm text-zinc-500">{s.note}</p>
        </Link>
      ))}
    </div>
  );
}
