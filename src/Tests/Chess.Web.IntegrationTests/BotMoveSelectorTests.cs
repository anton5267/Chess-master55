namespace Chess.Web.IntegrationTests;

using System.Linq;

using Chess.Common.Enums;
using Chess.Services.Data.Models;
using Chess.Services.Data.Services;
using Chess.Services.Data.Services.Contracts;
using Chess.Web.Hubs.Bot;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

public class BotMoveSelectorTests
{
    [Fact]
    public void RandomLegalMoveSelector_ShouldAlwaysReturnLegalMove()
    {
        var services = new ServiceCollection()
            .AddTransient<INotificationService, NotificationService>()
            .AddTransient<ICheckService, CheckService>()
            .AddTransient<IDrawService, DrawService>()
            .AddTransient<IUtilityService, UtilityService>()
            .BuildServiceProvider();

        var whitePlayer = new Player("white", "white-conn", "white-id")
        {
            Color = Color.White,
            HasToMove = true,
        };

        var blackPlayer = new Player("black", "black-conn", "black-id")
        {
            Color = Color.Black,
            HasToMove = false,
        };

        var game = new Game(
            whitePlayer,
            blackPlayer,
            services.GetRequiredService<INotificationService>(),
            services.GetRequiredService<ICheckService>(),
            services.GetRequiredService<IDrawService>(),
            services.GetRequiredService<IUtilityService>(),
            services);

        var legalMoves = game.GetLegalMoves().ToArray();
        legalMoves.Should().NotBeEmpty();

        var selector = new RandomLegalMoveSelector();
        selector.TrySelectMove(game, out var selectedMove).Should().BeTrue();
        selectedMove.Should().NotBeNull();

        legalMoves.Should().Contain(move =>
            move.Source == selectedMove.Source &&
            move.Target == selectedMove.Target);
    }

    [Fact]
    public void RandomLegalMoveSelector_ShouldPreferHighestValueCapture()
    {
        var game = CreateEmptyGame(movingColor: Color.White);
        var board = game.ChessBoard;

        board.GetSquareByName("a1").Piece = Factory.GetKing(Color.White);
        board.GetSquareByName("h8").Piece = Factory.GetKing(Color.Black);
        board.GetSquareByName("d4").Piece = Factory.GetQueen(Color.White);
        board.GetSquareByName("d5").Piece = Factory.GetPawn(Color.Black);
        board.GetSquareByName("g4").Piece = Factory.GetRook(Color.Black);
        board.CalculateAttackedSquares();

        var selector = new RandomLegalMoveSelector();
        for (var i = 0; i < 20; i++)
        {
            selector.TrySelectMove(game, out var selectedMove).Should().BeTrue();
            selectedMove.Should().NotBeNull();
            selectedMove.Source.Should().Be("d4");
            selectedMove.Target.Should().Be("g4");
            selectedMove.IsCapture.Should().BeTrue();
        }
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
