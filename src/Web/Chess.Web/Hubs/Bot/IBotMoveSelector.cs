namespace Chess.Web.Hubs.Bot
{
    using Chess.Services.Data.Models;

    public interface IBotMoveSelector
    {
        bool TrySelectMove(Game game, out LegalMove move);
    }
}
