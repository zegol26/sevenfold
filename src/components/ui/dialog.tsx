"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;

const DISCARD_MESSAGE = "You have unsaved changes. Discard them and close?";

/**
 * Shared form-safety context for every dialog in the app.
 *
 * - `markDirty` is flipped by any input/change event inside the dialog body, so a
 *   partially completed form is recognized as "dirty".
 * - Outside clicks NEVER silently close a dirty dialog, and clicks inside portalled
 *   popovers/selects/calendars (Radix poppers render outside the dialog DOM) never
 *   count as "outside" at all.
 * - Escape / the X button / Cancel on a dirty dialog ask for explicit discard
 *   confirmation instead of silently dropping the entered data.
 * - `requestClose` lets a successfully submitted form close its dialog
 *   programmatically (see components/ui/action-form.tsx).
 */
type DialogFormGuard = {
  requestClose: () => void;
  markClean: () => void;
  isDirty: () => boolean;
};

const DialogFormGuardContext = React.createContext<DialogFormGuard | null>(null);

export function useDialogFormGuard() {
  return React.useContext(DialogFormGuardContext);
}

function isInsidePortalledLayer(target: EventTarget | null) {
  return target instanceof Element && Boolean(
    target.closest(
      "[data-radix-popper-content-wrapper], [data-radix-select-viewport], [data-radix-dropdown-menu-content], [role='listbox'], [role='menu']",
    ),
  );
}

function DialogOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return <DialogPrimitive.Overlay className={cn("fixed inset-0 z-50 bg-slate-950/45", className)} {...props} />;
}

function DialogContent({ className, children, ...props }: React.ComponentProps<typeof DialogPrimitive.Content>) {
  const dirtyRef = React.useRef(false);
  const hiddenCloseRef = React.useRef<HTMLButtonElement>(null);

  const guard = React.useMemo<DialogFormGuard>(() => ({
    requestClose: () => {
      dirtyRef.current = false;
      hiddenCloseRef.current?.click();
    },
    markClean: () => {
      dirtyRef.current = false;
    },
    isDirty: () => dirtyRef.current,
  }), []);

  // Native listeners so changes from Radix Select's hidden form controls (which fire
  // native, bubbling change events) also mark the dialog dirty.
  const attachDirtyTracking = React.useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const markDirty = () => {
      dirtyRef.current = true;
    };
    node.addEventListener("input", markDirty);
    node.addEventListener("change", markDirty);
  }, []);

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={attachDirtyTracking}
        className={cn(
          "fixed left-1/2 top-1/2 z-50 grid max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-lg border bg-card p-6 shadow-lg",
          className,
        )}
        onInteractOutside={(event) => {
          // A click inside a portalled select/popover/menu is not an outside click.
          if (isInsidePortalledLayer(event.target)) {
            event.preventDefault();
            return;
          }
          // An accidental outside click must never silently discard entered data.
          if (dirtyRef.current) {
            event.preventDefault();
          }
        }}
        onEscapeKeyDown={(event) => {
          if (dirtyRef.current && !window.confirm(DISCARD_MESSAGE)) {
            event.preventDefault();
          }
        }}
        {...props}
      >
        <DialogFormGuardContext.Provider value={guard}>
          {children}
        </DialogFormGuardContext.Provider>
        <DialogPrimitive.Close
          className="absolute end-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Close"
          onClick={(event) => {
            if (dirtyRef.current && !window.confirm(DISCARD_MESSAGE)) {
              event.preventDefault();
            }
          }}
        >
          <X className="h-4 w-4" />
        </DialogPrimitive.Close>
        {/* Programmatic close target for successfully submitted forms. */}
        <DialogPrimitive.Close ref={hiddenCloseRef} className="hidden" tabIndex={-1} aria-hidden="true" />
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

/** DialogClose that respects dirty-form confirmation (used for Cancel buttons). */
function DialogClose({ onClick, ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  const guard = React.useContext(DialogFormGuardContext);
  return (
    <DialogPrimitive.Close
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        if (guard?.isDirty() && !window.confirm(DISCARD_MESSAGE)) {
          event.preventDefault();
        }
      }}
      {...props}
    />
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1.5 text-left", className)} {...props} />;
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />;
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn("text-lg font-semibold leading-none", className)} {...props} />;
}

function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

export { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger };
