"use client";

import { useEffect, useState } from "react";
import { resolveTheme, THEME_STORAGE_KEY, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const OPTIONS: Theme[] = ["ink", "paper"];

export function ThemeToggle({ className }: { className?: string }) {
  // null until mounted — the server can't know what's in localStorage.
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(resolveTheme(localStorage.getItem(THEME_STORAGE_KEY)));
  }, []);

  function choose(next: Theme) {
    setTheme(next);
    localStorage.setItem(THEME_STORAGE_KEY, next);
    document.documentElement.classList.toggle("dark", next === "ink");
  }

  return (
    <fieldset
      className={cn("inline-flex w-fit overflow-hidden rounded-sm border border-border", className)}
    >
      <legend className="sr-only">Theme</legend>
      {OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={theme === option}
          onClick={() => choose(option)}
          className={cn(
            "px-2 py-1 font-mono text-[0.65rem] uppercase tracking-[0.12em] transition-colors",
            theme === option
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option}
        </button>
      ))}
    </fieldset>
  );
}
