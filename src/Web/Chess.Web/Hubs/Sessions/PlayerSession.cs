namespace Chess.Web.Hubs.Sessions
{
    using Chess.Services.Data.Models;

    public class PlayerSession
    {
        public PlayerSession(Player player, PlayerSessionState state, bool isBot = false)
        {
            this.Player = player;
            this.State = state;
            this.IsBot = isBot;
        }

        public Player Player { get; }

        public string ConnectionId => this.Player.Id;

        public string UserId => this.Player.UserId;

        public string Name => this.Player.Name;

        public int Rating
        {
            get => this.Player.Rating;
            set => this.Player.Rating = value;
        }

        public string GameId
        {
            get => this.Player.GameId;
            set => this.Player.GameId = value;
        }

        public bool IsBot { get; }

        public PlayerSessionState State { get; set; }
    }
}
