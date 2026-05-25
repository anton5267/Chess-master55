namespace Chess.Services.Data.Tests;

using System.Linq;
using System.Threading.Tasks;

using Chess.Common.Enums;
using Chess.Services.Data.Models;
using Chess.Services.Data.Services;
using Chess.Services.Data.Services.Contracts;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

public class GameTerminalStateTests
{
    [Fact]
    public void ResolveTerminalStateForCurrentMovingPlayer_ShouldReturnCheckmate_WhenNoLegalMovesAndInCheck()
    {
        var game = CreateEmptyGame(movingColor: Color.Black);
        var board = game.ChessBoard;

        board.GetSquareByName("h8").Piece = Factory.GetKing(Color.Black);
        board.GetSquareByName("f6").Piece = Factory.GetKing(Color.White);
        board.GetSquareByName("g7").Piece = Factory.GetQueen(Color.White);
        board.CalculateAttackedSquares();

        var result = game.ResolveTerminalStateForCurrentMovingPlayer();

        result.Resolved.Should().BeTrue();
        result.GameOver.Should().Be(GameOver.Checkmate);
        result.WinnerOrActor.Should().NotBeNull();
        result.WinnerOrActor!.Color.Should().Be(Color.White);
        game.GameOver.Should().Be(GameOver.Checkmate);
    }

    [Fact]
    public void ResolveTerminalStateForCurrentMovingPlayer_ShouldReturnStalemate_WhenNoLegalMovesAndNotInCheck()
    {
        var game = CreateEmptyGame(movingColor: Color.Black);
        var board = game.ChessBoard;

        board.GetSquareByName("h8").Piece = Factory.GetKing(Color.Black);
        board.GetSquareByName("f7").Piece = Factory.GetKing(Color.White);
        board.GetSquareByName("g6").Piece = Factory.GetQueen(Color.White);
        board.CalculateAttackedSquares();

        var result = game.ResolveTerminalStateForCurrentMovingPlayer();

        result.Resolved.Should().BeTrue();
        result.GameOver.Should().Be(GameOver.Stalemate);
        result.WinnerOrActor.Should().BeNull();
        game.GameOver.Should().Be(GameOver.Stalemate);
    }

    [Fact]
    public void ResolveTerminalStateForOpponentAfterMove_ShouldReturnCheckmate_WhenOpponentKingIsCheckedAndHasNoLegalMoves()
    {
        var game = CreateEmptyGame(movingColor: Color.Black);
        var board = game.ChessBoard;

        board.GetSquareByName("g5").Piece = Factory.GetKing(Color.White);
        board.GetSquareByName("f7").Piece = Factory.GetKing(Color.Black);
        board.GetSquareByName("c7").Piece = Factory.GetBishop(Color.Black);
        board.GetSquareByName("g8").Piece = Factory.GetKnight(Color.Black);
        board.GetSquareByName("g7").Piece = Factory.GetPawn(Color.Black);
        board.GetSquareByName("g6").Piece = Factory.GetBishop(Color.Black);
        board.GetSquareByName("c5").Piece = Factory.GetPawn(Color.Black);
        board.GetSquareByName("h2").Piece = Factory.GetRook(Color.Black);
        board.GetSquareByName("b1").Piece = Factory.GetRook(Color.Black);
        board.GetSquareByName("g1").Piece = Factory.GetQueen(Color.Black);
        board.CalculateAttackedSquares();

        game.GetLegalMovesForPlayer(game.Opponent).Should().BeEmpty();

        var result = game.ResolveTerminalStateForOpponentAfterMove();

        result.Resolved.Should().BeTrue();
        result.GameOver.Should().Be(GameOver.Checkmate);
        result.WinnerOrActor.Should().NotBeNull();
        result.WinnerOrActor!.Color.Should().Be(Color.Black);
        game.GameOver.Should().Be(GameOver.Checkmate);
    }

    [Fact]
    public async Task MakeMoveAsync_ShouldKeepCheckmate_WhenMoveChecksOpponentKingWithNoLegalMoves()
    {
        var game = CreateEmptyGame(movingColor: Color.Black);
        var board = game.ChessBoard;

        board.GetSquareByName("g5").Piece = Factory.GetKing(Color.White);
        board.GetSquareByName("f7").Piece = Factory.GetKing(Color.Black);
        board.GetSquareByName("c7").Piece = Factory.GetBishop(Color.Black);
        board.GetSquareByName("g8").Piece = Factory.GetKnight(Color.Black);
        board.GetSquareByName("g7").Piece = Factory.GetPawn(Color.Black);
        board.GetSquareByName("g6").Piece = Factory.GetBishop(Color.Black);
        board.GetSquareByName("c5").Piece = Factory.GetPawn(Color.Black);
        board.GetSquareByName("h2").Piece = Factory.GetRook(Color.Black);
        board.GetSquareByName("b1").Piece = Factory.GetRook(Color.Black);
        board.GetSquareByName("h1").Piece = Factory.GetQueen(Color.Black);
        board.CalculateAttackedSquares();

        var moved = await game.MakeMoveAsync("h1", "g1", targetFen: null, persistHistory: false);

        moved.Should().BeTrue();
        game.GameOver.Should().Be(GameOver.Checkmate);
        game.Player1.HasToMove.Should().BeTrue();
        game.Player2.HasToMove.Should().BeFalse();
        game.GetLegalMovesForPlayer(game.Player1).Should().BeEmpty();
    }

    private static Game CreateEmptyGame(Color movingColor)
    {
        var services = new ServiceCollection()
            .AddTransient<INotificationService, NotificationService>()
            .AddTransient<ICheckService, CheckService>()
            .AddTransient<IDrawService, DrawService>()
            .AddTransient<IUtilityService, UtilityService>()
            .BuildServiceProvider();

        var white = new Player("white", "white-conn", "white-id")
        {
            Color = Color.White,
            HasToMove = movingColor == Color.White,
        };

        var black = new Player("black", "black-conn", "black-id")
        {
            Color = Color.Black,
            HasToMove = movingColor == Color.Black,
        };

        var game = new Game(
            white,
            black,
            services.GetRequiredService<INotificationService>(),
            services.GetRequiredService<ICheckService>(),
            services.GetRequiredService<IDrawService>(),
            services.GetRequiredService<IUtilityService>(),
            services);

        foreach (var square in game.ChessBoard.Matrix.SelectMany(x => x))
        {
            square.Piece = null;
        }

        game.ChessBoard.CalculateAttackedSquares();
        game.GameOver = GameOver.None;
        game.Turn = 1;
        return game;
    }
}
