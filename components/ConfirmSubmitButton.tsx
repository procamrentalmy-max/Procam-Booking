"use client";

import type { ButtonHTMLAttributes } from "react";

/**
 * A plain submit button that native-confirms before letting the form
 * actually submit — for destructive actions inside a server-action form,
 * where wiring up a full client-side confirm modal would be overkill.
 */
export function ConfirmSubmitButton({
  confirmMessage,
  children,
  ...props
}: { confirmMessage: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      type="submit"
      onClick={(e) => {
        if (!window.confirm(confirmMessage)) {
          e.preventDefault();
        }
      }}
    >
      {children}
    </button>
  );
}
