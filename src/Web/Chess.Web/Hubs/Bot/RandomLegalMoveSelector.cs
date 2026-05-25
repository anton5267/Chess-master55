namespace Chess.Web.Hubs.Bot
{
    using System;
    using System.Linq;

    using Chess.Common.Enums;
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
                var moveScore = difficulty == BotDifficulty.Hard
                    ? this.GetHardDifficultyScore(game, legalMove)
                    : this.GetNormalDifficultyScore(game, legalMove);
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

        private double GetHardDifficultyScore(Game game, LegalMove move)
        {
            var score = 0.0;
            var sourceSquare = game.ChessBoard.GetSquareByName(move.Source);
            var targetSquare = game.ChessBoard.GetSquareByName(move.Target);
            var movingPieceValue = this.GetPieceValue(sourceSquare?.Piece?.Symbol ?? 'P');

            if (this.IsLikelyMateAfterMove(game, move))
            {
                score += 10000;
            }

            if (move.IsCapture)
            {
                score += (this.GetCaptureScore(game, move) * 120) - (movingPieceValue * 8);
            }

            if (this.IsPromotionMove(game, move))
            {
                score += 900;
            }

            if (this.IsMoveGivingCheck(game, move))
            {
                score += 90;
            }

            if (this.IsCenterSquare(move.Target))
            {
                score += 12;
            }

            if (this.IsDevelopmentMove(sourceSquare, targetSquare))
            {
                score += 10;
            }

            if (this.IsTargetAttackedAfterMove(game, move))
            {
                score -= movingPieceValue * 18;
            }

            score += this.GetPawnAdvanceBonus(sourceSquare, targetSquare);
            score += Random.Shared.NextDouble() * 0.05;
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

        private bool IsDevelopmentMove(Square sourceSquare, Square targetSquare)
        {
            if (sourceSquare?.Piece == null || targetSquare == null)
            {
                return false;
            }

            if (!sourceSquare.Piece.IsType('N', 'B'))
            {
                return false;
            }

            var homeRank = sourceSquare.Piece.Color == Color.White ? '1' : '8';
            return sourceSquare.Name.Length == 2 && sourceSquare.Name[1] == homeRank;
        }

        private double GetPawnAdvanceBonus(Square sourceSquare, Square targetSquare)
        {
            if (sourceSquare?.Piece == null ||
                targetSquare == null ||
                !sourceSquare.Piece.IsType('P'))
            {
                return 0;
            }

            var direction = sourceSquare.Piece.Color == Color.White ? -1 : 1;
            var rankDelta = targetSquare.Position.Rank - sourceSquare.Position.Rank;
            return rankDelta == direction ? 3 : 0;
        }

        private bool IsMoveGivingCheck(Game game, LegalMove move)
        {
            var preview = this.TryPreviewBoard(game, move);
            if (preview == null)
            {
                return false;
            }

            var kingSquare = preview.GetKingSquare(game.Opponent.Color);
            return kingSquare?.IsAttackedByColor(game.MovingPlayer.Color) ?? false;
        }

        private bool IsLikelyMateAfterMove(Game game, LegalMove move)
        {
            var preview = this.TryPreviewBoard(game, move);
            if (preview == null)
            {
                return false;
            }

            var opponentColor = game.Opponent.Color;
            var movingColor = game.MovingPlayer.Color;
            var kingSquare = preview.GetKingSquare(opponentColor);
            if (kingSquare == null || !kingSquare.IsAttackedByColor(movingColor))
            {
                return false;
            }

            for (var rankOffset = -1; rankOffset <= 1; rankOffset++)
            {
                for (var fileOffset = -1; fileOffset <= 1; fileOffset++)
                {
                    if (rankOffset == 0 && fileOffset == 0)
                    {
                        continue;
                    }

                    var escape = preview.GetSquareByCoordinates(
                        kingSquare.Position.Rank + rankOffset,
                        kingSquare.Position.File + fileOffset);
                    if (escape == null)
                    {
                        continue;
                    }

                    if (escape.Piece != null && escape.Piece.Color == opponentColor)
                    {
                        continue;
                    }

                    if (!escape.IsAttackedByColor(movingColor))
                    {
                        return false;
                    }
                }
            }

            return true;
        }

        private bool IsTargetAttackedAfterMove(Game game, LegalMove move)
        {
            var preview = this.TryPreviewBoard(game, move);
            var targetSquare = preview?.GetSquareByName(move.Target);
            return targetSquare?.IsAttackedByColor(game.Opponent.Color) ?? false;
        }

        private Board TryPreviewBoard(Game game, LegalMove move)
        {
            var board = game.ChessBoard.Clone() as Board;
            var source = board?.GetSquareByName(move.Source);
            var target = board?.GetSquareByName(move.Target);
            if (source?.Piece == null || target == null)
            {
                return null;
            }

            board.ShiftPiece(source, target);
            return board;
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
