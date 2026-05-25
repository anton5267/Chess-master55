namespace Chess.Web.Hubs.Bot
{
    using System;
    using System.Collections.Generic;
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
                    ? this.GetEngineStyleDifficultyScore(game, legalMove)
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

        private double GetEngineStyleDifficultyScore(Game game, LegalMove move)
        {
            var score = this.GetHardDifficultyScore(game, move);
            var preview = this.TryPreviewBoard(game, move);
            if (preview == null)
            {
                return score;
            }

            var movingColor = game.MovingPlayer.Color;
            var opponentColor = game.Opponent.Color;

            score += this.EvaluateBoardForColor(preview, movingColor) * 0.14;
            score += this.GetKingPressureScore(preview, opponentColor, movingColor);
            score -= this.GetBestOpponentReplyScore(preview, opponentColor, movingColor, game.Turn + 1) * 0.62;

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

        private double GetBestOpponentReplyScore(Board board, Color opponentColor, Color movingColor, int turn)
        {
            var bestScore = 0.0;
            foreach (var opponentMove in this.GetBoardLegalMoves(board, opponentColor, turn))
            {
                var replyScore = this.GetBoardMoveScore(board, opponentMove, opponentColor, movingColor, turn);
                if (replyScore > bestScore)
                {
                    bestScore = replyScore;
                }
            }

            return bestScore;
        }

        private IEnumerable<LegalMove> GetBoardLegalMoves(Board board, Color movingColor, int turn)
        {
            var squares = board.Matrix.SelectMany(x => x).ToArray();
            foreach (var source in squares.Where(x => x.Piece != null && x.Piece.Color == movingColor))
            {
                foreach (var target in squares)
                {
                    if (source.Name == target.Name)
                    {
                        continue;
                    }

                    if (this.IsLegalBoardMove(board, source.Name, target.Name, movingColor, turn, out var isCapture))
                    {
                        yield return new LegalMove
                        {
                            Source = source.Name,
                            Target = target.Name,
                            IsCapture = isCapture,
                        };
                    }
                }
            }
        }

        private bool IsLegalBoardMove(
            Board board,
            string sourceName,
            string targetName,
            Color movingColor,
            int turn,
            out bool isCapture)
        {
            isCapture = false;

            var candidate = board.Clone() as Board;
            var source = candidate?.GetSquareByName(sourceName);
            var target = candidate?.GetSquareByName(targetName);
            if (source?.Piece == null || target == null || source.Piece.Color != movingColor)
            {
                return false;
            }

            if (target.Piece != null && target.Piece.Color == movingColor)
            {
                return false;
            }

            var move = Factory.GetMove(source, target);
            if (target.Piece != null)
            {
                if (!source.Piece.Take(target.Position, candidate.Matrix, turn, move))
                {
                    return false;
                }

                isCapture = true;
                candidate.ShiftPiece(source, target);
                return !this.IsKingAttacked(candidate, movingColor);
            }

            if (!source.Piece.Move(target.Position, candidate.Matrix, turn, move))
            {
                return false;
            }

            candidate.ShiftPiece(source, target);
            return !this.IsKingAttacked(candidate, movingColor);
        }

        private double GetBoardMoveScore(Board board, LegalMove move, Color movingColor, Color opponentColor, int turn)
        {
            var score = 0.0;
            var sourceSquare = board.GetSquareByName(move.Source);
            var targetSquare = board.GetSquareByName(move.Target);
            var movingPieceValue = this.GetPieceValue(sourceSquare?.Piece?.Symbol ?? 'P');

            if (move.IsCapture && targetSquare?.Piece != null)
            {
                score += (this.GetPieceValue(targetSquare.Piece.Symbol) * 120) - (movingPieceValue * 7);
            }

            if (this.IsPromotionMove(board, move))
            {
                score += 900;
            }

            var preview = this.TryPreviewBoard(board, move);
            if (preview == null)
            {
                return score;
            }

            if (this.IsKingAttacked(preview, opponentColor))
            {
                score += 90;
            }

            if (this.IsLikelyMateOnBoard(preview, opponentColor, movingColor))
            {
                score += 5000;
            }

            var previewTarget = preview.GetSquareByName(move.Target);
            if (previewTarget?.IsAttackedByColor(opponentColor) ?? false)
            {
                score -= movingPieceValue * 14;
            }

            score += this.EvaluateBoardForColor(preview, movingColor) * 0.05;
            return score;
        }

        private double EvaluateBoardForColor(Board board, Color color)
        {
            var score = 0.0;
            foreach (var square in board.Matrix.SelectMany(x => x))
            {
                if (square.Piece == null)
                {
                    continue;
                }

                var sign = square.Piece.Color == color ? 1 : -1;
                score += sign * this.GetPieceValue(square.Piece.Symbol) * 100;
                score += sign * this.GetSquarePlacementBonus(square);
            }

            return score;
        }

        private double GetSquarePlacementBonus(Square square)
        {
            if (square?.Piece == null || string.IsNullOrWhiteSpace(square.Name) || square.Name.Length != 2)
            {
                return 0;
            }

            var score = 0.0;
            if (this.IsCenterSquare(square.Name))
            {
                score += 18;
            }
            else if ("c3c4c5c6d3d6e3e6f3f4f5f6".Contains(square.Name, StringComparison.OrdinalIgnoreCase))
            {
                score += 7;
            }

            if (square.Piece.IsType('N', 'B') && this.IsDevelopedMinorPiece(square))
            {
                score += 8;
            }

            if (square.Piece.IsType('P'))
            {
                score += this.GetPawnProgress(square) * 3;
            }

            return score;
        }

        private bool IsDevelopedMinorPiece(Square square)
        {
            var homeRank = square.Piece.Color == Color.White ? '1' : '8';
            return square.Name[1] != homeRank;
        }

        private int GetPawnProgress(Square square)
        {
            var rank = square.Name[1] - '0';
            return square.Piece.Color == Color.White
                ? Math.Max(0, rank - 2)
                : Math.Max(0, 7 - rank);
        }

        private double GetKingPressureScore(Board board, Color defenderColor, Color attackerColor)
        {
            var kingSquare = board.GetKingSquare(defenderColor);
            if (kingSquare == null)
            {
                return 0;
            }

            var pressure = kingSquare.IsAttackedByColor(attackerColor) ? 55 : 0;
            for (var rankOffset = -1; rankOffset <= 1; rankOffset++)
            {
                for (var fileOffset = -1; fileOffset <= 1; fileOffset++)
                {
                    if (rankOffset == 0 && fileOffset == 0)
                    {
                        continue;
                    }

                    var square = board.GetSquareByCoordinates(
                        kingSquare.Position.Rank + rankOffset,
                        kingSquare.Position.File + fileOffset);
                    if (square == null)
                    {
                        continue;
                    }

                    if (square.IsAttackedByColor(attackerColor))
                    {
                        pressure += 8;
                    }
                }
            }

            return pressure;
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

        private bool IsPromotionMove(Board board, LegalMove move)
        {
            var sourceSquare = board.GetSquareByName(move.Source);
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

            return this.IsLikelyMateOnBoard(preview, game.Opponent.Color, game.MovingPlayer.Color);
        }

        private bool IsLikelyMateOnBoard(Board board, Color defenderColor, Color attackerColor)
        {
            var kingSquare = board.GetKingSquare(defenderColor);
            if (kingSquare == null || !kingSquare.IsAttackedByColor(attackerColor))
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

                    var escape = board.GetSquareByCoordinates(
                        kingSquare.Position.Rank + rankOffset,
                        kingSquare.Position.File + fileOffset);
                    if (escape == null)
                    {
                        continue;
                    }

                    if (escape.Piece != null && escape.Piece.Color == defenderColor)
                    {
                        continue;
                    }

                    if (!escape.IsAttackedByColor(attackerColor))
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
            return this.TryPreviewBoard(game.ChessBoard, move);
        }

        private Board TryPreviewBoard(Board sourceBoard, LegalMove move)
        {
            var board = sourceBoard.Clone() as Board;
            var source = board?.GetSquareByName(move.Source);
            var target = board?.GetSquareByName(move.Target);
            if (source?.Piece == null || target == null)
            {
                return null;
            }

            board.ShiftPiece(source, target);
            return board;
        }

        private bool IsKingAttacked(Board board, Color color)
        {
            var kingSquare = board.GetKingSquare(color);
            return kingSquare == null || kingSquare.IsAttackedByColor(this.GetOpponentColor(color));
        }

        private Color GetOpponentColor(Color color)
        {
            return color == Color.White ? Color.Black : Color.White;
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
