namespace Chess.Services.Data.Services
{
    using System.Linq;
    using System.Threading.Tasks;

    using Chess.Data.Common.Repositories;
    using Chess.Data.Models;
    using Chess.Services.Data.Services.Contracts;
    using Chess.Services.Mapping;

    public class StatsService : IStatsService
    {
        private readonly IRepository<StatisticEntity> statsRepository;

        public StatsService(IRepository<StatisticEntity> statsRepository)
        {
            this.statsRepository = statsRepository;
        }

        public T GetUserStats<T>(string userId)
        {
            return this.statsRepository.All().Where(x => x.UserId == userId).To<T>().FirstOrDefault();
        }

        public bool IsStatsInitiated(string id)
        {
            return this.statsRepository.All().Any(x => x.UserId == id);
        }

        public int GetUserRating(string userId)
        {
            return this.statsRepository.All().Where(x => x.UserId == userId).Select(x => x.EloRating).FirstOrDefault();
        }

        public int GetTotalGames()
        {
            return this.statsRepository.All().Select(x => x.Played).Sum() / 2;
        }

        public string GetMostGamesUser()
        {
            int maxGames = this.statsRepository.All().Max(x => x.Played);

            return this.statsRepository.All().Where(x => x.Played == maxGames).Select(x => x.User.UserName).FirstOrDefault();
        }

        public string GetMostWinsUser()
        {
            int maxWins = this.statsRepository.All().Max(x => x.Won);

            return this.statsRepository.All().Where(x => x.Won == maxWins).Select(x => x.User.UserName).FirstOrDefault();
        }

        public async Task InitiateStatsAsync(string id)
        {
            var stats = new StatisticEntity
            {
                Played = 0,
                Won = 0,
                Drawn = 0,
                Lost = 0,
                UserId = id,
                EloRating = 1200,
            };

            await this.statsRepository.AddAsync(stats);
            await this.statsRepository.SaveChangesAsync();
        }
    }
}
