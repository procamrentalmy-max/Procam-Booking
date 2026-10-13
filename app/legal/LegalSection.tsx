export function LegalTitle({ title, updated }: { title: string; updated: string }) {
  return (
    <div>
      <h1 className="text-xl font-semibold text-black dark:text-zinc-50">{title}</h1>
      <p className="mt-1 text-sm text-zinc-500">Last updated {updated}.</p>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold text-black dark:text-zinc-50">{title}</h2>
      <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">{children}</div>
    </section>
  );
}

export function LegalList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
