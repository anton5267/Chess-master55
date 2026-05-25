# Deployment Guide

This repo has two supported hosting modes.

## GitHub Pages Demo

GitHub Pages publishes the static demo from `docs/`.

URL:

```text
https://anton5267.github.io/Chess-master55/
```

This mode has no ASP.NET Core backend, SQL Server, Identity, or SignalR server. It is the free public demo.

Workflow:

```text
.github/workflows/github-pages.yml
```

## Full ASP.NET Core App

The full app is in `src/` and needs:

- .NET 10 runtime or SDK
- SQL Server
- restored LibMan client libraries
- built npm assets
- a valid `CONNECTION_STRING`

Local run:

```bash
cd src/Web/Chess.Web
libman restore
npm ci
npm run build:assets
cd ../../..
dotnet run --project src/Web/Chess.Web/Chess.Web.csproj --urls http://localhost:5000
```

Open:

```text
http://localhost:5000
```

## Docker Compose

Docker Compose starts SQL Server and the full ASP.NET Core app together.

```bash
docker compose up --build
```

Open:

```text
http://localhost:5000
```

Default local SQL password:

```text
Chess_dev_2026!
```

Override it before starting Compose:

```bash
CHESS_SQL_PASSWORD="your_Strong_password_2026!" docker compose up --build
```

On Windows PowerShell:

```powershell
$env:CHESS_SQL_PASSWORD = "your_Strong_password_2026!"
docker compose up --build
```

Stop containers:

```bash
docker compose down
```

Delete the local SQL volume too:

```bash
docker compose down -v
```

## Manual Azure Deployment

Azure is optional and manual. It is not the primary live site.

Workflow:

```text
.github/workflows/master_chess-bg.yml
```

Required OIDC secrets:

- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`

Required repository variable:

- `AZURE_WEBAPP_NAME`

Optional:

- `AZURE_WEBAPP_URL`

Health endpoints:

- `/healthz`
- `/healthz/live`
- `/healthz/ready`
