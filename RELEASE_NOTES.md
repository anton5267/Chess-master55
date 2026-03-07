# Release Notes

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
- For Azure OIDC setup, use `scripts/bootstrap-azure-oidc.ps1` and README CI/CD section.
- If deployment summary reports missing configuration, set:
  - Secrets: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`
  - Variable: `AZURE_WEBAPP_NAME`
