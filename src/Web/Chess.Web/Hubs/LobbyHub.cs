namespace Chess.Web.Hubs
{
    using System;
    using System.Linq;
    using System.Threading.Tasks;

    using Chess.Common.Enums;
    using Chess.Data.Common.Repositories;
    using Chess.Data.Models;
    using Chess.Services.Data.Models;
    using Chess.Web.Hubs.Sessions;
    using Microsoft.AspNetCore.SignalR;
    using Microsoft.Extensions.DependencyInjection;
    using Microsoft.Extensions.Logging;

    public partial class GameHub
    {
        public async Task<Player> StartVsBot(string name)
        {
            this.EnsureAuthenticatedUserContext();
            var normalizedName = this.ValidateAndNormalizePlayerName(name);
            this.TryGetValidatedUserContext(out var userId, out _, out _);

            if (this.gameSessionStore.TryGetGameByConnection(this.Context.ConnectionId, out var existingGameSession, out var existingPlayerSession) &&
                existingGameSession.IsBotGame &&
                existingGameSession.Game.GameOver == GameOver.None &&
                existingPlayerSession is { IsBot: false })
            {
                await this.Groups.AddToGroupAsync(this.Context.ConnectionId, groupName: existingGameSession.GameId);

                var startPayload = this.CreateStartPayload(
                    existingGameSession,
                    selfPlayerId: this.Context.ConnectionId,
                    selfPlayerName: existingPlayerSession.Name);

                await this.Clients.Caller.SendAsync("Start", startPayload);
                await this.SyncPositionToCaller(existingGameSession.Game);
                await this.SyncTerminalStateToCallerIfNeeded(existingGameSession.Game);
                await this.TryExecuteBotTurnIfNeededAsync(existingGameSession, trigger: "start_idempotent");

                this.logger.LogInformation(
                    "BotGameStartReused GameId={GameId} ConnectionId={ConnectionId} UserId={UserId}",
                    existingGameSession.GameId,
                    this.Context.ConnectionId,
                    userId);

                return existingPlayerSession.Player;
            }

            var player = Factory.GetPlayer(normalizedName, this.Context.ConnectionId, userId);
            var rating = await this.GetUserRatingAsync(player.UserId);

            if (!this.gameSessionStore.TryCreateBotGame(
                    this.Context.ConnectionId,
                    userId,
                    normalizedName,
                    rating,
                    this.serviceProvider,
                    out var playerSession,
                    out var gameSession,
                    out var error))
            {
                throw new HubException(error ?? this.localizer["Hub_Error_StartBotFailed"]);
            }

            await this.StartGame(gameSession);
            await this.Clients.All.SendAsync("ListRooms", this.GetWaitingPlayersSnapshot());
            return playerSession.Player;
        }

        public async Task<Player> CreateRoom(string name)
        {
            this.EnsureAuthenticatedUserContext();
            var normalizedName = this.ValidateAndNormalizePlayerName(name);
            this.TryGetValidatedUserContext(out var userId, out _, out _);

            var player = Factory.GetPlayer(normalizedName, this.Context.ConnectionId, userId);
            var rating = await this.GetUserRatingAsync(player.UserId);

            if (!this.gameSessionStore.TryCreateWaitingPlayer(
                    this.Context.ConnectionId,
                    userId,
                    normalizedName,
                    rating,
                    out var playerSession,
                    out var error))
            {
                throw new HubException(error ?? this.localizer["Hub_Error_CreateRoomFailed"]);
            }

            await this.LobbySendInternalMessage(playerSession.Name);
            await this.Clients.All.SendAsync("AddRoom", playerSession.Player);
            return playerSession.Player;
        }

        public async Task<Player> JoinRoom(string name, string id)
        {
            this.EnsureAuthenticatedUserContext();
            var normalizedName = this.ValidateAndNormalizePlayerName(name);
            this.TryGetValidatedUserContext(out var userId, out _, out _);

            var player = Factory.GetPlayer(normalizedName, this.Context.ConnectionId, userId);
            var rating = await this.GetUserRatingAsync(player.UserId);

            if (!this.gameSessionStore.TryJoinRoom(
                    this.Context.ConnectionId,
                    userId,
                    normalizedName,
                    id,
                    rating,
                    this.serviceProvider,
                    out var playerSession,
                    out var gameSession,
                    out var error))
            {
                throw new HubException(error ?? this.localizer["Hub_Error_JoinRoomFailed"]);
            }

            await this.StartGame(gameSession);
            return playerSession.Player;
        }

        private async Task StartGame(GameSession gameSession)
        {
            var game = gameSession.Game;

            if (!gameSession.Player1.IsBot)
            {
                await this.Groups.AddToGroupAsync(gameSession.Player1.ConnectionId, groupName: game.Id);
            }

            if (!gameSession.Player2.IsBot)
            {
                await this.Groups.AddToGroupAsync(gameSession.Player2.ConnectionId, groupName: game.Id);
            }

            this.logger.LogInformation(
                "GameStartGroupJoinCompleted GameId={GameId} Mode={Mode} Player1={Player1ConnectionId} Player2={Player2ConnectionId}",
                game.Id,
                gameSession.Mode,
                gameSession.Player1.ConnectionId,
                gameSession.Player2.ConnectionId);

            if (!gameSession.IsBotGame)
            {
                using var scope = this.serviceProvider.CreateScope();
                var gameRepository = scope.ServiceProvider.GetRequiredService<IRepository<GameEntity>>();

                await gameRepository.AddAsync(new GameEntity
                {
                    Id = game.Id,
                    PlayerOneName = game.Player1.Name,
                    PlayerOneUserId = game.Player1.UserId,
                    PlayerTwoName = game.Player2.Name,
                    PlayerTwoUserId = game.Player2.UserId,
                });

                await gameRepository.SaveChangesAsync();
            }

            var startRecipients = new[] { gameSession.Player1, gameSession.Player2 }
                .Where(x => !x.IsBot)
                .ToArray();

            foreach (var recipient in startRecipients)
            {
                var startPayload = this.CreateStartPayload(
                    gameSession,
                    selfPlayerId: recipient.ConnectionId,
                    selfPlayerName: recipient.Name);

                await this.Clients.Client(recipient.ConnectionId).SendAsync("Start", startPayload);
            }

            var tracePayload = this.CreateStartPayload(gameSession, selfPlayerId: null, selfPlayerName: null);
            this.logger.LogInformation(
                "GameStartSent GameId={GameId} Mode={Mode} StartFen={StartFen} MovingPlayer={MovingPlayerName} Recipients={RecipientCount}",
                game.Id,
                tracePayload.GameMode,
                tracePayload.StartFen,
                tracePayload.MovingPlayerName,
                startRecipients.Length);

            if (!gameSession.IsBotGame)
            {
                await this.Clients.All.SendAsync("ListRooms", this.GetWaitingPlayersSnapshot());
                await this.GameSendInternalMessage(game.Id, game.Player2.Name, null);
            }

            await this.TryExecuteBotTurnIfNeededAsync(gameSession, trigger: "start");
        }
    }
}
