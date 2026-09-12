import Link from "next/link";

const SECTIONS = [
  { href: "/admin/bookings", label: "Bookings", note: "All bookings, testing helpers" },
  { href: "/admin/sales", label: "Sales", note: "Revenue by locker, month, package, and product" },
  { href: "/admin/funnel", label: "Funnel", note: "QR scans through to paid — where people drop off" },
  { href: "/admin/damage-cases", label: "Damage Cases", note: "Deposit decisions on damage reports" },
  { href: "/admin/partners", label: "Partners", note: "Properties, commission rates, QR codes" },
  { href: "/admin/travel-times", label: "Travel Times", note: "Drive times between lockers, for route planning" },
  { href: "/admin/products", label: "Products", note: "Rental product lines, phone compatibility" },
  { href: "/admin/rental-packages", label: "Rental Packages", note: "Durations, pricing, deposits" },
  { href: "/admin/rental-assets", label: "Rental Assets", note: "Fleet status by property" },
  { href: "/admin/batteries", label: "Batteries", note: "Battery fleet by property" },
  { href: "/admin/staff", label: "Staff", note: "Add and manage staff & admin accounts" },
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
