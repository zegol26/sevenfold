"use client";

import * as React from "react";
import { AlertCircle } from "lucide-react";
import { useDialogFormGuard } from "@/components/ui/dialog";

type ActionResult =
  | { status: "idle" }
  | { status: "success"; at: number }
  | { status: "error"; message: string; at: number };

/** Broadcast so the dashboard shell can show a single consistent success toast. */
export const ACTION_SUCCESS_EVENT = "sevenfold:action-success";

function isNextControlFlowError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    ((error as { digest: string }).digest.startsWith("NEXT_REDIRECT") ||
      (error as { digest: string }).digest.startsWith("NEXT_HTTP_ERROR"))
  );
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message && !/Server Components render/.test(error.message)) {
    return error.message;
  }
  return "The request could not be completed. Your entries are preserved — review the fields and try again.";
}

/**
 * Standard wrapper for every mutating form in the app.
 *
 * Guarantees (see UX audit, section D):
 * - A failed submission keeps every entered value and shows an actionable error.
 * - Submissions cannot be duplicated: inputs and buttons are disabled while pending.
 * - A clear submitting state (aria-busy + disabled controls).
 * - Consequential actions can require explicit confirmation via `confirmMessage`.
 * - On success: closes the enclosing dialog (if any) and emits a success toast event;
 *   server actions revalidate data so the affected lists refresh automatically.
 */
export function ActionForm({
  action,
  className,
  children,
  confirmMessage,
  successMessage = "Saved successfully.",
}: {
  action: (formData: FormData) => Promise<void>;
  className?: string;
  children: React.ReactNode;
  /** Ask before actions with business consequences (approvals, rejections, gate moves). */
  confirmMessage?: string;
  successMessage?: string;
}) {
  const guard = useDialogFormGuard();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [result, dispatch, pending] = React.useActionState<ActionResult, FormData>(
    async (_previous, formData) => {
      try {
        await action(formData);
        return { status: "success", at: Date.now() };
      } catch (error) {
        if (isNextControlFlowError(error)) throw error;
        return { status: "error", message: errorMessage(error), at: Date.now() };
      }
    },
    { status: "idle" },
  );

  React.useEffect(() => {
    if (result.status === "success") {
      document.dispatchEvent(new CustomEvent(ACTION_SUCCESS_EVENT, { detail: { message: successMessage } }));
      // Reset only on success (never on failure), then close the enclosing dialog.
      formRef.current?.reset();
      guard?.requestClose();
    }
  }, [result, guard, successMessage]);

  return (
    <form
      ref={formRef}
      className={className}
      aria-busy={pending}
      onSubmit={(event) => {
        // Manual dispatch (instead of the form `action` prop) so React does not
        // auto-reset the fields — a failed save must preserve everything typed.
        event.preventDefault();
        if (pending) return;
        if (confirmMessage && !window.confirm(confirmMessage)) return;
        const formData = new FormData(event.currentTarget);
        React.startTransition(() => dispatch(formData));
      }}
    >
      {result.status === "error" && (
        <div
          role="alert"
          className="col-span-full mb-1 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
          <span>{result.message}</span>
        </div>
      )}
      {/* display:contents keeps grid layouts intact while still disabling all
          controls during submission (duplicate-submit prevention). */}
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
    </form>
  );
}
