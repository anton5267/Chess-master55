# Contributing Guidelines

Thanks for your interest in contributing to Chess-master55.

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

```bash
cd src/Web/Chess.Web
npm run check:full
```

And:

```bash
dotnet test src/Chess.sln --nologo
```

## Pull Request Checklist

- [ ] Scope is focused and clearly described.
- [ ] No unrelated files are included.
- [ ] Tests pass locally.
- [ ] UI changes include screenshots (if applicable).
- [ ] Backward compatibility is preserved for routes/events/contracts.
- [ ] Risks and rollback path are documented in PR description.

## Code Review Expectations

- Keep PRs reviewable; avoid mixing unrelated refactors.
- Prefer explicit, readable code over clever shortcuts.
- Add tests for behavior-critical paths.
- Discuss tradeoffs in PR description for non-trivial design choices.
