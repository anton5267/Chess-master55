# Release Notes

## 2026-05-25

### Hosting and Documentation
- Split the public documentation into two clear editions:
  - GitHub Pages static demo at `https://anton5267.github.io/Chess-master55/`
  - full ASP.NET Core app for local or server hosting.
- Marked Azure App Service deployment as optional/manual instead of the main live target.
- Updated local setup instructions for `libman restore`, `npm ci`, frontend asset build, .NET restore/build/test, and local run.
- Refreshed contributor guidance and issue template wording for the GitHub Pages demo + full app model.

### Gameplay
- Fixed terminal-state resolution so a checked king with no legal moves is checkmate, not stalemate.
- Added regression tests for the reported checkmate position and for moves that produce checkmate.

### Build and Dependencies
- Restored stable client library setup for chessboard.js and SignalR through LibMan.
- Updated vulnerable/outdated .NET package references, including AutoMapper.
- Verified package vulnerability scan reports no vulnerable packages.
- Added a separate `full-app-ci` GitHub Actions workflow for the ASP.NET Core app quality gate.

### UX
- Fixed full app game layout so the fixed navbar does not cover the board/status area on desktop or mobile.
- Added smoother chessboard movement, turn/status pulses, move-history entry animation, and captured-piece counter feedback in both the full app and static demo.

### Verified
- `libman restore`
- `npm ci`
- `npm run build:assets`
- `dotnet restore src/Chess.sln`
- `dotnet build src/Chess.sln --nologo`
- `dotnet test src/Chess.sln --no-build --nologo --verbosity normal`
- `dotnet list src/Chess.sln package --vulnerable --include-transitive`

---

## 2026-03-07

### Platform and Deployment
- Stabilized production deployment workflow for Azure App Service.
- Added OIDC precheck with clear deployment mode summary.
- Added publish-profile fallback path when OIDC secrets are not configured.
- Added workflow concurrency to cancel outdated in-progress runs on the same branch.

### Reliability
- Fixed Identity registration crash path in production by adding a safe email sender fallback:
  - if `SendGridApiKey` is missing, app now uses `NoOpEmailSender` instead of failing page initialization.

### Gameplay and UX
- Bot mode stability hardening:
  - improved terminal-state handling and sync recovery behavior.
- Lobby and game UX polish:
  - clearer mode entry flow (`online` vs `vs bot`),
  - cleaner control layout and status visibility.
- Added/updated global theme and motion handling for modernized UI.

### Quality
- Expanded automated coverage (services + integration).
- Verified local quality gates:
  - `dotnet test src/Chess.sln --nologo`
  - `npm run check:full:safe`

---

## Notes
- For GitHub Pages and full local setup, use the Demo vs Full section in README.
- For optional Azure OIDC setup, use `scripts/bootstrap-azure-oidc.ps1` and the README Azure section.
- If deployment summary reports missing configuration, set:
  - Secrets: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`
  - Variable: `AZURE_WEBAPP_NAME`
