namespace Chess.Web.Hubs.Sessions
{
    public sealed class LegalMoveDto
    {
        public string Source { get; set; }

        public string Target { get; set; }

        public bool IsCapture { get; set; }
    }
}
