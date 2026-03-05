namespace Chess.Web.Hubs.Sessions
{
    public enum PlayerSessionState
    {
        Waiting = 0,
        Playing = 1,
        Idle = 2,
        Disconnected = 3,
    }
}
