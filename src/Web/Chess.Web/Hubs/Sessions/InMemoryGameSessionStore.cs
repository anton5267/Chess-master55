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

        public bool TryRemoveConnection(string connectionId, out ConnectionRemovalResult removalResult)
        {
            removalResult = new ConnectionRemovalResult
            {
                Success = false,
            };

            this.sync.Wait();
            try
            {
                if (!this.players.TryRemove(connectionId, out var leavingPlayer))
                {
                    return false;
                }

                var removedFromWaiting = this.waitingConnections.Remove(connectionId);
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
                        opponent.State = PlayerSessionState.Idle;
                        opponent.GameId = null;
                        opponent.Player.GameId = null;
                        opponent.Player.HasToMove = false;
                    }
                }

                leavingPlayer.State = PlayerSessionState.Idle;
                leavingPlayer.GameId = null;
                leavingPlayer.Player.GameId = null;
                leavingPlayer.Player.HasToMove = false;

                removalResult = new ConnectionRemovalResult
                {
                    Success = true,
                    RemovedFromWaiting = removedFromWaiting,
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
    }
}
