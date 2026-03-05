namespace Chess.Services.Data.Tests;

using System.Threading.Tasks;
using System.Linq;

using Chess.Common.Enums;
using Chess.Services.Data.Models;
using Chess.Services.Data.Services;
using Chess.Services.Data.Services.Contracts;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

public class GameLegalMovesTests
{
    [Fact]
    public void GetLegalMoves_ShouldIncludeCaptureAndNonCapture_WhenCaptureExists()
    {
        var serviceProvider = new ServiceCollection().BuildServiceProvider();
        var notificationService = new NotificationService();
        var checkService = new CheckService();
        var drawService = new DrawService();
        var utilityService = new UtilityService();

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
            notificationService,
            checkService,
            drawService,
            utilityService,
            serviceProvider);

        var board = game.ChessBoard;

        board.ShiftPiece(board.GetSquareByName("e2"), board.GetSquareByName("e4"));
        board.GetSquareByName("e4").Piece.IsFirstMove = false;

        board.ShiftPiece(board.GetSquareByName("d7"), board.GetSquareByName("d5"));
        board.GetSquareByName("d5").Piece.IsFirstMove = false;

        game.Turn = 3;

        var legalMoves = game.GetLegalMoves();

        legalMoves.Should().Contain(move =>
            move.Source == "e4" &&
            move.Target == "d5" &&
            move.IsCapture);

        legalMoves.Should().Contain(move =>
            move.Source == "g1" &&
            move.Target == "f3" &&
            !move.IsCapture);

        legalMoves.Should().NotBeEmpty();
        legalMoves.Where(x => x.Source == "e4").Should().NotBeEmpty();
    }

    [Fact]
    public void GetLegalMoves_ShouldAllowBlockingCheckWithPieces_NotOnlyKingMoves()
    {
        var serviceProvider = new ServiceCollection().BuildServiceProvider();
        var notificationService = new NotificationService();
        var checkService = new CheckService();
        var drawService = new DrawService();
        var utilityService = new UtilityService();

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
            notificationService,
            checkService,
            drawService,
            utilityService,
            serviceProvider);

        var board = game.ChessBoard;

        // Build a simple line-check position:
        // black queen on e7 checks white king on e1.
        board.GetSquareByName("e2").Piece = null;
        board.GetSquareByName("e7").Piece = null;
        board.ShiftPiece(board.GetSquareByName("d8"), board.GetSquareByName("e7"));
        board.GetSquareByName("f7").Piece = null;
        board.GetSquareByName("f3").Piece = Factory.GetPawn(Color.Black);
        board.CalculateAttackedSquares();

        var legalMoves = game.GetLegalMoves();

        // White must be able to block with a piece, not only move the king.
        legalMoves.Should().Contain(move =>
            move.Source == "d1" &&
            move.Target == "e2" &&
            !move.IsCapture);

        legalMoves.Should().Contain(move =>
            move.Source == "f1" &&
            move.Target == "e2" &&
            !move.IsCapture);

        legalMoves.Should().Contain(move =>
            move.Source == "g1" &&
            move.Target == "e2" &&
            !move.IsCapture);
    }

    [Fact]
    public async Task MakeMoveAsync_ShouldHandleNullTargetFen_ForBotPath()
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

        var result = await game.MakeMoveAsync("e2", "e4", targetFen: null, persistHistory: false);

        result.Should().BeTrue();
        game.Turn.Should().Be(2);
        game.Player1.HasToMove.Should().BeFalse();
        game.Player2.HasToMove.Should().BeTrue();
        game.ChessBoard.GetSquareByName("e4").Piece.Should().NotBeNull();
        game.ChessBoard.GetSquareByName("e2").Piece.Should().BeNull();
    }
}
