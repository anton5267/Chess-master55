namespace Chess.Web.Hubs.Sessions
{
    using System;
    using System.Collections.Concurrent;
    using System.Collections.Generic;
    using System.Linq;
    using System.Threading;

    using Chess.Common.Enums;
    using Chess.Common.Time;
    using Chess.Services.Data.Models;

    public sealed class InMemoryGameSessionStore : IGameSessionStore, IDisposable
    {
        private const string BotName = "ChessBot";
        private const string BotUserId = "__bot__";

        private readonly ConcurrentDictionary<string, PlayerSession> players;
        private readonly ConcurrentDictionary<string, GameSession> games;
        private readonly List<string> waitingConnections;
        private readonly SemaphoreSlim sync;
        private readonly IClock clock;

        public InMemoryGameSessionStore(IClock clock)
        {
            this.players = new ConcurrentDictionary<string, PlayerSession>(StringComparer.OrdinalIgnoreCase);
            this.games = new ConcurrentDictionary<string, GameSession>(StringComparer.OrdinalIgnoreCase);
            this.waitingConnections = new List<string>();
            this.sync = new SemaphoreSlim(1, 1);
            this.clock = clock;
        }

        public bool TryCreateWaitingPlayer(
            string connectionId,
            string userId,
            string name,
            int rating,
            out PlayerSession playerSession,
            out string error)
        {
            playerSession = null;
            error = null;

            this.sync.Wait();
            try
            {
                this.RemoveStaleWaitingSessionsByUserId(userId, connectionId);
                this.CleanupFinishedGamesByUserId(userId);
                this.CleanupStaleDisconnectedSessionsByUserId(userId);

                if (this.players.TryGetValue(connectionId, out var existingSession))
                {
                    if (existingSession.State != PlayerSessionState.Idle)
                    {
                        error = "Player session already exists for this connection.";
                        return false;
                    }

                    this.players.TryRemove(connectionId, out _);
                }

                var player = Factory.GetPlayer(name, connectionId, userId);
                player.Rating = rating;

                playerSession = new PlayerSession(player, PlayerSessionState.Waiting);
                this.players[connectionId] = playerSession;
                this.waitingConnections.Add(connectionId);
                return true;
            }
            finally
            {
                this.sync.Release();
            }
        }

        public bool TryJoinRoom(
            string connectionId,
            string userId,
            string name,
            string waitingPlayerConnectionId,
            int rating,
            IServiceProvider serviceProvider,
            out PlayerSession playerSession,
            out GameSession gameSession,
            out string error)
        {
            playerSession = null;
            gameSession = null;
            error = null;

            this.sync.Wait();
            try
            {
                this.RemoveStaleWaitingSessionsByUserId(userId, connectionId);
                this.CleanupFinishedGamesByUserId(userId);
                this.CleanupStaleDisconnectedSessionsByUserId(userId);

                if (waitingPlayerConnectionId.Equals(connectionId, StringComparison.OrdinalIgnoreCase))
                {
                    error = "You cannot join your own room.";
                    return false;
                }

                if (this.players.TryGetValue(connectionId, out var existingSession))
                {
                    if (existingSession.State != PlayerSessionState.Idle)
                    {
                        error = "Player session already exists for this connection.";
                        return false;
                    }

                    this.players.TryRemove(connectionId, out _);
                }

                if (!this.players.TryGetValue(waitingPlayerConnectionId, out var waitingPlayer))
                {
                    error = "Waiting room not found.";
                    return false;
                }

                if (waitingPlayer.State != PlayerSessionState.Waiting)
                {
                    error = "Room is not available anymore.";
                    return false;
                }

                var player2 = Factory.GetPlayer(name, connectionId, userId);
                player2.Rating = rating;
                playerSession = new PlayerSession(player2, PlayerSessionState.Playing);
                this.players[connectionId] = playerSession;

                waitingPlayer.State = PlayerSessionState.Playing;
                waitingPlayer.Player.Color = Color.White;
                waitingPlayer.Player.HasToMove = true;

                playerSession.Player.Color = Color.Black;
                playerSession.Player.HasToMove = false;

                var game = Factory.GetGame(waitingPlayer.Player, playerSession.Player, serviceProvider);
                waitingPlayer.GameId = game.Id;
                playerSession.GameId = game.Id;

                gameSession = new GameSession
                {
                    GameId = game.Id,
                    Player1 = waitingPlayer,
                    Player2 = playerSession,
                    Game = game,
                    CreatedAtUtc = this.clock.UtcNow,
                };

                this.games[game.Id] = gameSession;
                this.waitingConnections.Remove(waitingPlayerConnectionId);
                return true;
            }
            finally
            {
                this.sync.Release();
            }
        }

        public bool TryCreateBotGame(
            string connectionId,
            string userId,
            string name,
            int rating,
            IServiceProvider serviceProvider,
            out PlayerSession playerSession,
            out GameSession gameSession,
            out string error)
        {
            playerSession = null;
            gameSession = null;
            error = null;

            this.sync.Wait();
            try
            {
                this.RemoveStaleWaitingSessionsByUserId(userId, connectionId);
                this.CleanupFinishedGamesByUserId(userId);
                this.CleanupStaleDisconnectedSessionsByUserId(userId);

                if (this.players.TryGetValue(connectionId, out var existingSession))
                {
                    if (existingSession.State == PlayerSessionState.Idle)
                    {
                        this.players.TryRemove(connectionId, out _);
                    }
                    else if (existingSession.State == PlayerSessionState.Playing &&
                             !string.IsNullOrWhiteSpace(existingSession.GameId) &&
                             this.games.TryGetValue(existingSession.GameId, out var existingGameSession))
                    {
                        if (existingGameSession.IsBotGame &&
                            existingGameSession.Game.GameOver == GameOver.None &&
                            !existingSession.IsBot)
                        {
                            playerSession = existingSession;
                            gameSession = existingGameSession;
                            return true;
                        }

                        if (existingGameSession.Game.GameOver != GameOver.None)
                        {
                            this.CleanupFinishedGame(existingGameSession);
                        }
                        else
                        {
                            error = "Current game is still active.";
                            return false;
                        }
                    }
                    else
                    {
                        error = "Current game is still active.";
                        return false;
                    }
                }

                if (this.TryGetActiveBotSessionByUserId(userId, out _))
                {
                    error = "Another bot game is already active for this account.";
                    return false;
                }

                var humanPlayer = Factory.GetPlayer(name, connectionId, userId);
                humanPlayer.Rating = rating;

                var botConnectionId = $"bot:{Guid.NewGuid():N}";
                var botPlayer = Factory.GetPlayer(BotName, botConnectionId, BotUserId);
                botPlayer.Rating = 1200;

                var humanIsWhite = Random.Shared.Next(0, 2) == 0;
                if (humanIsWhite)
                {
                    humanPlayer.Color = Color.White;
                    humanPlayer.HasToMove = true;

                    botPlayer.Color = Color.Black;
                    botPlayer.HasToMove = false;
                }
                else
                {
                    humanPlayer.Color = Color.Black;
                    humanPlayer.HasToMove = false;

                    botPlayer.Color = Color.White;
                    botPlayer.HasToMove = true;
                }

                playerSession = new PlayerSession(humanPlayer, PlayerSessionState.Playing);
                var botSession = new PlayerSession(botPlayer, PlayerSessionState.Playing, isBot: true);

                var game = humanIsWhite
                    ? Factory.GetGame(humanPlayer, botPlayer, serviceProvider)
                    : Factory.GetGame(botPlayer, humanPlayer, serviceProvider);

                playerSession.GameId = game.Id;
                botSession.GameId = game.Id;

                gameSession = new GameSession
                {
                    GameId = game.Id,
                    Player1 = game.Player1.Id.Equals(playerSession.ConnectionId, StringComparison.OrdinalIgnoreCase) ? playerSession : botSession,
                    Player2 = game.Player2.Id.Equals(playerSession.ConnectionId, StringComparison.OrdinalIgnoreCase) ? playerSession : botSession,
                    Game = game,
                    Mode = GameMode.HumanVsBot,
                    CreatedAtUtc = this.clock.UtcNow,
                };

                this.players[playerSession.ConnectionId] = playerSession;
                this.players[botSession.ConnectionId] = botSession;
                this.games[game.Id] = gameSession;
                return true;
            }
            finally
            {
                this.sync.Release();
            }
        }

        public bool TryGetGameByConnection(string connectionId, out GameSession gameSession, out PlayerSession playerSession)
        {
            gameSession = null;
            playerSession = null;

            if (!this.players.TryGetValue(connectionId, out playerSession))
            {
                return false;
            }

            if (string.IsNullOrEmpty(playerSession.GameId))
            {
                return false;
            }

            return this.games.TryGetValue(playerSession.GameId, out gameSession);
        }

        public bool TryGetPlayer(string connectionId, out PlayerSession playerSession)
        {
            return this.players.TryGetValue(connectionId, out playerSession);
        }

        public bool TryGetGameById(string gameId, out GameSession gameSession)
        {
            return this.games.TryGetValue(gameId, out gameSession);
        }

        public bool TryMarkDisconnectedConnection(string connectionId, out ConnectionRemovalResult removalResult)
        {
            removalResult = new ConnectionRemovalResult
            {
                Success = false,
            };

            this.sync.Wait();
            try
            {
                if (!this.players.TryGetValue(connectionId, out var leavingPlayer))
                {
                    return false;
                }

                var removedFromWaiting = this.waitingConnections.Remove(connectionId);

                if (leavingPlayer.State == PlayerSessionState.Waiting ||
                    string.IsNullOrEmpty(leavingPlayer.GameId))
                {
                    this.players.TryRemove(connectionId, out _);
                    this.ResetPlayerToIdle(leavingPlayer);

                    removalResult = new ConnectionRemovalResult
                    {
                        Success = true,
                        RemovedFromWaiting = removedFromWaiting,
                        Player = leavingPlayer,
                    };

                    return true;
                }

                if (!this.games.TryGetValue(leavingPlayer.GameId, out var gameSession))
                {
                    this.players.TryRemove(connectionId, out _);
                    this.ResetPlayerToIdle(leavingPlayer);

                    removalResult = new ConnectionRemovalResult
                    {
                        Success = true,
                        RemovedFromWaiting = removedFromWaiting,
                        Player = leavingPlayer,
                    };

                    return true;
                }

                var opponent = gameSession.Player1.ConnectionId.Equals(connectionId, StringComparison.OrdinalIgnoreCase)
                    ? gameSession.Player2
                    : gameSession.Player1;

                if (gameSession.IsBotGame)
                {
                    leavingPlayer.State = PlayerSessionState.Disconnected;

                    removalResult = new ConnectionRemovalResult
                    {
                        Success = true,
                        RemovedFromWaiting = removedFromWaiting,
                        MarkedAsDisconnected = true,
                        Player = leavingPlayer,
                        Opponent = opponent,
                        GameSession = gameSession,
                    };

                    return true;
                }

                leavingPlayer.State = PlayerSessionState.Disconnected;

                removalResult = new ConnectionRemovalResult
                {
                    Success = true,
                    RemovedFromWaiting = removedFromWaiting,
                    MarkedAsDisconnected = true,
                    Player = leavingPlayer,
                    GameSession = gameSession,
                    Opponent = opponent,
                };

                return true;
            }
            finally
            {
                this.sync.Release();
            }
        }

        public bool TryReattachDisconnectedPlayer(
            string connectionId,
            string userId,
            out GameSession gameSession,
            out PlayerSession playerSession)
        {
            gameSession = null;
            playerSession = null;

            if (string.IsNullOrWhiteSpace(userId))
            {
                return false;
            }

            this.sync.Wait();
            try
            {
                if (this.players.ContainsKey(connectionId))
                {
                    return false;
                }

                var disconnectedCandidates = this.players
                    .Where(x =>
                        x.Value.State == PlayerSessionState.Disconnected &&
                        !string.IsNullOrWhiteSpace(x.Value.UserId) &&
                        x.Value.UserId.Equals(userId, StringComparison.OrdinalIgnoreCase))
                    .OrderBy(x => x.Key, StringComparer.OrdinalIgnoreCase)
                    .ToList();

                foreach (var disconnectedCandidate in disconnectedCandidates)
                {
                    if (disconnectedCandidate.Value == null || string.IsNullOrWhiteSpace(disconnectedCandidate.Key))
                    {
                        continue;
                    }

                    if (!this.games.TryGetValue(disconnectedCandidate.Value.GameId, out gameSession) ||
                        gameSession.Game.GameOver != GameOver.None)
                    {
                        this.players.TryRemove(disconnectedCandidate.Key, out _);
                        continue;
                    }

                    playerSession = disconnectedCandidate.Value;
                    this.players.TryRemove(disconnectedCandidate.Key, out _);
                    playerSession.Player.Id = connectionId;
                    playerSession.State = PlayerSessionState.Playing;
                    this.players[connectionId] = playerSession;
                    return true;
                }

                gameSession = null;
                playerSession = null;
                return false;
            }
            finally
            {
                this.sync.Release();
            }
        }

        public bool TryFinalizeDisconnectedConnection(string connectionId, out ConnectionRemovalResult removalResult)
        {
            removalResult = new ConnectionRemovalResult
            {
                Success = false,
            };

            this.sync.Wait();
            try
            {
                if (!this.players.TryGetValue(connectionId, out var leavingPlayer) ||
                    leavingPlayer.State != PlayerSessionState.Disconnected)
                {
                    return false;
                }

                this.players.TryRemove(connectionId, out _);

                GameSession gameSession = null;
                PlayerSession opponent = null;
                if (!string.IsNullOrEmpty(leavingPlayer.GameId) &&
                    this.games.TryRemove(leavingPlayer.GameId, out gameSession))
                {
                    opponent = gameSession.Player1.ConnectionId.Equals(connectionId, StringComparison.OrdinalIgnoreCase)
                        ? gameSession.Player2
                        : gameSession.Player1;

                    if (opponent != null)
                    {
                        if (opponent.IsBot || opponent.State == PlayerSessionState.Disconnected)
                        {
                            this.players.TryRemove(opponent.ConnectionId, out _);
                        }
                        else
                        {
                            this.ResetPlayerToIdle(opponent);
                        }
                    }
                }

                this.ResetPlayerToIdle(leavingPlayer);
                removalResult = new ConnectionRemovalResult
                {
                    Success = true,
                    FinalizedDisconnectedGame = true,
                    Player = leavingPlayer,
                    GameSession = gameSession,
                    Opponent = opponent,
                };

                return true;
            }
            finally
            {
                this.sync.Release();
            }
        }

        public IReadOnlyCollection<PlayerSession> GetWaitingRoomsSnapshot()
        {
            this.sync.Wait();
            try
            {
                return this.waitingConnections
                    .Select(connectionId =>
                    {
                        this.players.TryGetValue(connectionId, out var session);
                        return session;
                    })
                    .Where(session => session != null && session.State == PlayerSessionState.Waiting)
                    .ToList()
                    .AsReadOnly();
            }
            finally
            {
                this.sync.Release();
            }
        }

        public void Dispose()
        {
            this.sync.Dispose();
            GC.SuppressFinalize(this);
        }

        private void RemoveStaleWaitingSessionsByUserId(string userId, string currentConnectionId)
        {
            if (string.IsNullOrWhiteSpace(userId))
            {
                return;
            }

            var staleConnections = this.players
                .Where(x =>
                    x.Value.State == PlayerSessionState.Waiting &&
                    !string.IsNullOrWhiteSpace(x.Value.UserId) &&
                    x.Value.UserId.Equals(userId, StringComparison.OrdinalIgnoreCase) &&
                    !x.Key.Equals(currentConnectionId, StringComparison.OrdinalIgnoreCase))
                .Select(x => x.Key)
                .ToList();

            foreach (var staleConnectionId in staleConnections)
            {
                this.players.TryRemove(staleConnectionId, out _);
                this.waitingConnections.Remove(staleConnectionId);
            }
        }

        private void CleanupFinishedGamesByUserId(string userId)
        {
            if (string.IsNullOrWhiteSpace(userId))
            {
                return;
            }

            var finishedGameIds = this.games
                .Where(x =>
                    x.Value.Game.GameOver != GameOver.None &&
                    (
                        (!string.IsNullOrWhiteSpace(x.Value.Player1.UserId) &&
                         x.Value.Player1.UserId.Equals(userId, StringComparison.OrdinalIgnoreCase)) ||
                        (!string.IsNullOrWhiteSpace(x.Value.Player2.UserId) &&
                         x.Value.Player2.UserId.Equals(userId, StringComparison.OrdinalIgnoreCase))))
                .Select(x => x.Key)
                .ToList();

            foreach (var gameId in finishedGameIds)
            {
                if (this.games.TryGetValue(gameId, out var gameSession))
                {
                    this.CleanupFinishedGame(gameSession);
                }
            }
        }

        private void CleanupStaleDisconnectedSessionsByUserId(string userId)
        {
            if (string.IsNullOrWhiteSpace(userId))
            {
                return;
            }

            var staleDisconnectedConnections = this.players
                .Where(x =>
                    x.Value.State == PlayerSessionState.Disconnected &&
                    !string.IsNullOrWhiteSpace(x.Value.UserId) &&
                    x.Value.UserId.Equals(userId, StringComparison.OrdinalIgnoreCase) &&
                    (
                        string.IsNullOrWhiteSpace(x.Value.GameId) ||
                        !this.games.TryGetValue(x.Value.GameId, out var sessionGame) ||
                        sessionGame.Game.GameOver != GameOver.None))
                .Select(x => x.Key)
                .ToList();

            foreach (var staleConnectionId in staleDisconnectedConnections)
            {
                this.players.TryRemove(staleConnectionId, out _);
                this.waitingConnections.Remove(staleConnectionId);
            }
        }

        private bool TryGetActiveBotSessionByUserId(string userId, out PlayerSession playerSession)
        {
            playerSession = null;

            if (string.IsNullOrWhiteSpace(userId))
            {
                return false;
            }

            foreach (var session in this.players.Values)
            {
                if (session.IsBot ||
                    string.IsNullOrWhiteSpace(session.UserId) ||
                    !session.UserId.Equals(userId, StringComparison.OrdinalIgnoreCase) ||
                    string.IsNullOrWhiteSpace(session.GameId))
                {
                    continue;
                }

                if (this.games.TryGetValue(session.GameId, out var gameSession) &&
                    gameSession.IsBotGame &&
                    gameSession.Game.GameOver == GameOver.None &&
                    (session.State == PlayerSessionState.Playing || session.State == PlayerSessionState.Disconnected))
                {
                    playerSession = session;
                    return true;
                }
            }

            return false;
        }

        private void CleanupFinishedGame(GameSession gameSession)
        {
            if (gameSession == null)
            {
                return;
            }

            if (gameSession.Player1 != null)
            {
                this.players.TryRemove(gameSession.Player1.ConnectionId, out _);
                this.waitingConnections.Remove(gameSession.Player1.ConnectionId);
                this.ResetPlayerToIdle(gameSession.Player1);
            }

            if (gameSession.Player2 != null)
            {
                this.players.TryRemove(gameSession.Player2.ConnectionId, out _);
                this.waitingConnections.Remove(gameSession.Player2.ConnectionId);
                this.ResetPlayerToIdle(gameSession.Player2);
            }

            this.games.TryRemove(gameSession.GameId, out _);
        }

        private void ResetPlayerToIdle(PlayerSession session)
        {
            session.State = PlayerSessionState.Idle;
            session.GameId = null;
            session.Player.GameId = null;
            session.Player.HasToMove = false;
        }
    }
}
