namespace Chess.Web.Hubs.Bot
{
    using Chess.Services.Data.Models;
    using Chess.Web.Hubs.Sessions;

    public interface IBotMoveSelector
    {
        bool TrySelectMove(Game game, BotDifficulty difficulty, out LegalMove move);
    }
}
