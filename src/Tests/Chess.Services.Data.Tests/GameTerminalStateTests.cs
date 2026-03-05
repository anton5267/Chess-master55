namespace Chess.Services.Data.Tests;

using System.Linq;

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

        result.resolved.Should().BeTrue();
        result.gameOver.Should().Be(GameOver.Checkmate);
        result.winnerOrActor.Should().NotBeNull();
        result.winnerOrActor!.Color.Should().Be(Color.White);
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

        result.resolved.Should().BeTrue();
        result.gameOver.Should().Be(GameOver.Stalemate);
        result.winnerOrActor.Should().BeNull();
        game.GameOver.Should().Be(GameOver.Stalemate);
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
