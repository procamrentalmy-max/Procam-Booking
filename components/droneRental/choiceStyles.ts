import { pressableClass } from "@/components/formStyles";

/** The look of the picker buttons. The booking pages follow the visitor's light or dark theme; the landing page is always dark, on slate-coloured panels that stand out from the black, so it asks for `onDark`. */
export function choiceStyles(onDark = false) {
  return onDark
    ? {
        selected: "border-white bg-white text-black shadow-md shadow-black/30",
        idle: "cursor-pointer border-slate-400 bg-slate-700 text-zinc-50 shadow-md shadow-black/30 transition hover:-translate-y-px hover:border-white hover:bg-slate-600 active:translate-y-0",
        unavailable: "cursor-not-allowed border-slate-700 bg-transparent text-slate-500",
        sub: "text-slate-300",
      }
    : {
        selected: "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black",
        idle: pressableClass,
        unavailable: "cursor-not-allowed border-zinc-200 text-zinc-300 dark:border-zinc-800 dark:text-zinc-700",
        sub: "text-zinc-500",
      };
}
