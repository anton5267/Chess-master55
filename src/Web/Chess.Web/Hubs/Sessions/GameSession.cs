namespace Chess.Web.Hubs.Sessions
{
    using System;

    using Chess.Services.Data.Models;

    public class GameSession
    {
        public string GameId { get; set; }

        public PlayerSession Player1 { get; set; }

        public PlayerSession Player2 { get; set; }

        public Game Game { get; set; }

        public DateTime CreatedAtUtc { get; set; }
    }
}
