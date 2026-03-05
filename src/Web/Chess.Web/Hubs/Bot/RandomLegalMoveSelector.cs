namespace Chess.Web.Hubs.Bot
{
    using System;
    using System.Linq;

    using Chess.Services.Data.Models;
    using Chess.Web.Hubs.Sessions;

    public sealed class RandomLegalMoveSelector : IBotMoveSelector
    {
        public bool TrySelectMove(Game game, BotDifficulty difficulty, out LegalMove move)
        {
            move = null;
            var legalMoves = game.GetLegalMoves().ToArray();
            if (legalMoves.Length == 0)
            {
                return false;
            }

            if (difficulty == BotDifficulty.Easy)
            {
                move = legalMoves[Random.Shared.Next(legalMoves.Length)];
                return true;
            }

            var bestScore = double.MinValue;
            LegalMove bestMove = null;
            foreach (var legalMove in legalMoves)
            {
                var moveScore = this.GetNormalDifficultyScore(game, legalMove);
                if (moveScore > bestScore)
                {
                    bestScore = moveScore;
                    bestMove = legalMove;
                }
            }

            move = bestMove ?? legalMoves[Random.Shared.Next(legalMoves.Length)];
            return true;
        }

        private double GetNormalDifficultyScore(Game game, LegalMove move)
        {
            var score = 0.0;
            if (move.IsCapture)
            {
                score += this.GetCaptureScore(game, move) * 100;
            }

            if (this.IsPromotionMove(game, move))
            {
                score += 90;
            }

            if (this.IsCenterSquare(move.Target))
            {
                score += 5;
            }

            // Small jitter keeps "Normal" less deterministic when scores tie.
            score += Random.Shared.NextDouble() * 0.2;
            return score;
        }

        private int GetCaptureScore(Game game, LegalMove move)
        {
            var targetSquare = game.ChessBoard.GetSquareByName(move.Target);
            if (targetSquare?.Piece != null)
            {
                return this.GetPieceValue(targetSquare.Piece.Symbol);
            }

            // En passant target squares are empty even though the move is a capture.
            return 1;
        }

        private bool IsPromotionMove(Game game, LegalMove move)
        {
            var sourceSquare = game.ChessBoard.GetSquareByName(move.Source);
            if (sourceSquare?.Piece == null || !sourceSquare.Piece.IsType('P'))
            {
                return false;
            }

            if (string.IsNullOrWhiteSpace(move.Target) || move.Target.Length != 2)
            {
                return false;
            }

            var targetRank = move.Target[1];
            return targetRank == '1' || targetRank == '8';
        }

        private bool IsCenterSquare(string square)
        {
            return string.Equals(square, "d4", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(square, "e4", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(square, "d5", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(square, "e5", StringComparison.OrdinalIgnoreCase);
        }

        private int GetPieceValue(char symbol)
        {
            return char.ToUpperInvariant(symbol) switch
            {
                'P' => 1,
                'N' => 3,
                'B' => 3,
                'R' => 5,
                'Q' => 9,
                _ => 1,
            };
        }
    }
}
