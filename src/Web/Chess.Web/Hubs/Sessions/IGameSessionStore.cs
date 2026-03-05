namespace Chess.Web.Hubs.Sessions
{
    using System;
    using System.Collections.Generic;

    public interface IGameSessionStore
    {
        bool TryCreateWaitingPlayer(
            string connectionId,
            string userId,
            string name,
            int rating,
            out PlayerSession playerSession,
            out string error);

        bool TryJoinRoom(
            string connectionId,
            string userId,
            string name,
            string waitingPlayerConnectionId,
            int rating,
            IServiceProvider serviceProvider,
            out PlayerSession playerSession,
            out GameSession gameSession,
            out string error);

        bool TryCreateBotGame(
            string connectionId,
            string userId,
            string name,
            int rating,
            IServiceProvider serviceProvider,
            BotDifficulty difficulty,
            out PlayerSession playerSession,
            out GameSession gameSession,
            out string error);

        bool TryGetGameByConnection(string connectionId, out GameSession gameSession, out PlayerSession playerSession);

        bool TryGetPlayer(string connectionId, out PlayerSession playerSession);

        bool TryGetGameById(string gameId, out GameSession gameSession);

        bool TryMarkDisconnectedConnection(string connectionId, out ConnectionRemovalResult removalResult);

        bool TryReattachDisconnectedPlayer(
            string connectionId,
            string userId,
            out GameSession gameSession,
            out PlayerSession playerSession);

        bool TryFinalizeDisconnectedConnection(string connectionId, out ConnectionRemovalResult removalResult);

        IReadOnlyCollection<PlayerSession> GetWaitingRoomsSnapshot();
    }
}
