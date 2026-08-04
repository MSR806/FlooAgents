# Contributing

Project Gilly is in active development. Small, focused pull requests are easiest
to review while the architecture is still settling.

## Setup

```bash
bun install
bun run typecheck
bun test
```

For local services, copy the app `.env.example` files described in the README.
Do not commit secrets, local databases, or generated runtime data.

`bun install` also points git at `.githooks/`, which adds a pre-commit hook running
`biome` over your staged files (~100ms). If it rejects a commit, `bun run format`
fixes the formatting — then re-stage.

## Checks

CI runs on every pull request: `lint`, `typecheck`, `test`, and a web build. To run
the same gate locally:

```bash
bun run lint
bun run typecheck
bun test
bun run --filter '@gilly/web' build
```

## Pull requests

- Open an issue first for large changes or new public APIs.
- Keep changes scoped to one problem.
- Add or update tests when behavior changes.
- Make sure CI is green before requesting review.
- Document user-facing behavior in `README.md` or `docs/` when needed.

Security problems go through [SECURITY.md](SECURITY.md), not a public issue.

## Development status

This project is not API-stable yet. Maintainers may rename packages, move modules,
or revise contracts while the MVP is being built.
