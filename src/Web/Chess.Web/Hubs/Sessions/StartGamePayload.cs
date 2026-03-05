namespace Chess.Web.Hubs.Sessions
{
    using Chess.Services.Data.Models;

    public sealed class StartGamePayload
    {
        public Game Game { get; set; }

        public string StartFen { get; set; }

        public string MovingPlayerId { get; set; }

        public string MovingPlayerName { get; set; }

        public int TurnNumber { get; set; }

        public string SelfPlayerId { get; set; }

        public string SelfPlayerName { get; set; }

        public bool IsBotGame { get; set; }

        public string GameMode { get; set; }

        public string BotPlayerId { get; set; }

        public string BotPlayerName { get; set; }
    }
}
