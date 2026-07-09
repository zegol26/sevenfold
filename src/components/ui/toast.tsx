"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Toast as ToastPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

const ToastProvider = ToastPrimitive.Provider;
const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Viewport
    ref={ref}
    className={cn("fixed bottom-0 right-0 z-100 flex max-h-screen w-full flex-col-reverse p-4 sm:max-w-sm", className)}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitive.Viewport.displayName;

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Root>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Root
    ref={ref}
    className={cn("grid gap-1 rounded-lg border bg-card p-4 text-card-foreground shadow-lg", className)}
    {...props}
  />
));
Toast.displayName = ToastPrimitive.Root.displayName;

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Title>
>(({ className, ...props }, ref) => <ToastPrimitive.Title ref={ref} className={cn("text-sm font-semibold", className)} {...props} />);
ToastTitle.displayName = ToastPrimitive.Title.displayName;

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Description>
>(({ className, ...props }, ref) => <ToastPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />);
ToastDescription.displayName = ToastPrimitive.Description.displayName;

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Close ref={ref} className={cn("absolute end-2 top-2 rounded-md p-1 text-muted-foreground hover:text-foreground", className)} {...props}>
    <X className="h-4 w-4" />
  </ToastPrimitive.Close>
));
ToastClose.displayName = ToastPrimitive.Close.displayName;

export { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport };
