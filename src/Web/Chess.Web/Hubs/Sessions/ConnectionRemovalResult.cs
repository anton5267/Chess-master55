namespace Chess.Web.Hubs.Sessions
{
    public class ConnectionRemovalResult
    {
        public bool Success { get; set; }

        public bool RemovedFromWaiting { get; set; }

        public PlayerSession Player { get; set; }

        public GameSession GameSession { get; set; }

        public PlayerSession Opponent { get; set; }
    }
}
