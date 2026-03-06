namespace Chess.Services.Data.Tests;

using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

using AutoMapper;

using Chess.Data.Common.Repositories;
using Chess.Data.Models;
using Chess.Services.Data.Services;
using Chess.Services.Mapping;
using Chess.Web.ViewModels;
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
    public async Task InitiateStatsAsync_ShouldBeIdempotent_ForSameUser()
    {
        var repository = new InMemoryStatisticRepository();
        var service = new StatsService(repository);

        await service.InitiateStatsAsync("user-1");
        await service.InitiateStatsAsync("user-1");

        repository.Items.Should().ContainSingle(x => x.UserId == "user-1");
        repository.SaveChangesCalls.Should().Be(1);
    }

    [Fact]
    public async Task InitiateStatsAsync_ShouldSkip_WhenUserIdIsMissing()
    {
        var repository = new InMemoryStatisticRepository();
        var service = new StatsService(repository);

        await service.InitiateStatsAsync(string.Empty);
        await service.InitiateStatsAsync("   ");

        repository.Items.Should().BeEmpty();
        repository.SaveChangesCalls.Should().Be(0);
    }

    [Fact]
    public async Task InitiateStatsAsync_ShouldIgnoreDuplicateRace_WhenSaveChangesThrowsButStatsAlreadyExist()
    {
        var repository = new InMemoryStatisticRepository
        {
            SaveChangesException = new InvalidOperationException("duplicate key"),
        };
        var service = new StatsService(repository);

        Func<Task> act = () => service.InitiateStatsAsync("user-1");

        await act.Should().NotThrowAsync();
        repository.Items.Should().ContainSingle(x => x.UserId == "user-1");
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

    [Fact]
    public void GetTotalGames_ShouldReturnZero_WhenNoStatsExist()
    {
        var repository = new InMemoryStatisticRepository();
        var service = new StatsService(repository);

        var totalGames = service.GetTotalGames();

        totalGames.Should().Be(0);
    }

    [Fact]
    public void GetMostGamesUser_ShouldReturnEmpty_WhenNoStatsExist()
    {
        var repository = new InMemoryStatisticRepository();
        var service = new StatsService(repository);

        var mostGamesUser = service.GetMostGamesUser();

        mostGamesUser.Should().BeEmpty();
    }

    [Fact]
    public void GetMostWinsUser_ShouldReturnEmpty_WhenNoStatsExist()
    {
        var repository = new InMemoryStatisticRepository();
        var service = new StatsService(repository);

        var mostWinsUser = service.GetMostWinsUser();

        mostWinsUser.Should().BeEmpty();
    }

    [Fact]
    public void UserStatsViewModel_CustomMapping_ShouldMapStatisticEntityFields()
    {
        var expression = new MapperConfigurationExpression();
        var viewModel = new UserStatsViewModel();
        viewModel.CreateMappings(expression);

        var mapper = new Mapper(new MapperConfiguration(expression));
        var entity = new StatisticEntity
        {
            Played = 31,
            Won = 15,
            Drawn = 6,
            Lost = 10,
            EloRating = 1542,
        };

        var mapped = mapper.Map<UserStatsViewModel>(entity);

        mapped.Games.Should().Be(31);
        mapped.Wins.Should().Be(15);
        mapped.Draws.Should().Be(6);
        mapped.Losses.Should().Be(10);
        mapped.Rating.Should().Be(1542);
    }

    private sealed class InMemoryStatisticRepository : IRepository<StatisticEntity>
    {
        public List<StatisticEntity> Items { get; } = new ();

        public int SaveChangesCalls { get; private set; }

        public Exception? SaveChangesException { get; set; }

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

            if (this.SaveChangesException != null)
            {
                throw this.SaveChangesException;
            }

            return Task.FromResult(1);
        }

        public void Dispose()
        {
        }
    }
}
