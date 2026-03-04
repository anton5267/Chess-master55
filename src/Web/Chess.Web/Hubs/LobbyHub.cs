namespace Chess.Web.Hubs
{
    using System.Threading.Tasks;

    using Chess.Data.Common.Repositories;
    using Chess.Data.Models;
    using Chess.Services.Data.Models;
    using Chess.Web.Hubs.Sessions;
    using Microsoft.AspNetCore.SignalR;
    using Microsoft.Extensions.DependencyInjection;

    public partial class GameHub
    {
        public async Task<Player> CreateRoom(string name)
        {
            this.EnsureAuthenticatedUserContext();
            var normalizedName = this.ValidateAndNormalizePlayerName(name);
            this.TryGetValidatedUserContext(out var userId, out _, out _);

            var player = Factory.GetPlayer(normalizedName, this.Context.ConnectionId, userId);
            var rating = this.GetUserRating(player);

            if (!this.gameSessionStore.TryCreateWaitingPlayer(
                    this.Context.ConnectionId,
                    userId,
                    normalizedName,
                    rating,
                    out var playerSession,
                    out var error))
            {
                throw new HubException(error ?? "Unable to create room.");
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
            var rating = this.GetUserRating(player);

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
                throw new HubException(error ?? "Unable to join room.");
            }

            await this.StartGame(gameSession);
            return playerSession.Player;
        }

        private async Task StartGame(GameSession gameSession)
        {
            var game = gameSession.Game;

            await Task.WhenAll(
                this.Groups.AddToGroupAsync(gameSession.Player1.ConnectionId, groupName: game.Id),
                this.Groups.AddToGroupAsync(gameSession.Player2.ConnectionId, groupName: game.Id),
                this.Clients.Group(game.Id).SendAsync("Start", game));

            await this.Clients.All.SendAsync("ListRooms", this.GetWaitingPlayersSnapshot());
            await this.GameSendInternalMessage(game.Id, game.Player2.Name, null);

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
    }
}
