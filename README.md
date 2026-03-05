# Multiplayer Chess

**ASP.NET Core** board game with **SignalR** and **chessboardjs**.


## Build Status


## Technologies

* C#
* .NET 8
* ASP.NET Core
* ASP.NET Core MVC
* Entity Framework Core
* SignalR
* JavaScript
* jQuery
* HTML
* CSS
* Bootstrap

## Asset Pipeline

Frontend assets are built with `esbuild` only.

- JS outputs: `wwwroot/js/game.bundle(.min).js`, `wwwroot/js/stats.bundle(.min).js`
- Legacy `BuildBundlerMinifier`/`bundleconfig.json` pipeline was removed

## Features

- [x] Move Validation
- [x] Check
- [x] Checkmate
- [x] Stalemate
- [x] Draw
- [x] Offer Draw
- [x] Threefold Repetition Draw
- [x] Fivefold Repetition Draw
- [x] Resign
- [x] Castling
- [x] Pawn Promotion
- [x] En Passant Capture
- [x] Points Calculation
- [x] Taken Pieces History
- [x] Algebraic Notation Move History
- [x] User Authentication
- [x] Highlight Last Move
- [x] Board & Piece Theme Selector (saved locally)
- [x] Lobby
- [x] Lobby Chat
- [x] Game Chat
- [x] Stats Page
- [x] ELO Rating Calculation
- [x] Fifty-Move Draw
- [x] Email Notifications
- [ ] Timer Game Mode
- [ ] Stateless App

## Local Build

```bash
cd src/Web/Chess.Web
npm install
npm run build:assets
cd ../..
dotnet build src/Chess.sln
dotnet test src/Chess.sln
```

One-command full quality check (assets + backend tests):

```bash
cd src/Web/Chess.Web
npm run check:full
```

## Local Development

```bash
cd src/Web/Chess.Web
npm install
npm run dev
```

Trusted HTTPS setup (recommended):

```bash
dotnet dev-certs https --trust
```

HTTP fallback when local certificate is not trusted:

```bash
cd src/Web/Chess.Web
npm run dev:http
```

## Ngrok-First Development (fixed public URL)

Use this mode when you want to open the app only through:
`https://nonhostilely-unhampered-noah.ngrok-free.dev`

```bash
cd src/Web/Chess.Web
npm install
npm run dev:remote
```

What it starts:
- `watch:assets`
- `dotnet watch run --project Chess.Web.csproj` (upstream: `https://localhost:5001`)
- `ngrok` tunnel with fixed domain

Important environment default:

- `ASPNETCORE_ENVIRONMENT=Development` must be set so `ChessDb` connection string from `appsettings.Development.json` is used.

PowerShell example:

```powershell
$env:ASPNETCORE_ENVIRONMENT = "Development"
cd src/Web/Chess.Web
npm run dev:remote
```

If HTTPS certificate is not trusted locally, use HTTP upstream remote mode:

```bash
cd src/Web/Chess.Web
npm run dev:remote:http
```

Verify tunnel status:

```bash
curl http://127.0.0.1:4040/api/tunnels
```

Quick upstream checks before browser smoke:

```bash
curl -k https://localhost:5001/healthz
curl https://nonhostilely-unhampered-noah.ngrok-free.dev/healthz
```

## Restart Runbook (when updates do not appear)

1. Stop all running `dotnet` and `ngrok` processes.
2. Rebuild assets:

```bash
cd src/Web/Chess.Web
npm ci
npm run build:assets
```

3. Restart remote dev mode:

```bash
$env:ASPNETCORE_ENVIRONMENT=Development
npm run dev:remote
```

4. Open the app in an incognito window:
`https://nonhostilely-unhampered-noah.ngrok-free.dev`

## Troubleshooting

1. `ERR_NGROK_8012` / `502 Bad Gateway`:
   - upstream `https://localhost:5001` is not running;
   - restart `npm run dev:remote`.
2. `The ConnectionString property has not been initialized`:
   - app started outside `Development` environment;
   - set `ASPNETCORE_ENVIRONMENT=Development` and restart.
3. `NET::ERR_CERT_AUTHORITY_INVALID` on localhost upstream:
   - run `dotnet dev-certs https --trust`;
   - or switch to HTTP remote mode (`npm run dev:remote:http`).
4. Port is already in use:
   - stop old `dotnet`/`ngrok` processes and rerun.

## Health Check

Service health endpoint:

```bash
GET /healthz
```

Expected response code: `200 OK`.

Additional probes:

```bash
GET /healthz/live
GET /healthz/ready
```
