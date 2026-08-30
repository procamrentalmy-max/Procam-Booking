export function ComingSoon({ title, note }: { title: string; note: string }) {
  return (
    <div className="pt-6 text-center">
      <h1 className="text-lg font-semibold text-black dark:text-zinc-50">{title}</h1>
      <p className="mt-2 text-sm text-zinc-500">{note}</p>
    </div>
  );
}
