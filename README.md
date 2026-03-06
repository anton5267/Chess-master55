# Chess-master55

[![CI/CD](https://github.com/anton5267/Chess-master55/actions/workflows/master_chess-bg.yml/badge.svg)](https://github.com/anton5267/Chess-master55/actions/workflows/master_chess-bg.yml)
![.NET](https://img.shields.io/badge/.NET-8.0-512BD4)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

Modern multiplayer chess platform built with ASP.NET Core MVC + SignalR.
Supports real-time PvP, bot mode, localization (EN/UK/DE/PL/ES), ELO stats, and Azure deployment.

---

## English

### Product Overview
- Real-time multiplayer chess over SignalR.
- Bot mode with selectable difficulty.
- Full identity flow (register/login/manage).
- Stats page with ELO and historical game metrics.
- Production CI/CD workflow for Azure App Service.

### Architecture at a Glance
- **Web**: ASP.NET Core MVC + Razor Views
- **Realtime**: SignalR hubs (`/hub`)
- **Data**: EF Core + SQL database
- **Game state**: in-memory session store with synchronization hardening
- **Frontend build**: esbuild (game/stats bundles)

### Key Features
- Move validation, check, checkmate, stalemate
- Castling, en passant, promotion
- Draw offer, resign, repetition and 50-move draw rules
- Lobby + room system + live chat
- Multi-language UI: English, Ukrainian, German, Polish, Spanish
- Board/piece themes and modernized UI

### Local Development
```bash
cd src/Web/Chess.Web
npm ci
npm run build:assets
cd ../..
dotnet restore src/Chess.sln
dotnet build src/Chess.sln
dotnet test src/Chess.sln --nologo
dotnet run --project src/Web/Chess.Web/Chess.Web.csproj
```

### Ngrok-First Development
Use this when you want to open the app via a public URL only:
`https://nonhostilely-unhampered-noah.ngrok-free.dev`

```bash
cd src/Web/Chess.Web
npm ci
npm run dev:remote
```

Troubleshooting:
- `ERR_NGROK_8012`: local upstream is not running (`https://localhost:5001`)
- `ConnectionString not initialized`: set `ASPNETCORE_ENVIRONMENT=Development`
- Certificate warning: run `dotnet dev-certs https --trust` or use `dev:remote:http`

### Testing
```bash
cd src/Web/Chess.Web
npm run check:full
```

Windows-safe test mode (auto-stops running web process before tests):
```bash
cd src/Web/Chess.Web
npm run check:full:safe
```

If you see `CS2012` (`cannot open ... because it is being used by another process`):
- stop running `dotnet watch` / `dotnet run` instances first
- then run `npm run check:full:safe`

### CI/CD (GitHub Actions -> Azure App Service)
Workflow: `.github/workflows/master_chess-bg.yml`

Required secrets for OIDC deployment:
- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `AZURE_WEBAPP_URL` (optional, recommended for explicit health check URL)

Required repository variable:
- `AZURE_WEBAPP_NAME` (example: `your-app-name` without `.azurewebsites.net`)

Deploy runs on:
- push to `main`
- manual `workflow_dispatch` for `main`

OIDC bootstrap (recommended one-time flow):
```bash
az login --scope https://management.core.windows.net//.default
az login --scope https://graph.microsoft.com//.default
az webapp list --query "[].{name:name,rg:resourceGroup,host:defaultHostName}" -o table
# create/find App Registration + federated credential for:
# repo:anton5267/Chess-master55:ref:refs/heads/main
gh secret set AZURE_CLIENT_ID --repo anton5267/Chess-master55 --body "<app-client-id>"
gh secret set AZURE_TENANT_ID --repo anton5267/Chess-master55 --body "<tenant-id>"
gh secret set AZURE_SUBSCRIPTION_ID --repo anton5267/Chess-master55 --body "<subscription-id>"
gh variable set AZURE_WEBAPP_NAME --repo anton5267/Chess-master55 --body "<webapp-name>"
gh secret set AZURE_WEBAPP_URL --repo anton5267/Chess-master55 --body "https://<webapp-name>.azurewebsites.net"
```

If the deployment summary shows `deploy_skipped_missing_secrets`, configure all required values above and rerun the workflow.

Health endpoints:
- `/healthz`
- `/healthz/live`
- `/healthz/ready`

---

## Українська

### Опис продукту
- Онлайн-шахи в реальному часі на SignalR.
- Режим гри проти бота з вибором складності.
- Повний Identity flow (реєстрація, логін, керування акаунтом).
- Сторінка статистики з ELO та метриками партій.
- Production CI/CD деплой в Azure App Service.

### Архітектура (коротко)
- **Web**: ASP.NET Core MVC + Razor Views
- **Realtime**: SignalR hubs (`/hub`)
- **Data**: EF Core + SQL БД
- **Стан гри**: in-memory session store із захистом від десинхрону
- **Фронтенд-білд**: esbuild (бандли гри і статистики)

### Основні можливості
- Валідація ходів, шах, мат, пат
- Рокіровка, en passant, перетворення пішака
- Нічия, пропозиція нічиєї, здача
- Лобі, кімнати, живий чат
- 5 мов інтерфейсу: EN/UK/DE/PL/ES
- Теми дошки/фігур та оновлений UI

### Локальний запуск
```bash
cd src/Web/Chess.Web
npm ci
npm run build:assets
cd ../..
dotnet restore src/Chess.sln
dotnet build src/Chess.sln
dotnet test src/Chess.sln --nologo
dotnet run --project src/Web/Chess.Web/Chess.Web.csproj
```

### Режим Ngrok-first
Публічний URL для перевірки:
`https://nonhostilely-unhampered-noah.ngrok-free.dev`

```bash
cd src/Web/Chess.Web
npm ci
npm run dev:remote
```

### Перевірка якості
```bash
cd src/Web/Chess.Web
npm run check:full
```

Якщо з’являється `CS2012` (файл зайнятий іншим процесом):
- зупиніть активний `dotnet watch` / `dotnet run`
- використайте безпечний режим:
```bash
cd src/Web/Chess.Web
npm run check:full:safe
```

### CI/CD деплой (OIDC)
Workflow: `.github/workflows/master_chess-bg.yml`

Необхідні GitHub Secrets:
- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `AZURE_WEBAPP_URL` (опційно, рекомендовано)

Необхідна Repository Variable:
- `AZURE_WEBAPP_NAME` (наприклад: `your-app-name`, без `.azurewebsites.net`)

Pipeline запускається:
- при push у `main`
- вручну через `workflow_dispatch` для `main`

Склад pipeline:
- `terraform_validate`
- `build_test_publish`
- `deploy`

Базовий OIDC bootstrap (одноразово):
```bash
az login --scope https://management.core.windows.net//.default
az login --scope https://graph.microsoft.com//.default
az webapp list --query "[].{name:name,rg:resourceGroup,host:defaultHostName}" -o table
gh secret set AZURE_CLIENT_ID --repo anton5267/Chess-master55 --body "<app-client-id>"
gh secret set AZURE_TENANT_ID --repo anton5267/Chess-master55 --body "<tenant-id>"
gh secret set AZURE_SUBSCRIPTION_ID --repo anton5267/Chess-master55 --body "<subscription-id>"
gh variable set AZURE_WEBAPP_NAME --repo anton5267/Chess-master55 --body "<webapp-name>"
gh secret set AZURE_WEBAPP_URL --repo anton5267/Chess-master55 --body "https://<webapp-name>.azurewebsites.net"
```

Якщо в summary бачиш `deploy_skipped_missing_secrets`, додай усі обовʼязкові значення вище та перезапусти workflow.

---

## License
MIT License. See [LICENSE](./LICENSE).
