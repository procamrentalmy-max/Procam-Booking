import Link from "next/link";

const ACTIONS = [
  { href: "/reception/pickup", label: "Check Customer Pickup" },
  { href: "/reception/return", label: "Receive Return" },
  { href: "/reception/battery-exchange", label: "Battery Exchange" },
];

export default function ReceptionHome() {
  return (
    <div className="flex flex-col gap-4 pt-6">
      {ACTIONS.map((action) => (
        <Link
          key={action.href}
          href={action.href}
          className="flex h-24 items-center justify-center rounded-2xl bg-black px-6 text-center text-xl font-semibold text-white dark:bg-white dark:text-black"
        >
          {action.label}
        </Link>
      ))}
    </div>
  );
}
