namespace Chess.Services.Data.Models
{
    using System;
    using System.Collections.Generic;
    using System.Linq;
    using System.Text;
    using System.Threading.Tasks;

    using Chess.Common.Constants;
    using Chess.Common.Enums;
    using Chess.Data.Common.Repositories;
    using Chess.Data.Models;
    using Chess.Services.Data.Dtos;
    using Chess.Services.Data.Services.Contracts;
    using Microsoft.Extensions.DependencyInjection;

    public class Game
    {
        private readonly INotificationService notificationService;
        private readonly ICheckService checkService;
        private readonly IDrawService drawService;
        private readonly IUtilityService utilityService;
        private readonly IServiceProvider serviceProvider;

        public Game(
            Player player1,
            Player player2,
            INotificationService notificationService,
            ICheckService checkService,
            IDrawService drawService,
            IUtilityService utilityService,
            IServiceProvider serviceProvider)
        {
            this.notificationService = notificationService;
            this.checkService = checkService;
            this.drawService = drawService;
            this.utilityService = utilityService;
            this.serviceProvider = serviceProvider;
            this.Player1 = player1;
            this.Player2 = player2;
            this.Player1.GameId = this.Id;
            this.Player2.GameId = this.Id;

            this.ChessBoard.ArrangePieces();
        }

        public string Id { get; } = Guid.NewGuid().ToString();

        public Board ChessBoard { get; } = Factory.GetBoard();

        public Move Move { get; set; } = Factory.GetMove();

        public GameOver GameOver { get; set; } = GameOver.None;

        public int Turn { get; set; } = 1;

        public Player Player1 { get; set; }

        public Player Player2 { get; set; }

        public Player MovingPlayer => this.Player1?.HasToMove ?? false ? this.Player1 : this.Player2;

        public Player Opponent => this.Player1?.HasToMove ?? false ? this.Player2 : this.Player1;

        public IReadOnlyCollection<LegalMove> GetLegalMoves()
        {
            var moves = new List<LegalMove>();
            var movingColor = this.MovingPlayer.Color;
            var squares = this.ChessBoard.Matrix.SelectMany(x => x).ToArray();

            foreach (var source in squares.Where(x => x.Piece != null && x.Piece.Color == movingColor))
            {
                foreach (var target in squares)
                {
                    if (source.Name == target.Name)
                    {
                        continue;
                    }

                    if (this.IsLegalMoveCandidate(source, target, movingColor, out var isCapture))
                    {
                        moves.Add(new LegalMove
                        {
                            Source = source.Name,
                            Target = target.Name,
                            IsCapture = isCapture,
                        });
                    }
                }
            }

            return moves;
        }

        public (bool Resolved, GameOver GameOver, Player WinnerOrActor) ResolveTerminalStateForCurrentMovingPlayer()
        {
            if (this.GameOver != GameOver.None)
            {
                return (false, this.GameOver, null);
            }

            if (this.GetLegalMoves().Count > 0)
            {
                return (false, GameOver.None, null);
            }

            var movingPlayerIsCheck = this.checkService.IsCheck(this.MovingPlayer, this.ChessBoard);
            if (movingPlayerIsCheck)
            {
                this.GameOver = GameOver.Checkmate;
                return (true, this.GameOver, this.Opponent);
            }

            this.GameOver = GameOver.Stalemate;
            return (true, this.GameOver, null);
        }

        public async Task<bool> MakeMoveAsync(string source, string target, string targetFen, bool persistHistory = true)
        {
            if (this.GameOver != GameOver.None)
            {
                return false;
            }

            this.Move.Source = this.ChessBoard
                .GetSquareByName(source);
            this.Move.Target = this.ChessBoard
                .GetSquareByName(target);

            var oldSource = this.Move.Source.Clone() as Square;
            var oldTarget = this.Move.Target.Clone() as Square;
            var oldBoard = this.ChessBoard.Clone() as Board;
            var oldIsCheck = this.MovingPlayer.IsCheck;

            if (this.MovePiece() || this.TakePiece() || this.EnPassantTake())
            {
                var resolvedTargetFen = string.IsNullOrWhiteSpace(targetFen)
                    ? this.SerializeCurrentFen()
                    : targetFen;

                this.IsPawnPromotion(resolvedTargetFen);
                this.notificationService.ClearCheck(this.MovingPlayer, this.Opponent);
                this.checkService.IsCheck(this.Opponent, this.ChessBoard);

                // Game state must continue even if history persistence fails.
                if (persistHistory)
                {
                    try
                    {
                        await this.UpdateHistory(oldSource, oldTarget, oldBoard);
                    }
                    catch
                    {
                    }
                }
                else
                {
                    this.UpdateMoveHistoryInMemory(oldSource, oldTarget, oldBoard);
                }

                this.IsGameOver(resolvedTargetFen);
                this.ChangeTurns();
                this.Turn++;

                return true;
            }

            this.notificationService.InvalidMove(oldIsCheck, this.MovingPlayer);

            return false;
        }

        public bool TryMove(Player player, Move move)
        {
            var oldPiece = move.Target.Piece;
            this.ChessBoard.ShiftPiece(move.Source, move.Target);

            if (this.checkService.IsCheck(player, this.ChessBoard))
            {
                this.ChessBoard.ShiftPiece(move.Target, move.Source, oldPiece);
                return false;
            }

            if (player == this.Opponent)
            {
                this.ChessBoard.ShiftPiece(move.Target, move.Source, oldPiece);
            }

            return true;
        }

        private bool IsLegalMoveCandidate(Square source, Square target, Color movingColor, out bool isCapture)
        {
            isCapture = false;

            if (source.Piece == null || source.Piece.Color != movingColor)
            {
                return false;
            }

            if (target.Piece != null && target.Piece.Color == movingColor)
            {
                return false;
            }

            var boardClone = this.ChessBoard.Clone() as Board;
            var sourceClone = boardClone.GetSquareByName(source.Name);
            var targetClone = boardClone.GetSquareByName(target.Name);
            var moveClone = Factory.GetMove(sourceClone, targetClone);
            this.CopyEnPassantArguments(moveClone, boardClone);

            if (targetClone.Piece != null)
            {
                if (!sourceClone.Piece.Take(targetClone.Position, boardClone.Matrix, this.Turn, moveClone))
                {
                    return false;
                }

                isCapture = true;
                boardClone.ShiftPiece(sourceClone, targetClone);
                return !this.IsKingInCheckAfterPreview(boardClone, movingColor);
            }

            if (sourceClone.Piece.Move(targetClone.Position, boardClone.Matrix, this.Turn, moveClone))
            {
                boardClone.ShiftPiece(sourceClone, targetClone);
                return !this.IsKingInCheckAfterPreview(boardClone, movingColor);
            }

            if (this.TryPreviewEnPassantMove(boardClone, sourceClone, targetClone, movingColor))
            {
                isCapture = true;
                return true;
            }

            return false;
        }

        private bool TryPreviewEnPassantMove(Board boardClone, Square sourceClone, Square targetClone, Color movingColor)
        {
            if (this.Move.EnPassantArgs.SquareAvailable == null ||
                this.Move.EnPassantArgs.Turn != this.Turn ||
                !sourceClone.Piece.IsType(SymbolConstants.Pawn) ||
                !targetClone.Name.Equals(this.Move.EnPassantArgs.SquareAvailable.Name, StringComparison.Ordinal))
            {
                return false;
            }

            var expectedSourceRank = movingColor == Color.White
                ? targetClone.Position.Rank + 1
                : targetClone.Position.Rank - 1;

            if (sourceClone.Position.Rank != expectedSourceRank ||
                Math.Abs(sourceClone.Position.File - targetClone.Position.File) != 1)
            {
                return false;
            }

            var neighbourSquare = boardClone.GetSquareByCoordinates(sourceClone.Position.Rank, targetClone.Position.File);
            if (neighbourSquare?.Piece == null ||
                neighbourSquare.Piece.Color == movingColor ||
                !neighbourSquare.Piece.IsType(SymbolConstants.Pawn))
            {
                return false;
            }

            boardClone.ShiftEnPassant(sourceClone, targetClone, neighbourSquare);
            return !this.IsKingInCheckAfterPreview(boardClone, movingColor);
        }

        private bool IsKingInCheckAfterPreview(Board boardClone, Color movingColor)
        {
            var validationPlayer = Factory.GetPlayer("validator", Guid.NewGuid().ToString(), string.Empty);
            validationPlayer.Color = movingColor;

            return this.checkService.IsCheck(validationPlayer, boardClone);
        }

        private void CopyEnPassantArguments(Move moveClone, Board boardClone)
        {
            moveClone.EnPassantArgs.Turn = this.Move.EnPassantArgs.Turn;

            if (this.Move.EnPassantArgs.SquareAvailable != null)
            {
                moveClone.EnPassantArgs.SquareAvailable =
                    boardClone.GetSquareByName(this.Move.EnPassantArgs.SquareAvailable.Name);
            }
        }

        private bool MovePiece()
        {
            if (this.Move.Target.Piece == null &&
                this.MovingPlayer.Color == this.Move.Source.Piece.Color &&
                this.Move.Source.Piece.Move(this.Move.Target.Position, this.ChessBoard.Matrix, this.Turn, this.Move))
            {
                if (!this.TryMove(this.MovingPlayer, this.Move))
                {
                    this.MovingPlayer.IsCheck = true;
                    return false;
                }

                this.MovingPlayer.IsCheck = false;
                this.Move.Target.Piece.IsFirstMove = false;
                return true;
            }

            return false;
        }

        private bool TakePiece()
        {
            if (this.Move.Target.Piece != null &&
                this.Move.Target.Piece.Color != this.Move.Source.Piece.Color &&
                this.MovingPlayer.Color == this.Move.Source.Piece.Color &&
                this.Move.Source.Piece.Take(this.Move.Target.Position, this.ChessBoard.Matrix, this.Turn, this.Move))
            {
                var piece = this.Move.Target.Piece;

                if (!this.TryMove(this.MovingPlayer, this.Move))
                {
                    this.MovingPlayer.IsCheck = true;
                    return false;
                }

                this.MovingPlayer.IsCheck = false;
                this.Move.Target.Piece.IsFirstMove = false;
                this.MovingPlayer.TakeFigure(piece.Name);
                this.MovingPlayer.Points += piece.Points;
                this.Move.Type = MoveType.Taking;
                this.notificationService.UpdateTakenPiecesHistory(this.MovingPlayer, piece.Name);

                return true;
            }

            return false;
        }

        private bool EnPassantTake()
        {
            if (this.ValidEnPassant())
            {
                if (!this.TryEnPassant())
                {
                    this.MovingPlayer.IsCheck = true;
                    return false;
                }

                this.MovingPlayer.IsCheck = false;
                this.MovingPlayer.TakeFigure(this.Move.Target.Piece.Name);
                this.MovingPlayer.Points += this.Move.Target.Piece.Points;
                this.Move.EnPassantArgs.SquareAvailable = null;
                this.notificationService.UpdateTakenPiecesHistory(this.MovingPlayer, this.Move.Target.Piece.Name);
                return true;
            }

            return false;
        }

        private bool ValidEnPassant()
        {
            if (this.ValidTargetSquare() &&
                this.Move.Source.Piece.IsType(SymbolConstants.Pawn) &&
                this.ValidSourcePosition())
            {
                return true;
            }

            return false;
        }

        private bool ValidTargetSquare()
        {
            return this.Move.EnPassantArgs.SquareAvailable != null &&
                this.Move.EnPassantArgs.Turn == this.Turn &&
                this.Move.EnPassantArgs.SquareAvailable.Equals(this.Move.Target);
        }

        private bool ValidSourcePosition()
        {
            var offsetPlayer = this.MovingPlayer.Color == Color.White ? 1 : -1;

            var position1 = Factory.GetPosition(
                this.Move.EnPassantArgs.SquareAvailable.Position.Rank + offsetPlayer,
                this.Move.EnPassantArgs.SquareAvailable.Position.File + 1);
            var position2 = Factory.GetPosition(
                this.Move.EnPassantArgs.SquareAvailable.Position.Rank + offsetPlayer,
                this.Move.EnPassantArgs.SquareAvailable.Position.File - 1);

            if (this.Move.Source.Position.Equals(position1) ||
                this.Move.Source.Position.Equals(position2))
            {
                return true;
            }

            return false;
        }

        private bool TryEnPassant()
        {
            var neighbourSquare = this.ChessBoard
               .GetSquareByCoordinates(
                    this.Move.Source.Position.Rank,
                    this.Move.Target.Position.File);

            this.ChessBoard.ShiftEnPassant(this.Move.Source, this.Move.Target, neighbourSquare);

            if (this.checkService.IsCheck(this.MovingPlayer, this.ChessBoard))
            {
                this.ChessBoard.ShiftEnPassant(this.Move.Target, this.Move.Source, neighbourSquare, neighbourSquare.Piece);
                return false;
            }

            this.Move.EnPassantArgs.SquareTakenPiece = neighbourSquare;
            this.Move.Type = MoveType.EnPassant;
            return true;
        }

        private void IsGameOver(string targetFen)
        {
            if (this.checkService.IsCheck(this.Opponent, this.ChessBoard))
            {
                this.notificationService.SendCheck(this.MovingPlayer);

                if (this.checkService.IsCheckmate(this.ChessBoard, this.MovingPlayer, this.Opponent, this))
                {
                    this.GameOver = GameOver.Checkmate;
                }
            }

            this.MovingPlayer.IsThreefoldDrawAvailable = false;
            this.notificationService.SendThreefoldDrawAvailability(this.MovingPlayer, false);

            if (this.drawService.IsThreefoldRepetionDraw(targetFen))
            {
                this.Opponent.IsThreefoldDrawAvailable = true;
                this.notificationService.SendThreefoldDrawAvailability(this.Opponent, true);
            }

            if (this.drawService.IsFivefoldRepetitionDraw(targetFen))
            {
                this.GameOver = GameOver.FivefoldDraw;
            }

            if (this.drawService.IsFiftyMoveDraw(this.Move))
            {
                this.GameOver = GameOver.FiftyMoveDraw;
            }

            if (this.drawService.IsDraw(this.ChessBoard))
            {
                this.GameOver = GameOver.Draw;
            }

            if (this.drawService.IsStalemate(this.ChessBoard, this.Opponent))
            {
                this.GameOver = GameOver.Stalemate;
            }

            if (this.GameOver != GameOver.None)
            {
                this.notificationService.SendGameOver(this.MovingPlayer, this.GameOver);
            }
        }

        private void IsPawnPromotion(string targetFen)
        {
            if (this.Move.Target.Piece.IsType(SymbolConstants.Pawn) &&
                this.Move.Target.Piece.IsLastMove)
            {
                this.Move.Target.Piece = Factory.GetQueen(this.MovingPlayer.Color);
                this.Move.Type = MoveType.PawnPromotion;
                this.utilityService.GetPawnPromotionFenString(targetFen, this.MovingPlayer, this.Move);
                this.ChessBoard.CalculateAttackedSquares();
            }
        }

        private void ChangeTurns()
        {
            if (this.Player1.HasToMove)
            {
                this.Player1.HasToMove = false;
                this.Player2.HasToMove = true;
            }
            else
            {
                this.Player2.HasToMove = false;
                this.Player1.HasToMove = true;
            }
        }

        private async Task UpdateHistory(Square oldSource, Square oldTarget, Board oldBoard)
        {
            var notation = this.utilityService
                .GetAlgebraicNotation(new AlgebraicNotationDto
                {
                    OldSource = oldSource,
                    OldTarget = oldTarget,
                    OldBoard = oldBoard,
                    Opponent = this.Opponent,
                    Turn = this.Turn,
                    Move = this.Move,
                });

            using var scope = this.serviceProvider.CreateScope();
            var moveRepository = scope.ServiceProvider.GetRequiredService<IRepository<MoveEntity>>();

            var onlyMoveNotation = notation.Split(' ', StringSplitOptions.RemoveEmptyEntries)[1];
            await moveRepository.AddAsync(new MoveEntity
            {
                Notation = onlyMoveNotation,
                GameId = this.Id,
                UserId = this.MovingPlayer.UserId,
            });

            await moveRepository.SaveChangesAsync();

            this.notificationService.UpdateMoveHistory(this.MovingPlayer, notation);
        }

        private void UpdateMoveHistoryInMemory(Square oldSource, Square oldTarget, Board oldBoard)
        {
            var notation = this.utilityService
                .GetAlgebraicNotation(new AlgebraicNotationDto
                {
                    OldSource = oldSource,
                    OldTarget = oldTarget,
                    OldBoard = oldBoard,
                    Opponent = this.Opponent,
                    Turn = this.Turn,
                    Move = this.Move,
                });

            this.notificationService.UpdateMoveHistory(this.MovingPlayer, notation);
        }

        private string SerializeCurrentFen()
        {
            var builder = new StringBuilder(capacity: 90);

            for (var rank = 0; rank < 8; rank++)
            {
                var emptySquares = 0;

                for (var file = 0; file < 8; file++)
                {
                    var piece = this.ChessBoard.Matrix[rank][file].Piece;
                    if (piece == null)
                    {
                        emptySquares++;
                        continue;
                    }

                    if (emptySquares > 0)
                    {
                        builder.Append(emptySquares);
                        emptySquares = 0;
                    }

                    var symbol = piece.Color == Color.Black
                        ? char.ToLowerInvariant(piece.Symbol)
                        : piece.Symbol;

                    builder.Append(symbol);
                }

                if (emptySquares > 0)
                {
                    builder.Append(emptySquares);
                }

                if (rank < 7)
                {
                    builder.Append('/');
                }
            }

            return builder.ToString();
        }
    }
}
