namespace Chess.Services.Data.Services
{
    using System.Text;

    using Chess.Common.Enums;
    using Chess.Services.Data.Models;
    using Chess.Services.Data.Services.Contracts;

    public class BoardFenSerializer : IBoardFenSerializer
    {
        public string Serialize(Board board)
        {
            var builder = new StringBuilder(capacity: 90);

            for (var rank = 0; rank < 8; rank++)
            {
                var emptySquares = 0;

                for (var file = 0; file < 8; file++)
                {
                    var piece = board.Matrix[rank][file].Piece;
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
