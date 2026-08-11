# Contributing

Floo Agents is in active development. Small, focused pull requests are easiest
to review while the architecture is still settling.

## Setup

```bash
bun install
bun run typecheck
bun test
```

For local services, copy the app `.env.example` files described in the README.
Do not commit secrets, local databases, or generated runtime data.

You also need [gitleaks](https://github.com/gitleaks/gitleaks) for the pre-commit hook:

```bash
brew install gitleaks
```

## Hooks

`bun install` sets up husky, which installs a pre-commit hook that runs two fast
checks over your **staged** files:

- `biome` — formatting and lint. If it fails, `bun run format`, then re-stage.
- `gitleaks` — secret scanning. If it fails, remove the secret; don't `--no-verify`
  past it.

The hook deliberately stays under a second. Typecheck, tests, and the web build run
in CI, because a slow hook just teaches people to skip it.

## Checks

CI runs on every pull request: `lint`, `typecheck`, `test`, a web build, and a
gitleaks scan of every commit in the branch. To run the same gate locally:

```bash
bun run lint
bun run typecheck
bun test
bun run --filter '@agent-platform/web' build
gitleaks git . --redact
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
