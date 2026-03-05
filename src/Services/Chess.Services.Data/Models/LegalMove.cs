namespace Chess.Services.Data.Models
{
    public sealed class LegalMove
    {
        public string Source { get; set; }

        public string Target { get; set; }

        public bool IsCapture { get; set; }
    }
}
