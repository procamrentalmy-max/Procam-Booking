/** The look of the picker buttons. The booking pages follow the visitor's light or dark theme; the landing page is always dark, so it asks for `onDark`. */
export function choiceStyles(onDark = false) {
  return onDark
    ? {
        selected: "border-white bg-white text-black",
        idle: "border-zinc-700 text-zinc-200",
        unavailable: "cursor-not-allowed border-zinc-800 text-zinc-700",
        sub: "text-zinc-400",
      }
    : {
        selected: "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black",
        idle: "border-zinc-300 dark:border-zinc-700",
        unavailable: "cursor-not-allowed border-zinc-200 text-zinc-300 dark:border-zinc-800 dark:text-zinc-700",
        sub: "text-zinc-500",
      };
}
