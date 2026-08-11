import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The one page-title pattern: optional icon tile, Archivo display title, an optional mono meta
 * line, actions on the right. Display weight is titles-only — Archivo ships 800/900 here and turns
 * muddy below ~1.5rem, so don't reach for `font-display` on smaller headings.
 */
export function PageHeader({
  icon,
  title,
  meta,
  description,
  className,
  children,
}: {
  /** Vendor mark or glyph shown in a tile beside the title (detail pages). */
  icon?: ReactNode;
  title: ReactNode;
  /** Mono strip under the title — ids, harness, model. */
  meta?: ReactNode;
  description?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn("mb-6 border-b border-border pb-4", className)}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {icon ? (
            <span className="flex size-11 shrink-0 items-center justify-center rounded-sm bg-tile p-2 ring-1 ring-border">
              {icon}
            </span>
          ) : null}
          <div className="min-w-0">
            <h1 className="truncate font-display text-3xl font-black tracking-[-0.04em] text-foreground">
              {title}
            </h1>
            {meta ? (
              <p className="mt-1 flex flex-wrap items-center gap-x-2 font-mono text-[0.72rem] text-muted-foreground">
                {meta}
              </p>
            ) : null}
          </div>
        </div>
        {children ? <div className="flex shrink-0 items-center gap-2">{children}</div> : null}
      </div>
      {description ? (
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
