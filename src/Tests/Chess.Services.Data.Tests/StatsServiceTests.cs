namespace Chess.Services.Data.Tests;

using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

using Chess.Data.Common.Repositories;
using Chess.Data.Models;
using Chess.Services.Data.Services;
using FluentAssertions;
using Xunit;

public class StatsServiceTests
{
    [Fact]
    public async Task InitiateStatsAsync_ShouldAddDefaultStatsRecord()
    {
        var repository = new InMemoryStatisticRepository();
        var service = new StatsService(repository);

        await service.InitiateStatsAsync("user-1");

        repository.Items.Should().ContainSingle();
        repository.Items[0].UserId.Should().Be("user-1");
        repository.Items[0].EloRating.Should().Be(1200);
        repository.SaveChangesCalls.Should().Be(1);
    }

    [Fact]
    public void IsStatsInitiated_ShouldReturnTrue_WhenUserStatsExist()
    {
        var repository = new InMemoryStatisticRepository();
        repository.Items.Add(new StatisticEntity { UserId = "user-1", EloRating = 1200 });
        var service = new StatsService(repository);

        var isInitiated = service.IsStatsInitiated("user-1");

        isInitiated.Should().BeTrue();
    }

    [Fact]
    public void GetTotalGames_ShouldReturnHalfOfPlayedSum()
    {
        var repository = new InMemoryStatisticRepository();
        repository.Items.Add(new StatisticEntity { UserId = "u1", Played = 10, EloRating = 1200 });
        repository.Items.Add(new StatisticEntity { UserId = "u2", Played = 10, EloRating = 1200 });
        repository.Items.Add(new StatisticEntity { UserId = "u3", Played = 4, EloRating = 1200 });
        repository.Items.Add(new StatisticEntity { UserId = "u4", Played = 4, EloRating = 1200 });
        var service = new StatsService(repository);

        var totalGames = service.GetTotalGames();

        totalGames.Should().Be(14);
    }

    [Fact]
    public void GetMostGamesUser_ShouldReturnUserWithHighestPlayedCount()
    {
        var repository = new InMemoryStatisticRepository();
        repository.Items.Add(new StatisticEntity { UserId = "u1", Played = 8, EloRating = 1200, User = new UserEntity { UserName = "alpha" } });
        repository.Items.Add(new StatisticEntity { UserId = "u2", Played = 12, EloRating = 1200, User = new UserEntity { UserName = "beta" } });
        var service = new StatsService(repository);

        var mostGamesUser = service.GetMostGamesUser();

        mostGamesUser.Should().Be("beta");
    }

    [Fact]
    public void GetMostWinsUser_ShouldReturnUserWithHighestWins()
    {
        var repository = new InMemoryStatisticRepository();
        repository.Items.Add(new StatisticEntity { UserId = "u1", Won = 5, EloRating = 1200, User = new UserEntity { UserName = "alpha" } });
        repository.Items.Add(new StatisticEntity { UserId = "u2", Won = 9, EloRating = 1200, User = new UserEntity { UserName = "beta" } });
        var service = new StatsService(repository);

        var mostWinsUser = service.GetMostWinsUser();

        mostWinsUser.Should().Be("beta");
    }

    private sealed class InMemoryStatisticRepository : IRepository<StatisticEntity>
    {
        public List<StatisticEntity> Items { get; } = new ();

        public int SaveChangesCalls { get; private set; }

        public IQueryable<StatisticEntity> All()
        {
            return this.Items.AsQueryable();
        }

        public IQueryable<StatisticEntity> AllAsNoTracking()
        {
            return this.Items.AsQueryable();
        }

        public Task AddAsync(StatisticEntity entity)
        {
            entity.Id = this.Items.Count + 1;
            entity.CreatedOn = DateTime.UtcNow;
            this.Items.Add(entity);
            return Task.CompletedTask;
        }

        public void Update(StatisticEntity entity)
        {
            // No-op for in-memory list.
        }

        public void Delete(StatisticEntity entity)
        {
            this.Items.Remove(entity);
        }

        public Task<int> SaveChangesAsync()
        {
            this.SaveChangesCalls++;
            return Task.FromResult(1);
        }

        public void Dispose()
        {
        }
    }
}
