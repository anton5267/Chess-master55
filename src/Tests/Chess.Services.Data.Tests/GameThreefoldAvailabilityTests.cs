namespace Chess.Services.Data.Tests;

using System;
using System.Collections.Generic;
using System.Threading.Tasks;

using Chess.Common.EventArgs;
using Chess.Services.Data.Models;
using Chess.Services.Data.Services;
using Chess.Services.Data.Services.Contracts;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

public class GameThreefoldAvailabilityTests
{
    [Fact]
    public async Task MakeMoveAsync_ShouldRaiseThreefoldAvailability_ForOpponentWhenRepetitionDetected()
    {
        var notificationService = new NotificationService();
        var checkService = new CheckService();
        var drawService = new ThreefoldDrawOnlyService();
        var utilityService = new UtilityService();
        var services = new ServiceCollection().BuildServiceProvider();

        var white = new Player("white", "white-conn", "white-user")
        {
            HasToMove = true,
        };

        var black = new Player("black", "black-conn", "black-user")
        {
            HasToMove = false,
        };

        var events = new List<(Player Player, bool IsAvailable)>();
        notificationService.OnAvailableThreefoldDraw += (sender, eventArgs) =>
        {
            if (sender is Player player && eventArgs is ThreefoldDrawEventArgs args)
            {
                events.Add((player, args.IsAvailable));
            }
        };

        var game = new Game(
            white,
            black,
            notificationService,
            checkService,
            drawService,
            utilityService,
            services);

        var moved = await game.MakeMoveAsync("e2", "e4", targetFen: "ignored-by-test", persistHistory: false);

        moved.Should().BeTrue();
        events.Should().HaveCountGreaterOrEqualTo(2);

        events[0].Player.Name.Should().Be("white");
        events[0].IsAvailable.Should().BeFalse();
        events[1].Player.Name.Should().Be("black");
        events[1].IsAvailable.Should().BeTrue();
    }

    private sealed class ThreefoldDrawOnlyService : IDrawService
    {
        public bool IsStalemate(Board board, Player opponent)
        {
            return false;
        }

        public bool IsDraw(Board board)
        {
            return false;
        }

        public bool IsThreefoldRepetionDraw(string fen)
        {
            return true;
        }

        public bool IsFivefoldRepetitionDraw(string fen)
        {
            return false;
        }

        public bool IsFiftyMoveDraw(Move move)
        {
            return false;
        }
    }
}
