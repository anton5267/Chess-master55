namespace Chess.Web.Hubs
{
    using System;
    using System.Collections.Generic;
    using System.Linq;
    using System.Security.Claims;
    using System.Text.RegularExpressions;
    using System.Threading.Tasks;

    using Chess.Common.Enums;
    using Chess.Common.Time;
    using Chess.Data;
    using Chess.Services.Data.Models;
    using Chess.Services.Data.Services.Contracts;
    using Chess.Web.Hubs.Sessions;
    using Microsoft.AspNetCore.Authorization;
    using Microsoft.AspNetCore.SignalR;
    using Microsoft.EntityFrameworkCore;
    using Microsoft.Extensions.DependencyInjection;

    [Authorize]
    public partial class GameHub : Hub
    {
        private const int MinPlayerNameLength = 3;
        private const int MaxPlayerNameLength = 20;
        private const int MaxChatMessageLength = 300;
        private static readonly Regex ValidNameRegex = new (@"^[A-Za-z0-9_]+$", RegexOptions.Compiled, TimeSpan.FromMilliseconds(100));

        private readonly IServiceProvider serviceProvider;
        private readonly IGameSessionStore gameSessionStore;
        private readonly INotificationService notificationService;
        private readonly IClock clock;

        public GameHub(
            IServiceProvider serviceProvider,
            IGameSessionStore gameSessionStore,
            INotificationService notificationService,
            IClock clock)
        {
            this.serviceProvider = serviceProvider;
            this.gameSessionStore = gameSessionStore;
            this.notificationService = notificationService;
            this.clock = clock;
        }

        public override async Task OnConnectedAsync()
        {
            if (!this.TryGetValidatedUserContext(out _, out _, out var userName))
            {
                this.Context.Abort();
                return;
            }

            await this.LobbySendInternalMessage(userName);
            await this.Clients.Caller.SendAsync("ListRooms", this.GetWaitingPlayersSnapshot());
            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception exception)
        {
            if (this.gameSessionStore.TryRemoveConnection(this.Context.ConnectionId, out var removalResult) &&
                removalResult.Success &&
                removalResult.Player?.Player != null)
            {
                var leavingPlayer = removalResult.Player.Player;

                if (removalResult.GameSession?.Game != null)
                {
                    var game = removalResult.GameSession.Game;

                    if (game.GameOver == GameOver.None)
                    {
                        await this.GameSendInternalMessage(game.Id, leavingPlayer.Name, null);
                        await this.Clients.Group(game.Id).SendAsync("GameOver", leavingPlayer, GameOver.Disconnected);

                        if (game.Turn > 30)
                        {
                            var winner = game.MovingPlayer.Id != leavingPlayer.Id ? game.MovingPlayer : game.Opponent;
                            if (removalResult.Opponent?.Player?.Id == winner?.Id)
                            {
                                await this.UpdateStatsAsync(winner, leavingPlayer, GameOver.Disconnected);
                            }
                        }
                    }
                }

                if (removalResult.RemovedFromWaiting)
                {
                    await this.Clients.All.SendAsync("ListRooms", this.GetWaitingPlayersSnapshot());
                }
            }

            await base.OnDisconnectedAsync(exception);
        }

        private Player GetPlayer()
        {
            if (!this.gameSessionStore.TryGetPlayer(this.Context.ConnectionId, out var playerSession))
            {
                throw new HubException("Player session not found.");
            }

            return playerSession.Player;
        }

        private Player GetOpponentPlayer(Game game, Player player)
        {
            return game.MovingPlayer.Id != player.Id ? game.MovingPlayer : game.Opponent;
        }

        private Game GetGame()
        {
            if (!this.gameSessionStore.TryGetGameByConnection(this.Context.ConnectionId, out var gameSession, out _))
            {
                throw new HubException("Game session not found.");
            }

            return gameSession.Game;
        }

        private int GetUserRating(Player player)
        {
            using var scope = this.serviceProvider.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<ChessDbContext>();

            var rating = dbContext.Stats
                .Where(x => x.UserId == player.UserId)
                .Select(x => x.EloRating)
                .FirstOrDefault();
            return rating == 0 ? 1200 : rating;
        }

        private async Task UpdateStatsAsync(Player sender, Player opponent, GameOver gameOver)
        {
            if (sender == null ||
                opponent == null ||
                string.IsNullOrWhiteSpace(sender.UserId) ||
                string.IsNullOrWhiteSpace(opponent.UserId))
            {
                return;
            }

            using var scope = this.serviceProvider.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<ChessDbContext>();

            var senderStats = await dbContext.Stats.FirstOrDefaultAsync(x => x.UserId == sender.UserId);
            var opponentStats = await dbContext.Stats.FirstOrDefaultAsync(x => x.UserId == opponent.UserId);

            if (senderStats == null || opponentStats == null)
            {
                return;
            }

            senderStats.Played += 1;
            opponentStats.Played += 1;

            if (gameOver == GameOver.Checkmate || gameOver == GameOver.Resign || gameOver == GameOver.Disconnected)
            {
                var utilityService = this.serviceProvider.GetRequiredService<IUtilityService>();
                int points = utilityService.CalculateRatingPoints(senderStats.EloRating, opponentStats.EloRating);

                senderStats.Won += 1;
                opponentStats.Lost += 1;
                senderStats.EloRating += points;
                opponentStats.EloRating -= points;
            }
            else if (gameOver == GameOver.Stalemate || gameOver == GameOver.Draw || gameOver == GameOver.ThreefoldDraw || gameOver == GameOver.FivefoldDraw || gameOver == GameOver.FiftyMoveDraw)
            {
                senderStats.Drawn += 1;
                opponentStats.Drawn += 1;
            }

            dbContext.Stats.Update(senderStats);
            dbContext.Stats.Update(opponentStats);
            await dbContext.SaveChangesAsync();
        }

        private IReadOnlyCollection<Player> GetWaitingPlayersSnapshot()
        {
            return this.gameSessionStore.GetWaitingRoomsSnapshot()
                .Select(x => x.Player)
                .ToList()
                .AsReadOnly();
        }

        private void EnsureAuthenticatedUserContext()
        {
            if (!this.TryGetValidatedUserContext(out _, out _, out _))
            {
                throw new HubException("Unauthorized user context.");
            }
        }

        private bool TryGetValidatedUserContext(out string userId, out string userIdentifier, out string userName)
        {
            userId = this.Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
            userIdentifier = this.Context.UserIdentifier;
            userName = this.Context.User?.Identity?.Name ?? "Player";

            return !string.IsNullOrWhiteSpace(userId) &&
                !string.IsNullOrWhiteSpace(userIdentifier) &&
                string.Equals(userId, userIdentifier, StringComparison.Ordinal);
        }

        private string ValidateAndNormalizePlayerName(string name)
        {
            var normalized = (name ?? string.Empty).Trim();

            if (normalized.Length < MinPlayerNameLength ||
                normalized.Length > MaxPlayerNameLength ||
                !ValidNameRegex.IsMatch(normalized))
            {
                throw new HubException("Name must be 3-20 chars and contain only letters, numbers, and underscores.");
            }

            return normalized;
        }

        private string ValidateAndNormalizeChatMessage(string message)
        {
            var normalized = (message ?? string.Empty).Trim();

            if (string.IsNullOrWhiteSpace(normalized))
            {
                throw new HubException("Message cannot be empty.");
            }

            if (normalized.Length > MaxChatMessageLength)
            {
                throw new HubException("Message is too long.");
            }

            return normalized;
        }

        private string GetTimestamp()
        {
            return this.clock.UtcNow.ToString("HH:mm");
        }
    }
}
