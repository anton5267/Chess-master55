# Contributing Guidelines

Thanks for your interest in contributing to Chess-master55.

## Project Editions

- `docs/` contains the static GitHub Pages demo. It has no ASP.NET Core backend, Identity, SQL database, or SignalR server.
- `src/` contains the full ASP.NET Core app with MVC, SignalR, Identity, EF Core, SQL Server, multiplayer, bot games, chat, and stats.

Keep changes scoped to the edition you are modifying. If a behavior changes in both editions, update both places intentionally.

## Branching

- Base branch: `main`
- Feature branch pattern: `feature/<short-topic>`
- Fix branch pattern: `fix/<short-topic>`
- Release/ops branch pattern: `release/<short-topic>`

## Commit Style

Use conventional-style prefixes when possible:
- `feat:` new functionality
- `fix:` bug fix
- `docs:` documentation
- `test:` tests only
- `ci:` workflow/pipeline changes
- `refactor:` internal improvements without behavior change

Examples:
- `feat(game): add bot difficulty selector`
- `fix(ui): prevent stale terminal status override`

## Local Quality Gate (required before PR)

Run from the repository root unless a command says otherwise:

```bash
cd src/Web/Chess.Web
libman restore
npm ci
npm run build:assets
cd ../../..
dotnet restore src/Chess.sln
dotnet build src/Chess.sln --nologo
dotnet test src/Chess.sln --nologo
```

Windows-safe shortcut when a local web process may still be running:

```bash
cd src/Web/Chess.Web
npm run check:full:safe
```

If .NET reports that `net10.0` is not available, install the .NET 10 SDK/runtime before running the quality gate.

## Pull Request Checklist

- [ ] Scope is focused and clearly described.
- [ ] No unrelated files are included.
- [ ] Tests pass locally.
- [ ] Documentation is updated when setup, hosting, or behavior changes.
- [ ] UI changes include screenshots (if applicable).
- [ ] Backward compatibility is preserved for routes/events/contracts.
- [ ] Risks and rollback path are documented in PR description.

## Code Review Expectations

- Keep PRs reviewable; avoid mixing unrelated refactors.
- Prefer explicit, readable code over clever shortcuts.
- Add tests for behavior-critical paths.
- Discuss tradeoffs in PR description for non-trivial design choices.
