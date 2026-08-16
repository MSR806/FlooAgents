# Contributing

Floo Agents is in active development. Small, focused pull requests are easiest
to review while the architecture is still settling.

## Setup

```bash
bun install
bun run typecheck
bun run test
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
bun run test
bun run --filter '@floo/web' build
gitleaks git . --redact
```

## Pull requests

- Open an issue first for large changes or new public APIs.
- Keep changes scoped to one problem.
- Add or update tests when behavior changes.
- Make sure CI is green before requesting review.
- Document user-facing behavior in `README.md` or `docs/` when needed.

### PR titles

Title the PR, not just the commit — squash-merge uses it as the commit message.
Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` new feature or functionality
- `fix:` bug fix
- `docs:` documentation or README changes
- `chore:` maintenance tasks, tooling, non-dependency housekeeping
- `build:` dependency bumps (this is what Dependabot opens)
- `refactor:` code restructuring without changing behavior
- `test:` adding or updating tests

Add a scope when a change is limited to one app or package — an `apps/`
or `packages/` directory name (`web`, `gateway`, `harness`, `control-plane`,
`core`, `db`, `runtime`, ...), or a cross-cutting area like `tools` or `deps`
when it spans several. Skip the scope for repo-wide changes.

Examples:

```text
feat(tools): select integrations by toolkit
fix(web): load direct conversation links
docs: add repo development skills to the roadmap
build(deps): bump the minor group across 1 directory with 3 updates
chore: manage hooks with husky, add gitleaks secret scanning
refactor(gateway): simplify connector auth lookup
```

Security problems go through [SECURITY.md](SECURITY.md), not a public issue.

## Development status

This project is not API-stable yet. Maintainers may rename packages, move modules,
or revise contracts while the MVP is being built.
