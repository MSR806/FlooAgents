export type Theme = "paper" | "ink";

export const THEME_STORAGE_KEY = "gilly-theme";

/** Paper is the default — Ink applies only when it was explicitly chosen. */
export const resolveTheme = (stored: string | null): Theme => (stored === "ink" ? "ink" : "paper");

/**
 * Runs before first paint in <head>, so an Ink user never flashes Paper.
 * Kept as a string because it has to execute ahead of hydration.
 */
export const THEME_INIT_SCRIPT = `try{if(localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)})==="ink")document.documentElement.classList.add("dark")}catch(e){}`;
