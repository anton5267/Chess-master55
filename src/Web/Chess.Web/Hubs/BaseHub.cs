namespace Chess.Web.Hubs
{
    using System;
    using System.Collections.Concurrent;
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
    using Chess.Web;
    using Chess.Web.Hubs.Bot;
    using Chess.Web.Hubs.Sessions;
    using Microsoft.AspNetCore.Authorization;
    using Microsoft.AspNetCore.SignalR;
    using Microsoft.EntityFrameworkCore;
    using Microsoft.Extensions.DependencyInjection;
    using Microsoft.Extensions.Localization;
    using Microsoft.Extensions.Logging;

    [Authorize]
    public partial class GameHub : Hub
    {
        private const int MinPlayerNameLength = 3;
        private const int MaxPlayerNameLength = 20;
        private const int MaxChatMessageLength = 300;
        private static readonly TimeSpan ChatMessageRateLimitWindow = TimeSpan.FromSeconds(1);
        private static readonly TimeSpan DisconnectGracePeriod = TimeSpan.FromSeconds(10);
        private static readonly Regex ValidNameRegex = new (@"^[A-Za-z0-9_]+$", RegexOptions.Compiled, TimeSpan.FromMilliseconds(100));
        private static readonly ConcurrentDictionary<string, DateTime> LastChatMessageByConnection = new ();

        private readonly IServiceProvider serviceProvider;
        private readonly IGameSessionStore gameSessionStore;
        private readonly INotificationService notificationService;
        private readonly IBoardFenSerializer boardFenSerializer;
        private readonly ILogger<GameHub> logger;
        private readonly IClock clock;
        private readonly IHubContext<GameHub> hubContext;
        private readonly IBotMoveSelector botMoveSelector;
        private readonly IStringLocalizer<SharedResource> localizer;

        public GameHub(
            IServiceProvider serviceProvider,
            IGameSessionStore gameSessionStore,
            INotificationService notificationService,
            IBoardFenSerializer boardFenSerializer,
            ILogger<GameHub> logger,
            IClock clock,
            IHubContext<GameHub> hubContext,
            IBotMoveSelector botMoveSelector,
            IStringLocalizer<SharedResource> localizer)
        {
            this.serviceProvider = serviceProvider;
            this.gameSessionStore = gameSessionStore;
            this.notificationService = notificationService;
            this.boardFenSerializer = boardFenSerializer;
            this.logger = logger;
            this.clock = clock;
            this.hubContext = hubContext;
            this.botMoveSelector = botMoveSelector;
            this.localizer = localizer;
        }

        public override async Task OnConnectedAsync()
        {
            if (!this.TryGetValidatedUserContext(out var userId, out _, out var userName))
            {
                this.Context.Abort();
                return;
            }

            if (this.gameSessionStore.TryReattachDisconnectedPlayer(
                    this.Context.ConnectionId,
                    userId,
                    out var restoredGameSession,
                    out var restoredPlayerSession))
            {
                var game = restoredGameSession.Game;
                await this.Groups.AddToGroupAsync(this.Context.ConnectionId, game.Id);

                var startPayload = this.CreateStartPayload(
                    restoredGameSession,
                    selfPlayerId: this.Context.ConnectionId,
                    selfPlayerName: restoredPlayerSession.Name);

                await this.Clients.Caller.SendAsync("Start", startPayload);
                await this.SyncPositionToCaller(game);
                await this.Clients.Group(game.Id).SendAsync("UpdateStatus", game.MovingPlayer.Id, game.MovingPlayer.Name);
                await this.Clients.Group(game.Id).SendAsync(
                    "UpdateGameChatInternalMessage",
                    this.localizer["Hub_PlayerReconnectedFormat", restoredPlayerSession.Name]);

                this.logger.LogInformation(
                    "PlayerReattached GameId={GameId} UserId={UserId} ConnectionId={ConnectionId}",
                    game.Id,
                    userId,
                    this.Context.ConnectionId);

                await base.OnConnectedAsync();
                return;
            }

            await this.LobbySendInternalMessage(userName);
            await this.Clients.Caller.SendAsync("ListRooms", this.GetWaitingPlayersSnapshot());
            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception exception)
        {
            if (!string.IsNullOrWhiteSpace(this.Context.ConnectionId))
            {
                LastChatMessageByConnection.TryRemove(this.Context.ConnectionId, out _);
            }

            if (this.gameSessionStore.TryMarkDisconnectedConnection(this.Context.ConnectionId, out var removalResult) &&
                removalResult.Success &&
                removalResult.Player?.Player != null)
            {
                var leavingPlayer = removalResult.Player.Player;

                if (removalResult.RemovedFromWaiting)
                {
                    await this.Clients.All.SendAsync("ListRooms", this.GetWaitingPlayersSnapshot());
                }

                if (removalResult.MarkedAsDisconnected && removalResult.GameSession?.Game != null)
                {
                    var game = removalResult.GameSession.Game;
                    await this.Clients.Group(game.Id)
                        .SendAsync(
                            "UpdateGameChatInternalMessage",
                            this.localizer["Hub_PlayerDisconnectedWaitingFormat", leavingPlayer.Name]);

                    _ = this.FinalizeDisconnectedGameAfterGracePeriodAsync(this.Context.ConnectionId, game.Id);
                }
            }

            await base.OnDisconnectedAsync(exception);
        }

        private async Task FinalizeDisconnectedGameAfterGracePeriodAsync(string connectionId, string expectedGameId)
        {
            try
            {
                await Task.Delay(DisconnectGracePeriod);

                if (!this.gameSessionStore.TryFinalizeDisconnectedConnection(connectionId, out var removalResult) ||
                    !removalResult.Success ||
                    removalResult.GameSession?.Game == null ||
                    removalResult.Player?.Player == null)
                {
                    return;
                }

                var game = removalResult.GameSession.Game;
                if (!string.Equals(game.Id, expectedGameId, StringComparison.OrdinalIgnoreCase))
                {
                    return;
                }

                var leavingPlayer = removalResult.Player.Player;
                if (game.GameOver != GameOver.None)
                {
                    return;
                }

                await this.hubContext.Clients.Group(game.Id).SendAsync("GameOver", leavingPlayer, GameOver.Disconnected);
                await this.hubContext.Clients.Group(game.Id)
                    .SendAsync(
                        "UpdateGameChatInternalMessage",
                        this.localizer["Hub_PlayerLeftYouWinFormat", leavingPlayer.Name]);

                if (game.Turn > 30)
                {
                    var winner = game.MovingPlayer.Id != leavingPlayer.Id ? game.MovingPlayer : game.Opponent;
                    if (removalResult.Opponent?.Player?.Id == winner?.Id)
                    {
                        await this.UpdateStatsAsync(winner, leavingPlayer, GameOver.Disconnected);
                    }
                }

                this.logger.LogInformation(
                    "DisconnectedGameFinalized GameId={GameId} PlayerId={PlayerId} ConnectionId={ConnectionId}",
                    game.Id,
                    leavingPlayer.Id,
                    connectionId);
            }
            catch (Exception ex)
            {
                this.logger.LogWarning(
                    ex,
                    "FinalizeDisconnectedGameFailed ConnectionId={ConnectionId} ExpectedGameId={GameId}",
                    connectionId,
                    expectedGameId);
            }
        }

        private Player GetPlayer()
        {
            if (!this.gameSessionStore.TryGetPlayer(this.Context.ConnectionId, out var playerSession))
            {
                throw new HubException(this.localizer["Hub_Error_PlayerSessionNotFound"]);
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
                throw new HubException(this.localizer["Hub_Error_GameSessionNotFound"]);
            }

            return gameSession.Game;
        }

        private GameSession GetGameSession()
        {
            if (!this.gameSessionStore.TryGetGameByConnection(this.Context.ConnectionId, out var gameSession, out _))
            {
                throw new HubException(this.localizer["Hub_Error_GameSessionNotFound"]);
            }

            return gameSession;
        }

        private async Task<int> GetUserRatingAsync(string userId)
        {
            using var scope = this.serviceProvider.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<ChessDbContext>();

            var rating = await dbContext.Stats
                .Where(x => x.UserId == userId)
                .Select(x => x.EloRating)
                .FirstOrDefaultAsync();
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
                throw new HubException(this.localizer["Hub_Error_UnauthorizedUserContext"]);
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
                throw new HubException(this.localizer["Hub_Error_NameInvalid"]);
            }

            return normalized;
        }

        private string ValidateAndNormalizeChatMessage(string message)
        {
            var normalized = (message ?? string.Empty).Trim();

            if (string.IsNullOrWhiteSpace(normalized))
            {
                throw new HubException(this.localizer["Hub_Error_MessageEmpty"]);
            }

            if (normalized.Length > MaxChatMessageLength)
            {
                throw new HubException(this.localizer["Hub_Error_MessageTooLong"]);
            }

            this.EnsureChatRateLimit();
            return normalized;
        }

        private void EnsureChatRateLimit()
        {
            var connectionId = this.Context.ConnectionId;
            if (string.IsNullOrWhiteSpace(connectionId))
            {
                return;
            }

            while (true)
            {
                var now = this.clock.UtcNow;
                if (!LastChatMessageByConnection.TryGetValue(connectionId, out var previousTimestamp))
                {
                    if (LastChatMessageByConnection.TryAdd(connectionId, now))
                    {
                        return;
                    }

                    continue;
                }

                if (now - previousTimestamp < ChatMessageRateLimitWindow)
                {
                    throw new HubException(this.localizer["Hub_Error_MessageRateLimited"]);
                }

                if (LastChatMessageByConnection.TryUpdate(connectionId, now, previousTimestamp))
                {
                    return;
                }
            }
        }

        private string GetTimestamp()
        {
            return this.clock.UtcNow.ToString("HH:mm");
        }

        private StartGamePayload CreateStartPayload(GameSession gameSession, string selfPlayerId, string selfPlayerName)
        {
            var game = gameSession.Game;
            var botPlayer = gameSession.Player1.IsBot ? gameSession.Player1 : (gameSession.Player2.IsBot ? gameSession.Player2 : null);

            return new StartGamePayload
            {
                Game = game,
                StartFen = this.boardFenSerializer.Serialize(game.ChessBoard),
                MovingPlayerId = game.MovingPlayer.Id,
                MovingPlayerName = game.MovingPlayer.Name,
                TurnNumber = game.Turn,
                SelfPlayerId = selfPlayerId,
                SelfPlayerName = selfPlayerName,
                IsBotGame = gameSession.IsBotGame,
                GameMode = gameSession.IsBotGame ? "bot" : "pvp",
                BotPlayerId = botPlayer?.ConnectionId,
                BotPlayerName = botPlayer?.Name,
            };
        }
    }
}
