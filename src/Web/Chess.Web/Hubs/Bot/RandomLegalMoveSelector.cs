namespace Chess.Web.Hubs.Bot
{
    using System;
    using System.Linq;

    using Chess.Services.Data.Models;

    public sealed class RandomLegalMoveSelector : IBotMoveSelector
    {
        public bool TrySelectMove(Game game, out LegalMove move)
        {
            move = null;
            var legalMoves = game.GetLegalMoves().ToArray();
            if (legalMoves.Length == 0)
            {
                return false;
            }

            move = legalMoves[Random.Shared.Next(legalMoves.Length)];
            return true;
        }
    }
}
