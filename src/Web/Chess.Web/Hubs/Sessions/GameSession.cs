namespace Chess.Web.Hubs.Sessions
{
    using System;
    using System.Threading;

    using Chess.Services.Data.Models;

    public class GameSession
    {
        public string GameId { get; set; }

        public PlayerSession Player1 { get; set; }

        public PlayerSession Player2 { get; set; }

        public Game Game { get; set; }

        public DateTime CreatedAtUtc { get; set; }

        public GameMode Mode { get; set; } = GameMode.HumanVsHuman;

        public bool IsBotGame => this.Mode == GameMode.HumanVsBot;

        public SemaphoreSlim MoveLock { get; } = new (1, 1);

        public SemaphoreSlim BotTurnLock { get; } = new (1, 1);
    }
}
