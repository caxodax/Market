import * as React from "react";
import { cn } from "../index";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "outline" | "success" | "warning" | "destructive";
}

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  const base =
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";

  const variants = {
    default: "bg-primary text-primary-foreground",
    secondary: "bg-secondary text-secondary-foreground",
    outline: "border border-border text-foreground",
    success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20",
    warning: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20",
    destructive: "bg-destructive text-destructive-foreground",
  };

  return (
    <div className={cn(base, variants[variant], className)} {...props} />
  );
}
