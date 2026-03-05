namespace Chess.Services.Data.Services.Contracts
{
    using Chess.Services.Data.Models;

    public interface IBoardFenSerializer
    {
        string Serialize(Board board);
    }
}
