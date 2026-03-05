namespace Chess.Services.Data.Tests;

using Chess.Services.Data.Models;
using Chess.Services.Data.Services;
using FluentAssertions;
using Xunit;

public class BoardFenSerializerTests
{
    [Fact]
    public void Serialize_ShouldReturnStartPositionFen()
    {
        var serializer = new BoardFenSerializer();
        var board = Factory.GetBoard();
        board.ArrangePieces();

        var fen = serializer.Serialize(board);

        fen.Should().Be("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR");
    }

    [Fact]
    public void Serialize_ShouldReturnUpdatedFenAfterMove()
    {
        var serializer = new BoardFenSerializer();
        var board = Factory.GetBoard();
        board.ArrangePieces();
        var source = board.GetSquareByName("e2");
        var target = board.GetSquareByName("e4");
        board.ShiftPiece(source, target);

        var fen = serializer.Serialize(board);

        fen.Should().Be("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR");
    }
}
