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

            var captureMoves = legalMoves
                .Where(x => x.IsCapture)
                .ToArray();

            if (captureMoves.Length > 0)
            {
                var bestCaptureScore = captureMoves
                    .Max(x => this.GetCaptureScore(game, x));
                var bestCaptures = captureMoves
                    .Where(x => this.GetCaptureScore(game, x) == bestCaptureScore)
                    .ToArray();

                move = bestCaptures[Random.Shared.Next(bestCaptures.Length)];
                return true;
            }

            move = legalMoves[Random.Shared.Next(legalMoves.Length)];
            return true;
        }

        private int GetCaptureScore(Game game, LegalMove move)
        {
            var targetSquare = game.ChessBoard.GetSquareByName(move.Target);
            if (targetSquare?.Piece != null)
            {
                return targetSquare.Piece.Points;
            }

            // En passant target squares are empty even though the move is a capture.
            return 1;
        }
    }
}
