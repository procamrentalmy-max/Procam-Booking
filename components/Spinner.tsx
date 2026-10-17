/** A small spinning circle in the colour of the text around it, for buttons that are busy. */
export function Spinner({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} />;
}
