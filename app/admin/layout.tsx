import { redirect } from "next/navigation";
import { getAuthContext, isAdmin, ROLE_HOME } from "@/lib/auth/session";
import { getLogoUrl } from "@/lib/branding";
import { AreaHeader } from "@/components/AreaHeader";
import { BackToDashboard } from "@/components/BackToDashboard";

// Titles for admin pages that don't draw their own heading.
const PAGE_TITLES: Record<string, string> = {
  "/admin/drone-rental": "Fleet",
  "/admin/drone-rental/bookings": "Drone Bookings",
  "/admin/drone-rental/damage": "Damage Review",
  "/admin/drone-rental/batteries": "Drone Batteries",
  "/admin/drone-rental/locations": "Locations traffic",
  "/admin/drone-rental/walk-in-qrs": "Walk-in QR codes",
  "/admin/merchants": "Merchants",
  "/admin/drone-rental/sales": "Drone Sales",
  "/admin/drone-rental/profit": "Drone Profit",
  "/admin/bookings": "Bookings",
  "/admin/damage-cases": "Damage Cases",
  "/admin/partners": "Partners",
  "/admin/products": "Products",
  "/admin/rental-packages": "Rental Packages",
  "/admin/rental-assets": "Rental Assets",
  "/admin/batteries": "Batteries",
  "/admin/staff": "Staff and admins",
  "/admin/tutorials": "Tutorials",
  "/admin/tutorials/phone": "Phone tutorial",
  "/admin/tutorials/controller": "Controller tutorial",
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login?next=/admin");
  if (!isAdmin(ctx)) redirect(ROLE_HOME[ctx.kind]);
  const logoUrl = await getLogoUrl();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <AreaHeader title="Admin" name={ctx.name} homeHref="/admin" logoUrl={logoUrl} />
      <main className="mx-auto max-w-5xl p-4">
        <BackToDashboard href="/admin" label="Admin home" titles={PAGE_TITLES} />
        {children}
      </main>
    </div>
  );
}
