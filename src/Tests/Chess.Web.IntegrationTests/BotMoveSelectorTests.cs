namespace Chess.Web.IntegrationTests;

using System.Linq;

using Chess.Common.Enums;
using Chess.Services.Data.Models;
using Chess.Services.Data.Services;
using Chess.Services.Data.Services.Contracts;
using Chess.Web.Hubs.Bot;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

public class BotMoveSelectorTests
{
    [Fact]
    public void RandomLegalMoveSelector_ShouldAlwaysReturnLegalMove()
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

        var legalMoves = game.GetLegalMoves().ToArray();
        legalMoves.Should().NotBeEmpty();

        var selector = new RandomLegalMoveSelector();
        selector.TrySelectMove(game, out var selectedMove).Should().BeTrue();
        selectedMove.Should().NotBeNull();

        legalMoves.Should().Contain(move =>
            move.Source == selectedMove.Source &&
            move.Target == selectedMove.Target);
    }
}
