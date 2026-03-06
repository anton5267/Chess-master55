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

### CI/CD (GitHub Actions -> Azure App Service)
Workflow: `.github/workflows/master_chess-bg.yml`

Required secrets for OIDC deployment:
- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`

Deploy triggers on push to `main`.

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

### CI/CD деплой (OIDC)
Workflow: `.github/workflows/master_chess-bg.yml`

Необхідні GitHub Secrets:
- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`

Після push у `main` запускається повний pipeline:
- `terraform_validate`
- `build_test_publish`
- `deploy`

---

## License
MIT License. See [LICENSE](./LICENSE).
