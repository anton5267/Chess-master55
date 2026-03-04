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
