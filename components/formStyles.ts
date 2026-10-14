/**
 * The look of anything the visitor can press that is not the main black button: choices (pick one of several), Back, Cancel, Directions.
 * Filled, with a firmer outline and a soft shadow, and it lifts a little under the mouse, so it reads as pressable rather than as a box.
 * `pressableBase` has no text colour, for the few buttons that bring their own (a red Decline).
 */
export const pressableBase =
  "cursor-pointer border-zinc-400 bg-zinc-100 shadow-sm transition hover:-translate-y-px hover:border-black hover:bg-white active:translate-y-0 dark:border-zinc-500 dark:bg-zinc-800 dark:hover:border-white dark:hover:bg-zinc-700";
export const pressableClass = `${pressableBase} text-zinc-900 dark:text-zinc-100`;

export const inputClass =
  "rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";
export const primaryButtonClass =
  "rounded bg-black px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-black";
export const dangerButtonClass = "rounded bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700";
