import Link from "next/link";
import { HOTEL_LOCKERS_ENABLED } from "@/lib/features";

type Section = { href: string; label: string; note: string };

const GROUPS: { title: string; sections: Section[] }[] = [
  {
    title: "Day to day",
    sections: [
      { href: "/admin/drone-rental/bookings", label: "Bookings", note: "This month's numbers, the latest bookings, and the damage review waiting on you" },
      { href: "/admin/drone-rental/damage", label: "Damage Review", note: "Type the amount to keep for each damaged item and capture it from the deposit" },
    ],
  },
  {
    title: "Locations and fleet",
    sections: [
      { href: "/admin/merchants", label: "Merchants", note: "Every location and its merchant: add one, edit its name, address, map and hours, open it to customers, change its login" },
      { href: "/admin/drone-rental", label: "Fleet", note: "Drones, batteries and controllers, location by location, and adding to them" },
      { href: "/admin/drone-rental/batteries", label: "Drone Batteries", note: "Every battery by number, and how much each one has been used" },
      { href: "/admin/drone-rental/walk-in-qrs", label: "Walk-in QR codes", note: "Every location's permanent walk-in QR, to download and print" },
    ],
  },
  {
    title: "Performance",
    sections: [
      { href: "/admin/drone-rental/sales", label: "Sales", note: "Drone revenue by month, location, drone and rental length" },
      { href: "/admin/drone-rental/profit", label: "Profit", note: "Sales minus what each rental costs, against the 65% goal, with charts, payback and a forecast by day" },
      { href: "/admin/drone-rental/locations", label: "Location traffic", note: "Which locations customers tap, open and ask directions for, location by location and overall" },
      { href: "/admin/drone-rental/funnel", label: "Funnel", note: "Where customers drop off between the home page and paying" },
      { href: "/admin/flyers", label: "Flyers", note: "Businesses that display a flyer QR: their QR, scans, bookings, the 10% commission owed and payouts" },
    ],
  },
  {
    title: "Settings",
    sections: [
      { href: "/admin/staff", label: "Staff and admins", note: "Add and manage staff and admin logins (merchants are on the Merchants page)" },
      { href: "/admin/branding", label: "Branding", note: "The logo, the pictures on the landing page, and the payment QR" },
      { href: "/admin/whatsapp", label: "WhatsApp", note: "Booking messages on WhatsApp and by SMS: connection, templates to approve, what was sent" },
      { href: "/admin/tutorials", label: "Tutorials", note: "Headers with photos and videos for the Tutorial page" },
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
];

export default function AdminHome() {
  return (
    <div className="space-y-8 pt-4">
      {GROUPS.filter((group) => HOTEL_LOCKERS_ENABLED || !group.title.startsWith("Hotel locker")).map((group) => (
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
