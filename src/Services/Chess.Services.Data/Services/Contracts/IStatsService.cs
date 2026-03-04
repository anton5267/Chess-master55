namespace Chess.Services.Data.Services.Contracts
{
    using System.Threading.Tasks;

    public interface IStatsService
    {
        T GetUserStats<T>(string userId);

        bool IsStatsInitiated(string userId);

        int GetUserRating(string userId);

        int GetTotalGames();

        string GetMostGamesUser();

        string GetMostWinsUser();

        Task InitiateStatsAsync(string userId);
    }
}
