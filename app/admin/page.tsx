import Link from "next/link";

type Section = { href: string; label: string; note: string };

const GROUPS: { title: string; sections: Section[] }[] = [
  {
    title: "Drone rental",
    sections: [
      { href: "/admin/drone-rental", label: "Drone Rental", note: "Shops, drones, batteries, merchant assignments" },
      { href: "/admin/drone-rental/damage", label: "Damage Review", note: "Tonight: type the amount to keep for each damaged item and capture it from the deposit" },
      { href: "/admin/drone-rental/sales", label: "Drone Sales", note: "Drone revenue only: by month, shop, drone and rental length" },
    ],
  },
  {
    title: "Hotel locker rentals: day to day",
    sections: [
      { href: "/admin/bookings", label: "Bookings", note: "All bookings, testing helpers" },
      { href: "/admin/damage-cases", label: "Damage Cases", note: "Deposit decisions on damage reports" },
      { href: "/admin/rental-assets", label: "Rental Assets", note: "Fleet status by property" },
      { href: "/admin/batteries", label: "Batteries", note: "Battery fleet by property" },
      { href: "/admin/travel-times", label: "Travel Times", note: "Drive times between lockers, for route planning" },
      { href: "/admin/capacity", label: "Capacity", note: "Where demand is outgrowing cameras or photo slots" },
    ],
  },
  {
    title: "Hotel locker rentals: business",
    sections: [
      { href: "/admin/sales", label: "Sales", note: "Revenue by locker, month, package, and product" },
      { href: "/admin/funnel", label: "Funnel", note: "QR scans through to paid, and where people drop off" },
      { href: "/admin/partners", label: "Partners", note: "Properties, commission rates, QR codes" },
      { href: "/admin/products", label: "Products", note: "Rental product lines, phone compatibility" },
      { href: "/admin/rental-packages", label: "Rental Packages", note: "Durations, pricing, deposits" },
    ],
  },
  {
    title: "Settings",
    sections: [
      { href: "/admin/staff", label: "Staff", note: "Add and manage staff, merchant and admin accounts" },
      { href: "/admin/branding", label: "Branding", note: "The logo, and the pictures on the landing page" },
    ],
  },
];

export default function AdminHome() {
  return (
    <div className="space-y-8 pt-4">
      {GROUPS.map((group) => (
        <section key={group.title}>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">{group.title}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {group.sections.map((s) => (
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
        </section>
      ))}
    </div>
  );
}
