import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The one page-title pattern: Archivo display title, actions on the right, optional
 * description. Display weight is titles-only — Archivo ships 800/900 here and turns muddy
 * below ~1.5rem, so don't reach for `font-display` on smaller headings.
 */
export function PageHeader({
  title,
  description,
  className,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn("mb-6 border-b border-border pb-4", className)}>
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate font-display text-3xl font-black tracking-[-0.04em] text-foreground">
            {title}
          </h1>
        </div>
        {children ? <div className="flex shrink-0 items-center gap-2">{children}</div> : null}
      </div>
      {description ? (
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
