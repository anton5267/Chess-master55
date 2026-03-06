namespace Chess.Services.Data.Services
{
    using System;
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
            var stats = this.statsRepository.All();
            if (!stats.Any())
            {
                return 0;
            }

            var totalPlayed = stats.Sum(x => x.Played);
            return totalPlayed / 2;
        }

        public string GetMostGamesUser()
        {
            var stats = this.statsRepository.All();
            if (!stats.Any())
            {
                return string.Empty;
            }

            var maxGames = stats.Max(x => x.Played);
            if (maxGames == 0)
            {
                return string.Empty;
            }

            return stats
                .Where(x => x.Played == maxGames)
                .Select(x => x.User == null ? string.Empty : x.User.UserName)
                .FirstOrDefault();
        }

        public string GetMostWinsUser()
        {
            var stats = this.statsRepository.All();
            if (!stats.Any())
            {
                return string.Empty;
            }

            var maxWins = stats.Max(x => x.Won);
            if (maxWins == 0)
            {
                return string.Empty;
            }

            return stats
                .Where(x => x.Won == maxWins)
                .Select(x => x.User == null ? string.Empty : x.User.UserName)
                .FirstOrDefault();
        }

        public async Task InitiateStatsAsync(string id)
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                return;
            }

            if (this.IsStatsInitiated(id))
            {
                return;
            }

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
            try
            {
                await this.statsRepository.SaveChangesAsync();
            }
            catch (Exception)
            {
                // Protect against duplicate creation races when multiple requests initialize stats simultaneously.
                if (this.IsStatsInitiated(id))
                {
                    return;
                }

                throw;
            }
        }
    }
}
