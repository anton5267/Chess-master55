namespace Chess.Web.IntegrationTests;

using Chess.Common.Time;
using Chess.Services.Data.Services;
using Chess.Services.Data.Services.Contracts;
using Chess.Web.Hubs.Sessions;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

public class InMemoryGameSessionStoreTests
{
    [Fact]
    public void MarkDisconnectedAndReattach_ShouldRestorePlayingSession()
    {
        using var store = new InMemoryGameSessionStore(new SystemClock());
        var services = new ServiceCollection()
            .AddTransient<INotificationService, NotificationService>()
            .AddTransient<ICheckService, CheckService>()
            .AddTransient<IDrawService, DrawService>()
            .AddTransient<IUtilityService, UtilityService>()
            .BuildServiceProvider();

        store.TryCreateWaitingPlayer(
            "white-conn",
            "white-user",
            "white_player",
            1200,
            out _,
            out _).Should().BeTrue();

        store.TryJoinRoom(
            "black-conn",
            "black-user",
            "black_player",
            "white-conn",
            1200,
            services,
            out _,
            out _,
            out _).Should().BeTrue();

        var marked = store.TryMarkDisconnectedConnection("white-conn", out var markResult);
        marked.Should().BeTrue();
        markResult.Success.Should().BeTrue();
        markResult.MarkedAsDisconnected.Should().BeTrue();
        markResult.Player.Should().NotBeNull();
        markResult.Player.State.Should().Be(PlayerSessionState.Disconnected);

        var reattached = store.TryReattachDisconnectedPlayer(
            "white-conn-new",
            "white-user",
            out var restoredGame,
            out var restoredPlayer);

        reattached.Should().BeTrue();
        restoredGame.Should().NotBeNull();
        restoredPlayer.Should().NotBeNull();
        restoredPlayer.State.Should().Be(PlayerSessionState.Playing);
        restoredPlayer.ConnectionId.Should().Be("white-conn-new");

        store.TryGetPlayer("white-conn", out _).Should().BeFalse();
        store.TryGetPlayer("white-conn-new", out var activeWhite).Should().BeTrue();
        activeWhite.Should().NotBeNull();
        activeWhite.State.Should().Be(PlayerSessionState.Playing);

        store.TryGetGameByConnection("white-conn-new", out var gameByNewConnection, out _).Should().BeTrue();
        gameByNewConnection.Should().NotBeNull();
    }

    [Fact]
    public void FinalizeDisconnectedConnection_ShouldClearGameAndResetOpponent()
    {
        using var store = new InMemoryGameSessionStore(new SystemClock());
        var services = new ServiceCollection()
            .AddTransient<INotificationService, NotificationService>()
            .AddTransient<ICheckService, CheckService>()
            .AddTransient<IDrawService, DrawService>()
            .AddTransient<IUtilityService, UtilityService>()
            .BuildServiceProvider();

        store.TryCreateWaitingPlayer(
            "white-conn",
            "white-user",
            "white_player",
            1200,
            out _,
            out _).Should().BeTrue();

        store.TryJoinRoom(
            "black-conn",
            "black-user",
            "black_player",
            "white-conn",
            1200,
            services,
            out _,
            out _,
            out _).Should().BeTrue();

        store.TryMarkDisconnectedConnection("white-conn", out var markResult).Should().BeTrue();
        markResult.MarkedAsDisconnected.Should().BeTrue();

        var finalized = store.TryFinalizeDisconnectedConnection("white-conn", out var finalizeResult);
        finalized.Should().BeTrue();
        finalizeResult.Success.Should().BeTrue();
        finalizeResult.FinalizedDisconnectedGame.Should().BeTrue();
        finalizeResult.GameSession.Should().NotBeNull();

        store.TryGetGameByConnection("black-conn", out _, out _).Should().BeFalse();
        store.TryGetPlayer("black-conn", out var blackSession).Should().BeTrue();
        blackSession.Should().NotBeNull();
        blackSession.State.Should().Be(PlayerSessionState.Idle);
        blackSession.GameId.Should().BeNull();
    }

    [Fact]
    public void TryCreateWaitingPlayer_ShouldReplaceStaleWaitingSession_ForSameUser()
    {
        using var store = new InMemoryGameSessionStore(new SystemClock());

        var createdFirst = store.TryCreateWaitingPlayer(
            "conn-old",
            "user-1",
            "player_old",
            1200,
            out var firstSession,
            out var firstError);

        createdFirst.Should().BeTrue(firstError);
        firstSession.Should().NotBeNull();

        var createdSecond = store.TryCreateWaitingPlayer(
            "conn-new",
            "user-1",
            "player_new",
            1210,
            out var secondSession,
            out var secondError);

        createdSecond.Should().BeTrue(secondError);
        secondSession.Should().NotBeNull();
        secondSession.ConnectionId.Should().Be("conn-new");
        secondSession.Name.Should().Be("player_new");

        store.TryGetPlayer("conn-old", out _).Should().BeFalse();
        store.TryGetPlayer("conn-new", out var currentSession).Should().BeTrue();
        currentSession.Should().NotBeNull();
        currentSession.ConnectionId.Should().Be("conn-new");

        var waitingRooms = store.GetWaitingRoomsSnapshot();
        waitingRooms.Should().HaveCount(1);
        waitingRooms.Should().OnlyContain(x => x.ConnectionId == "conn-new");
    }

    [Fact]
    public void TryCreateBotGame_ShouldCreateDirectGame_AndCleanupOnDisconnect()
    {
        using var store = new InMemoryGameSessionStore(new SystemClock());
        var services = new ServiceCollection()
            .AddTransient<INotificationService, NotificationService>()
            .AddTransient<ICheckService, CheckService>()
            .AddTransient<IDrawService, DrawService>()
            .AddTransient<IUtilityService, UtilityService>()
            .BuildServiceProvider();

        var created = store.TryCreateBotGame(
            "human-conn",
            "human-user",
            "human_player",
            1280,
            services,
            out var humanSession,
            out var gameSession,
            out var error);

        created.Should().BeTrue(error);
        humanSession.Should().NotBeNull();
        gameSession.Should().NotBeNull();
        gameSession.IsBotGame.Should().BeTrue();
        gameSession.Player1.IsBot.Should().NotBe(gameSession.Player2.IsBot);
        store.GetWaitingRoomsSnapshot().Should().BeEmpty();

        store.TryMarkDisconnectedConnection("human-conn", out var removalResult).Should().BeTrue();
        removalResult.Success.Should().BeTrue();
        removalResult.FinalizedDisconnectedGame.Should().BeTrue();
        removalResult.MarkedAsDisconnected.Should().BeFalse();
        removalResult.GameSession.Should().NotBeNull();

        store.TryGetGameByConnection("human-conn", out _, out _).Should().BeFalse();
        store.TryGetGameById(gameSession.GameId, out _).Should().BeFalse();
    }
}
