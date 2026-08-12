---
name: ui-conventions
description: How to build UI in Floo Agents' apps/web. Read BEFORE adding or restyling any screen — covers the Paper & Ink design tokens in packages/design-tokens, the no-literal-values rule, the display/sans/mono type roles, PageHeader, the theme mechanism, shadcn-on-Base-UI conventions (the `render` prop, never `asChild`), and how a page reaches the control plane. Triggers "add a page", "style this", "what colour", "dark mode", "theme", "Tailwind", "shadcn", "component", "UI", "design system".
---

# Building UI in Floo Agents

`apps/web` is the Next.js App Router console. Its look is **Paper & Ink**: a warm editorial console — paper background, near-square 4px radius, borders instead of shadows, a heavy display face for page titles, and monospace for every value an operator reads.

The palette is **monochrome by choice**. Character comes from the display face, mono controls, warm paper and density — not from an accent colour. Colour is reserved for status (`--success` / `--warning` / `--destructive`) and for vendor marks (harness logos).

**Home is the agent builder.** `/` is a launcher: one centred prompt ("What agent do you want to build?"), then your agents and recent builds. It hands the first message to `/chat/agent-builder?prompt=…` rather than duplicating the streaming machinery — see `lib/builder.ts`. Keep home sparse; the input is the only element on it that should carry weight.

## Where the tokens live

**[`packages/design-tokens/tokens.css`](../../../packages/design-tokens/tokens.css)** — a workspace package so the landing page (#16) and docs site (#15) inherit the same look. Tokens are published under **shadcn's variable names**, which is why every vendored component picks up the palette without modification.

```css
/* apps/web/app/globals.css — imported last so its :root wins over shadcn's defaults */
@import "../../../packages/design-tokens/tokens.css";
```

> Relative, not `@floo/design-tokens/tokens.css`. Tailwind's CSS resolver doesn't do bare-specifier lookup here, and Node rejects `imports` targets inside `node_modules`. Don't "fix" this to a package specifier without checking `next dev` still compiles.

## The one rule

**Never write a literal colour, radius, or font family.** No `bg-white`, no `ring-black/10`, no `#hex`, no `bg-green-500`, no `rounded-2xl` chosen by eye. Reach for a token — and if the value you need doesn't exist, **add it to `tokens.css` in both palettes**, never inline it at the call site. A literal is invisible in Paper and wrong in Ink.

Two exceptions, both deliberate:
- **Scrims** — `bg-black/35` behind a dialog is correct in both palettes.
- **Third-party brand values** — the Slack manifest `background_color` in `ConnectionForm.tsx`, and the Slack logo's `fill=` attributes in `agents/[id]/page.tsx`.

## Tokens worth knowing

| Token | Means | Watch out |
| --- | --- | --- |
| `--background` / `--foreground` | page paper / ink | |
| `--card`, `--popover` | raised surface | |
| `--muted-foreground` | secondary text | |
| `--border`, `--input` | hairlines | |
| `--primary` | **primary actions — ink** | one value drives buttons, badges, the sidebar mark, avatars and selected states |
| `--brand` | emphasis: eyebrow rules, `hover:border-brand` | points at ink today — **the single seam for an accent colour**; change it in both palettes and nothing else moves |
| `--accent` | shadcn's *hover / active background* — a warm neutral | **not** a brand colour; pairs with `--accent-foreground` |
| `--tile` | light chip behind a vendor logo | harness marks are warm orange (`#D97757`) and sink into paper without it |
| `--success` / `--warning` / `--destructive` | status only | use these, never `green-500` / `amber-200` |
| `--radius` | `4px`, flat across the whole `sm→lg` scale | the system is near-square; don't reintroduce a radius ramp or `rounded-full` on anything but dots and avatars |

## Type roles

Three faces, loaded via `next/font/google` in [`app/layout.tsx`](../../../apps/web/app/layout.tsx) — self-hosted and subset, so no third-party request and no CLS.

| Class | Face | Use for |
| --- | --- | --- |
| `font-display` | Archivo **800/900 only** | page titles. Those are the only weights loaded — anything lighter synthesizes. Muddy below ~1.5rem |
| `font-sans` | Inter | prose, descriptions, body copy |
| `font-mono` | JetBrains Mono | ids, models, versions, counts, timestamps, paths — anything read as *data*. Also every control: buttons, inputs, labels, badges, table headers, nav |

`--font-heading` deliberately maps to **sans**, not display: shadcn puts it on `CardTitle` at weight 500, which Archivo can't serve.

**Card and list-item titles are mono bold** (`font-mono text-[0.9rem] font-bold`) — that carries much of the character. Page titles are the display face.

## Components

shadcn on **Base UI**, style `base-nova`, vendored into [`components/ui/`](../../../apps/web/components/ui/). Vendored means *ours* — edit them in place when the design system needs it rather than wrapping them. The mono/uppercase treatment on buttons, inputs, labels, badges and table headers lives there, so a new page gets it for free.

**Base UI uses a `render` prop, not `asChild`.** There are zero `asChild` in the repo and it will not work.

```tsx
<Button render={<Link href="/agents/new" />} nativeButton={false}>New agent</Button>
```

**[`components/page-header.tsx`](../../../apps/web/components/page-header.tsx)** is the one page-title pattern — Archivo title, actions slot, optional description, bottom rule. Use it instead of a hand-rolled `<h1>`:

```tsx
<PageHeader title="Agents">
  <Button size="sm" render={<Link href="/agents/new" />} nativeButton={false}>New agent</Button>
</PageHeader>
```

No eyebrow/kicker above the title — "Workspace", "Access" and friends were removed deliberately; they said nothing the title didn't. Detail pages (`agents/[id]`, `skills/[name]`) keep their own richer headers with a vendor tile and meta line; they use `font-display` directly rather than `PageHeader`.

Icons are `lucide-react`. App-level components (not vendored primitives) go directly in `components/`.

## Theme

Paper is the default; Ink applies only when explicitly chosen. `.dark` on `<html>` drives it via the existing `@custom-variant dark (&:is(.dark *))`.

- [`lib/theme.ts`](../../../apps/web/lib/theme.ts) — `resolveTheme()` plus `THEME_INIT_SCRIPT`, which runs in `<head>` before first paint so Ink users never flash Paper. Covered by `lib/theme.test.ts`.
- [`components/theme-toggle.tsx`](../../../apps/web/components/theme-toggle.tsx) — the `INK | PAPER` control in the sidebar footer.

Always check a change in **both**: `localStorage.setItem("console-theme", "ink")` then reload.

## Pages

Client components by default — pages fetch on mount and hold local state. Reserve server components for pages with no interactivity.

Pages reach the control plane through a same-origin `/api` prefix, never a hardcoded host:

```ts
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api";
```

`next.config.mjs` rewrites `/api/:path*` to `API_URL ?? http://localhost:4000`.

## Recipes

**Adding a colour** — add it to *both* `:root` and `.dark` in `tokens.css`. To reach it as a utility (`bg-brand`), also map it in the `@theme inline` block in `globals.css`.

**Restyling a screen** — change tokens first, then the vendored primitive; only reach for per-component classes when a token genuinely can't express it. A change made in `components/ui/` lands on every page at once.

**Checking your work** — `bun run dev:web` with the control plane on :4000, then view in both palettes. Non-trivial pure logic gets one `bun:test` file beside it (see `lib/theme.test.ts`); see the `test-conventions` skill.
