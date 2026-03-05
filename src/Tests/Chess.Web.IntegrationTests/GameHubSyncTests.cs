namespace Chess.Web.IntegrationTests;

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

using Chess.Common.Enums;
using Chess.Data;
using Chess.Data.Models;
using Chess.Services.Data.Models;
using Chess.Services.Data.Services.Contracts;
using Chess.Web.Hubs.Sessions;
using FluentAssertions;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

public class GameHubSyncTests : IClassFixture<ChessWebApplicationFactory>
{
    private const string StartFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";
    private const string WhiteMoveFen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR";
    private const string BlackMoveFen = "rnbqkbnr/pppp1ppp/8/4p3/8/8/PPPPPPPP/RNBQKBNR";
    private const string BlackD7D5Fen = "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR";
    private const string WhitePawnTakesD5Fen = "rnbqkbnr/ppp1pppp/8/3P4/8/8/PPPP1PPP/RNBQKBNR";
    private readonly ChessWebApplicationFactory factory;

    public GameHubSyncTests(ChessWebApplicationFactory factory)
    {
        this.factory = factory;
    }

    [Fact]
    public async Task MoveSelected_ShouldSyncFenForBothPlayers()
    {
        await this.SeedUserAsync("white-user", "white@example.com");
        await this.SeedUserAsync("black-user", "black@example.com");

        await using var whiteConnection = this.CreateHubConnection("white-user", "white@example.com");
        await using var blackConnection = this.CreateHubConnection("black-user", "black@example.com");

        var whiteStartTcs = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
        var blackStartTcs = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
        var whiteSyncQueue = new Queue<SyncMessage>();
        var blackSyncQueue = new Queue<SyncMessage>();
        using var whiteSyncSignal = new SemaphoreSlim(0, int.MaxValue);
        using var blackSyncSignal = new SemaphoreSlim(0, int.MaxValue);

        whiteConnection.On<JsonElement>("Start", payload => whiteStartTcs.TrySetResult(payload));
        blackConnection.On<JsonElement>("Start", payload => blackStartTcs.TrySetResult(payload));

        whiteConnection.On<string, string, long, string>("SyncPosition", (fen, movingPlayerName, turnNumber, movingPlayerId) =>
        {
            lock (whiteSyncQueue)
            {
                whiteSyncQueue.Enqueue(new SyncMessage(fen, movingPlayerName, turnNumber, movingPlayerId));
            }

            whiteSyncSignal.Release();
        });

        blackConnection.On<string, string, long, string>("SyncPosition", (fen, movingPlayerName, turnNumber, movingPlayerId) =>
        {
            lock (blackSyncQueue)
            {
                blackSyncQueue.Enqueue(new SyncMessage(fen, movingPlayerName, turnNumber, movingPlayerId));
            }

            blackSyncSignal.Release();
        });

        await whiteConnection.StartAsync();
        await blackConnection.StartAsync();

        var creator = await whiteConnection.InvokeAsync<JsonElement>("CreateRoom", "white_player");
        var roomId = creator.GetProperty("id").GetString();
        roomId.Should().NotBeNullOrWhiteSpace();

        await blackConnection.InvokeAsync<JsonElement>("JoinRoom", "black_player", roomId);

        var whiteStartPayload = await WaitWithTimeout(whiteStartTcs.Task);
        var blackStartPayload = await WaitWithTimeout(blackStartTcs.Task);

        var whiteMovingPlayer = whiteStartPayload.GetProperty("movingPlayerName").GetString();
        var blackMovingPlayer = blackStartPayload.GetProperty("movingPlayerName").GetString();
        var whiteMovingPlayerId = whiteStartPayload.GetProperty("movingPlayerId").GetString();
        var blackMovingPlayerId = blackStartPayload.GetProperty("movingPlayerId").GetString();

        whiteStartPayload.GetProperty("startFen").GetString().Should().Be(StartFen);
        blackStartPayload.GetProperty("startFen").GetString().Should().Be(StartFen);
        whiteMovingPlayer.Should().Be(blackMovingPlayer);
        whiteMovingPlayerId.Should().NotBeNullOrWhiteSpace();
        blackMovingPlayerId.Should().Be(whiteMovingPlayerId);

        var isWhiteToMove = string.Equals(whiteMovingPlayer, "white_player", StringComparison.Ordinal);
        var movingConnection = isWhiteToMove ? whiteConnection : blackConnection;
        var expectedFen = isWhiteToMove ? WhiteMoveFen : BlackMoveFen;
        var expectedNextMovingPlayer = isWhiteToMove ? "black_player" : "white_player";

        if (isWhiteToMove)
        {
            await movingConnection.InvokeAsync("MoveSelected", "e2", "e4", StartFen, expectedFen);
        }
        else
        {
            await movingConnection.InvokeAsync("MoveSelected", "e7", "e5", StartFen, expectedFen);
        }

        await whiteConnection.InvokeAsync("RequestSync");
        await blackConnection.InvokeAsync("RequestSync");

        var whiteSync = await WaitNextSync(whiteSyncQueue, whiteSyncSignal);
        var blackSync = await WaitNextSync(blackSyncQueue, blackSyncSignal);

        whiteSync.Fen.Should().Be(expectedFen);
        blackSync.Fen.Should().Be(expectedFen);
        whiteSync.TurnNumber.Should().Be(2);
        blackSync.TurnNumber.Should().Be(2);
        whiteSync.MovingPlayerName.Should().Be(expectedNextMovingPlayer);
        blackSync.MovingPlayerName.Should().Be(expectedNextMovingPlayer);
        whiteSync.MovingPlayerId.Should().NotBeNullOrWhiteSpace();
        blackSync.MovingPlayerId.Should().Be(whiteSync.MovingPlayerId);
    }

    [Fact]
    public async Task MoveSelected_ConcurrentRequests_ShouldAdvanceOnlySingleTurn()
    {
        await this.SeedUserAsync("white-user-concurrent-1", "white-concurrent-1@example.com");
        await this.SeedUserAsync("black-user-concurrent-1", "black-concurrent-1@example.com");

        await using var whiteConnection = this.CreateHubConnection("white-user-concurrent-1", "white-concurrent-1@example.com");
        await using var blackConnection = this.CreateHubConnection("black-user-concurrent-1", "black-concurrent-1@example.com");

        var whiteStartTcs = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
        var blackStartTcs = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
        var movingSyncQueue = new Queue<SyncMessage>();
        using var movingSyncSignal = new SemaphoreSlim(0, int.MaxValue);

        whiteConnection.On<JsonElement>("Start", payload => whiteStartTcs.TrySetResult(payload));
        blackConnection.On<JsonElement>("Start", payload => blackStartTcs.TrySetResult(payload));

        await whiteConnection.StartAsync();
        await blackConnection.StartAsync();

        var creator = await whiteConnection.InvokeAsync<JsonElement>("CreateRoom", "white_concurrent_1");
        var roomId = creator.GetProperty("id").GetString();
        roomId.Should().NotBeNullOrWhiteSpace();

        await blackConnection.InvokeAsync<JsonElement>("JoinRoom", "black_concurrent_1", roomId);

        var whiteStartPayload = await WaitWithTimeout(whiteStartTcs.Task);
        var blackStartPayload = await WaitWithTimeout(blackStartTcs.Task);
        var movingPlayerName = whiteStartPayload.GetProperty("movingPlayerName").GetString();

        var movingConnection = string.Equals(movingPlayerName, "white_concurrent_1", StringComparison.Ordinal)
            ? whiteConnection
            : blackConnection;

        movingConnection.On<string, string, long, string>("SyncPosition", (fen, currentMovingPlayerName, turnNumber, movingPlayerId) =>
        {
            lock (movingSyncQueue)
            {
                movingSyncQueue.Enqueue(new SyncMessage(fen, currentMovingPlayerName, turnNumber, movingPlayerId));
            }

            movingSyncSignal.Release();
        });

        await movingConnection.InvokeAsync("RequestSync");
        var currentSync = await WaitNextSync(movingSyncQueue, movingSyncSignal, timeoutMs: 15000);
        currentSync.TurnNumber.Should().Be(1);
        ClearQueueAndSignal(movingSyncQueue, movingSyncSignal);

        var legalMoves = await movingConnection.InvokeAsync<JsonElement[]>("GetLegalMoves");
        legalMoves.Should().NotBeNull();
        legalMoves.Length.Should().BeGreaterThan(1);

        var firstMove = legalMoves[0];
        var secondMove = legalMoves[1];
        var firstSource = firstMove.GetProperty("source").GetString();
        var firstTarget = firstMove.GetProperty("target").GetString();
        var secondSource = secondMove.GetProperty("source").GetString();
        var secondTarget = secondMove.GetProperty("target").GetString();
        firstSource.Should().NotBeNullOrWhiteSpace();
        firstTarget.Should().NotBeNullOrWhiteSpace();
        secondSource.Should().NotBeNullOrWhiteSpace();
        secondTarget.Should().NotBeNullOrWhiteSpace();

        await Task.WhenAll(
            movingConnection.InvokeAsync("MoveSelected", firstSource!, firstTarget!, currentSync.Fen, null),
            movingConnection.InvokeAsync("MoveSelected", secondSource!, secondTarget!, currentSync.Fen, null));

        await movingConnection.InvokeAsync("RequestSync");
        var finalSync = await WaitNextSync(movingSyncQueue, movingSyncSignal, timeoutMs: 15000);
        for (var i = 0; i < 5; i++)
        {
            if (movingSyncSignal.CurrentCount <= 0)
            {
                break;
            }

            finalSync = await WaitNextSync(movingSyncQueue, movingSyncSignal, timeoutMs: 2000);
        }

        finalSync.TurnNumber.Should().Be(2);

        var legalMovesAfter = await movingConnection.InvokeAsync<JsonElement[]>("GetLegalMoves");
        legalMovesAfter.Should().NotBeNull();
        legalMovesAfter.Should().BeEmpty();
    }

    [Fact]
    public async Task GetLegalMoves_ShouldReturnCaptureAndNonCaptureOptions_WhenCaptureIsAvailable()
    {
        await this.SeedUserAsync("white-user-2", "white2@example.com");
        await this.SeedUserAsync("black-user-2", "black2@example.com");

        await using var whiteConnection = this.CreateHubConnection("white-user-2", "white2@example.com");
        await using var blackConnection = this.CreateHubConnection("black-user-2", "black2@example.com");

        var whiteStartTcs = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
        var blackStartTcs = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
        whiteConnection.On<JsonElement>("Start", payload => whiteStartTcs.TrySetResult(payload));
        blackConnection.On<JsonElement>("Start", payload => blackStartTcs.TrySetResult(payload));

        await whiteConnection.StartAsync();
        await blackConnection.StartAsync();

        var creator = await whiteConnection.InvokeAsync<JsonElement>("CreateRoom", "white_capture");
        var roomId = creator.GetProperty("id").GetString();
        roomId.Should().NotBeNullOrWhiteSpace();

        await blackConnection.InvokeAsync<JsonElement>("JoinRoom", "black_capture", roomId);
        await WaitWithTimeout(whiteStartTcs.Task);
        await WaitWithTimeout(blackStartTcs.Task);

        await whiteConnection.InvokeAsync("MoveSelected", "e2", "e4", StartFen, WhiteMoveFen);
        await blackConnection.InvokeAsync("MoveSelected", "d7", "d5", WhiteMoveFen, BlackD7D5Fen);

        var legalMoves = await whiteConnection.InvokeAsync<JsonElement[]>("GetLegalMoves");
        legalMoves.Should().NotBeNull();

        legalMoves.Should().Contain(move =>
            move.GetProperty("source").GetString() == "e4" &&
            move.GetProperty("target").GetString() == "d5" &&
            move.GetProperty("isCapture").GetBoolean());

        legalMoves.Should().Contain(move =>
            move.GetProperty("source").GetString() == "g1" &&
            move.GetProperty("target").GetString() == "f3" &&
            !move.GetProperty("isCapture").GetBoolean());
    }

    [Fact]
    public async Task ReconnectWithinGracePeriod_ShouldRestoreGameAndSyncLatestFen()
    {
        await this.SeedUserAsync("white-user-3", "white3@example.com");
        await this.SeedUserAsync("black-user-3", "black3@example.com");

        var whiteConnection = this.CreateHubConnection("white-user-3", "white3@example.com");
        await using var blackConnection = this.CreateHubConnection("black-user-3", "black3@example.com");
        await using var whiteReconnected = this.CreateHubConnection("white-user-3", "white3@example.com");

        try
        {
            var whiteStartTcs = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
            var blackStartTcs = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
            var blackGameOverTcs = new TaskCompletionSource<int>(TaskCreationOptions.RunContinuationsAsynchronously);

            whiteConnection.On<JsonElement>("Start", payload => whiteStartTcs.TrySetResult(payload));
            blackConnection.On<JsonElement>("Start", payload => blackStartTcs.TrySetResult(payload));
            blackConnection.On<JsonElement, int>("GameOver", (_, gameOver) => blackGameOverTcs.TrySetResult(gameOver));

            await whiteConnection.StartAsync();
            await blackConnection.StartAsync();

            var creator = await whiteConnection.InvokeAsync<JsonElement>("CreateRoom", "white_restore");
            var roomId = creator.GetProperty("id").GetString();
            roomId.Should().NotBeNullOrWhiteSpace();

            await blackConnection.InvokeAsync<JsonElement>("JoinRoom", "black_restore", roomId);
            await WaitWithTimeout(whiteStartTcs.Task);
            await WaitWithTimeout(blackStartTcs.Task);

            await whiteConnection.InvokeAsync("MoveSelected", "e2", "e4", StartFen, WhiteMoveFen);
            await blackConnection.InvokeAsync("MoveSelected", "d7", "d5", WhiteMoveFen, BlackD7D5Fen);

            await whiteConnection.StopAsync();
            await Task.Delay(350);

            var reconnectStartTcs = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
            var reconnectSyncTcs = new TaskCompletionSource<SyncMessage>(TaskCreationOptions.RunContinuationsAsynchronously);
            whiteReconnected.On<JsonElement>("Start", payload => reconnectStartTcs.TrySetResult(payload));
            whiteReconnected.On<string, string, long, string>("SyncPosition", (fen, movingPlayerName, turnNumber, movingPlayerId) =>
            {
                reconnectSyncTcs.TrySetResult(new SyncMessage(fen, movingPlayerName, turnNumber, movingPlayerId));
            });

            await whiteReconnected.StartAsync();

            var reconnectStart = await WaitWithTimeout(reconnectStartTcs.Task);
            reconnectStart.GetProperty("startFen").GetString().Should().Be(BlackD7D5Fen);
            reconnectStart.GetProperty("movingPlayerName").GetString().Should().Be("white_restore");
            reconnectStart.GetProperty("selfPlayerId").GetString().Should().NotBeNullOrWhiteSpace();
            reconnectStart.GetProperty("selfPlayerName").GetString().Should().Be("white_restore");

            var reconnectSync = await WaitWithTimeout(reconnectSyncTcs.Task);
            reconnectSync.Fen.Should().Be(BlackD7D5Fen);
            reconnectSync.MovingPlayerName.Should().Be("white_restore");
            reconnectSync.TurnNumber.Should().Be(3);
            reconnectSync.MovingPlayerId.Should().NotBeNullOrWhiteSpace();

            var unexpectedGameOver = await Task.WhenAny(blackGameOverTcs.Task, Task.Delay(1500));
            unexpectedGameOver.Should().NotBe(blackGameOverTcs.Task);
        }
        finally
        {
            await whiteConnection.DisposeAsync();
        }
    }

    [Fact]
    public async Task DisconnectWithoutReconnect_ShouldEndGameAfterGracePeriod()
    {
        await this.SeedUserAsync("white-user-4", "white4@example.com");
        await this.SeedUserAsync("black-user-4", "black4@example.com");

        var whiteConnection = this.CreateHubConnection("white-user-4", "white4@example.com");
        await using var blackConnection = this.CreateHubConnection("black-user-4", "black4@example.com");

        try
        {
            var whiteStartTcs = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
            var blackStartTcs = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
            var blackGameOverTcs = new TaskCompletionSource<int>(TaskCreationOptions.RunContinuationsAsynchronously);

            whiteConnection.On<JsonElement>("Start", payload => whiteStartTcs.TrySetResult(payload));
            blackConnection.On<JsonElement>("Start", payload => blackStartTcs.TrySetResult(payload));
            blackConnection.On<JsonElement, int>("GameOver", (_, gameOver) => blackGameOverTcs.TrySetResult(gameOver));

            await whiteConnection.StartAsync();
            await blackConnection.StartAsync();

            var creator = await whiteConnection.InvokeAsync<JsonElement>("CreateRoom", "white_disconnect");
            var roomId = creator.GetProperty("id").GetString();
            roomId.Should().NotBeNullOrWhiteSpace();

            await blackConnection.InvokeAsync<JsonElement>("JoinRoom", "black_disconnect", roomId);
            await WaitWithTimeout(whiteStartTcs.Task);
            await WaitWithTimeout(blackStartTcs.Task);

            await whiteConnection.StopAsync();

            var gameOver = await WaitWithTimeout(blackGameOverTcs.Task, timeoutMs: 15000);
            gameOver.Should().Be(7);
        }
        finally
        {
            await whiteConnection.DisposeAsync();
        }
    }

    [Fact]
    public async Task Reconnect_ShouldPreservePointsAndTakenPiecesInStartPayload()
    {
        await this.SeedUserAsync("white-user-5", "white5@example.com");
        await this.SeedUserAsync("black-user-5", "black5@example.com");

        var whiteConnection = this.CreateHubConnection("white-user-5", "white5@example.com");
        await using var blackConnection = this.CreateHubConnection("black-user-5", "black5@example.com");
        await using var whiteReconnected = this.CreateHubConnection("white-user-5", "white5@example.com");

        try
        {
            var whiteStartTcs = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
            var blackStartTcs = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
            whiteConnection.On<JsonElement>("Start", payload => whiteStartTcs.TrySetResult(payload));
            blackConnection.On<JsonElement>("Start", payload => blackStartTcs.TrySetResult(payload));

            await whiteConnection.StartAsync();
            await blackConnection.StartAsync();

            var creator = await whiteConnection.InvokeAsync<JsonElement>("CreateRoom", "white_stats_restore");
            var roomId = creator.GetProperty("id").GetString();
            roomId.Should().NotBeNullOrWhiteSpace();

            await blackConnection.InvokeAsync<JsonElement>("JoinRoom", "black_stats_restore", roomId);
            await WaitWithTimeout(whiteStartTcs.Task);
            await WaitWithTimeout(blackStartTcs.Task);

            await whiteConnection.InvokeAsync("MoveSelected", "e2", "e4", StartFen, WhiteMoveFen);
            await blackConnection.InvokeAsync("MoveSelected", "d7", "d5", WhiteMoveFen, BlackD7D5Fen);
            await whiteConnection.InvokeAsync("MoveSelected", "e4", "d5", BlackD7D5Fen, WhitePawnTakesD5Fen);

            await whiteConnection.StopAsync();
            await Task.Delay(350);

            var reconnectStartTcs = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
            whiteReconnected.On<JsonElement>("Start", payload => reconnectStartTcs.TrySetResult(payload));
            await whiteReconnected.StartAsync();

            var reconnectStart = await WaitWithTimeout(reconnectStartTcs.Task);
            reconnectStart.GetProperty("startFen").GetString().Should().Be(WhitePawnTakesD5Fen);

            var game = reconnectStart.GetProperty("game");
            var playerOne = game.GetProperty("player1");
            playerOne.GetProperty("name").GetString().Should().Be("white_stats_restore");
            playerOne.GetProperty("points").GetInt32().Should().Be(1);
            var takenFigures = playerOne.GetProperty("takenFigures");
            takenFigures.GetProperty("Pawn").GetInt32().Should().Be(1);
        }
        finally
        {
            await whiteConnection.DisposeAsync();
        }
    }

    [Fact]
    public async Task BotDisconnectWithinGracePeriod_ShouldReattachAndRestoreGame()
    {
        await this.SeedUserAsync("bot-user-reconnect-1", "bot-reconnect-1@example.com");

        var initialConnection = this.CreateHubConnection("bot-user-reconnect-1", "bot-reconnect-1@example.com");
        await using var reconnectedConnection = this.CreateHubConnection("bot-user-reconnect-1", "bot-reconnect-1@example.com");

        try
        {
            var initialStartTcs = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
            initialConnection.On<JsonElement>("Start", payload => initialStartTcs.TrySetResult(payload));

            await initialConnection.StartAsync();
            await initialConnection.InvokeAsync<JsonElement>("StartVsBot", "bot_reconnect_player");
            var initialStart = await WaitWithTimeout(initialStartTcs.Task);
            var gameId = initialStart.GetProperty("game").GetProperty("id").GetString();
            gameId.Should().NotBeNullOrWhiteSpace();

            await initialConnection.StopAsync();
            await Task.Delay(350);

            var reconnectStartTcs = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
            var reconnectSyncTcs = new TaskCompletionSource<SyncMessage>(TaskCreationOptions.RunContinuationsAsynchronously);
            var reconnectGameOverTcs = new TaskCompletionSource<int>(TaskCreationOptions.RunContinuationsAsynchronously);

            reconnectedConnection.On<JsonElement>("Start", payload => reconnectStartTcs.TrySetResult(payload));
            reconnectedConnection.On<string, string, long, string>("SyncPosition", (fen, movingPlayerName, turnNumber, movingPlayerId) =>
            {
                reconnectSyncTcs.TrySetResult(new SyncMessage(fen, movingPlayerName, turnNumber, movingPlayerId));
            });
            reconnectedConnection.On<JsonElement, int>("GameOver", (_, gameOver) => reconnectGameOverTcs.TrySetResult(gameOver));

            await reconnectedConnection.StartAsync();

            var reconnectStart = await WaitWithTimeout(reconnectStartTcs.Task);
            reconnectStart.GetProperty("isBotGame").GetBoolean().Should().BeTrue();
            reconnectStart.GetProperty("game").GetProperty("id").GetString().Should().Be(gameId);

            var reconnectSync = await WaitWithTimeout(reconnectSyncTcs.Task);
            reconnectSync.Fen.Should().NotBeNullOrWhiteSpace();

            await reconnectedConnection.InvokeAsync("RequestSync");
            var unexpectedGameOver = await Task.WhenAny(reconnectGameOverTcs.Task, Task.Delay(1500));
            unexpectedGameOver.Should().NotBe(reconnectGameOverTcs.Task);
        }
        finally
        {
            await initialConnection.DisposeAsync();
        }
    }

    [Fact]
    public async Task CreateRoom_AfterFinishedPvpGame_ShouldSucceedWithoutReconnect()
    {
        await this.SeedUserAsync("white-user-replay-1", "white-replay-1@example.com");
        await this.SeedUserAsync("black-user-replay-1", "black-replay-1@example.com");

        await using var whiteConnection = this.CreateHubConnection("white-user-replay-1", "white-replay-1@example.com");
        await using var blackConnection = this.CreateHubConnection("black-user-replay-1", "black-replay-1@example.com");

        var whiteStartTcs = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
        var blackStartTcs = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
        whiteConnection.On<JsonElement>("Start", payload => whiteStartTcs.TrySetResult(payload));
        blackConnection.On<JsonElement>("Start", payload => blackStartTcs.TrySetResult(payload));

        await whiteConnection.StartAsync();
        await blackConnection.StartAsync();

        var creator = await whiteConnection.InvokeAsync<JsonElement>("CreateRoom", "white_replay_room_1");
        var roomId = creator.GetProperty("id").GetString();
        roomId.Should().NotBeNullOrWhiteSpace();

        await blackConnection.InvokeAsync<JsonElement>("JoinRoom", "black_replay_room_1", roomId);
        await WaitWithTimeout(whiteStartTcs.Task);
        await WaitWithTimeout(blackStartTcs.Task);

        await whiteConnection.InvokeAsync("Resign");

        var secondCreator = await whiteConnection.InvokeAsync<JsonElement>("CreateRoom", "white_replay_room_2");
        var secondRoomId = secondCreator.GetProperty("id").GetString();
        secondRoomId.Should().NotBeNullOrWhiteSpace();

        var secondJoin = await blackConnection.InvokeAsync<JsonElement>("JoinRoom", "black_replay_room_2", secondRoomId);
        secondJoin.GetProperty("id").GetString().Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task StartVsBot_ShouldStartImmediately_AndReturnBotMetadata()
    {
        await this.SeedUserAsync("bot-user-1", "bot1@example.com");
        await using var connection = this.CreateHubConnection("bot-user-1", "bot1@example.com");

        var startTcs = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
        connection.On<JsonElement>("Start", payload => startTcs.TrySetResult(payload));

        await connection.StartAsync();

        var player = await connection.InvokeAsync<JsonElement>("StartVsBot", "human_bot_1");
        var startPayload = await WaitWithTimeout(startTcs.Task);

        player.GetProperty("id").GetString().Should().NotBeNullOrWhiteSpace();
        startPayload.GetProperty("isBotGame").GetBoolean().Should().BeTrue();
        startPayload.GetProperty("gameMode").GetString().Should().Be("bot");
        startPayload.GetProperty("botPlayerId").GetString().Should().NotBeNullOrWhiteSpace();
        startPayload.GetProperty("botPlayerName").GetString().Should().Be("ChessBot");
        startPayload.GetProperty("startFen").GetString().Should().Be(StartFen);
    }

    [Fact]
    public async Task StartVsBot_WhenInvokedTwiceOnSameConnection_ShouldReuseActiveBotGame()
    {
        await this.SeedUserAsync("bot-user-idempotent-1", "bot-idempotent-1@example.com");
        await using var connection = this.CreateHubConnection("bot-user-idempotent-1", "bot-idempotent-1@example.com");

        var startQueue = new Queue<JsonElement>();
        using var startSignal = new SemaphoreSlim(0, int.MaxValue);
        connection.On<JsonElement>("Start", payload =>
        {
            lock (startQueue)
            {
                startQueue.Enqueue(payload);
            }

            startSignal.Release();
        });

        await connection.StartAsync();

        var firstPlayer = await connection.InvokeAsync<JsonElement>("StartVsBot", "human_bot_idempotent");
        var firstStart = await WaitNextStart(startQueue, startSignal, timeoutMs: 15000);
        var firstGameId = firstStart.GetProperty("game").GetProperty("id").GetString();
        firstGameId.Should().NotBeNullOrWhiteSpace();

        var secondPlayer = await connection.InvokeAsync<JsonElement>("StartVsBot", "human_bot_idempotent");
        var secondStart = await WaitNextStart(startQueue, startSignal, timeoutMs: 15000);
        var secondGameId = secondStart.GetProperty("game").GetProperty("id").GetString();

        firstPlayer.GetProperty("id").GetString().Should().Be(secondPlayer.GetProperty("id").GetString());
        secondGameId.Should().Be(firstGameId);
        secondStart.GetProperty("isBotGame").GetBoolean().Should().BeTrue();
    }

    [Fact]
    public async Task StartVsBot_WhenInvokedConcurrently_ShouldReuseSingleActiveGame()
    {
        await this.SeedUserAsync("bot-user-idempotent-2", "bot-idempotent-2@example.com");
        await using var connection = this.CreateHubConnection("bot-user-idempotent-2", "bot-idempotent-2@example.com");

        var startQueue = new Queue<JsonElement>();
        using var startSignal = new SemaphoreSlim(0, int.MaxValue);
        connection.On<JsonElement>("Start", payload =>
        {
            lock (startQueue)
            {
                startQueue.Enqueue(payload);
            }

            startSignal.Release();
        });

        await connection.StartAsync();

        var firstInvoke = connection.InvokeAsync<JsonElement>("StartVsBot", "humanbotconcurrent");
        var secondInvoke = connection.InvokeAsync<JsonElement>("StartVsBot", "humanbotconcurrent");

        var players = await Task.WhenAll(firstInvoke, secondInvoke);
        players[0].GetProperty("id").GetString().Should().Be(players[1].GetProperty("id").GetString());

        var firstStart = await WaitNextStart(startQueue, startSignal, timeoutMs: 15000);
        var firstGameId = firstStart.GetProperty("game").GetProperty("id").GetString();
        firstGameId.Should().NotBeNullOrWhiteSpace();

        await Task.Delay(150);
        var allStartGameIds = new List<string> { firstGameId! };
        while (startSignal.CurrentCount > 0)
        {
            var nextStart = await WaitNextStart(startQueue, startSignal, timeoutMs: 2000);
            allStartGameIds.Add(nextStart.GetProperty("game").GetProperty("id").GetString()!);
        }

        allStartGameIds.Should().OnlyContain(x => x == firstGameId);
    }

    [Fact]
    public async Task StartVsBot_WhenBotStarts_ShouldMakeFirstMove()
    {
        var botStartedAtLeastOnce = false;

        for (var attempt = 0; attempt < 12; attempt++)
        {
            var userId = $"bot-color-user-{attempt}";
            var userEmail = $"bot-color-{attempt}@example.com";
            await this.SeedUserAsync(userId, userEmail);

            await using var connection = this.CreateHubConnection(userId, userEmail);
            var startTcs = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
            var syncTcs = new TaskCompletionSource<SyncMessage>(TaskCreationOptions.RunContinuationsAsynchronously);

            connection.On<JsonElement>("Start", payload => startTcs.TrySetResult(payload));
            connection.On<string, string, long, string>("SyncPosition", (fen, movingPlayerName, turnNumber, movingPlayerId) =>
            {
                syncTcs.TrySetResult(new SyncMessage(fen, movingPlayerName, turnNumber, movingPlayerId));
            });

            await connection.StartAsync();
            await connection.InvokeAsync<JsonElement>("StartVsBot", $"human_bot_color_{attempt}");

            var startPayload = await WaitWithTimeout(startTcs.Task);
            var movingPlayerId = startPayload.GetProperty("movingPlayerId").GetString();
            var botPlayerId = startPayload.GetProperty("botPlayerId").GetString();

            if (!string.Equals(movingPlayerId, botPlayerId, StringComparison.Ordinal))
            {
                continue;
            }

            var sync = await WaitWithTimeout(syncTcs.Task, timeoutMs: 15000);
            sync.TurnNumber.Should().BeGreaterOrEqualTo(2);
            sync.Fen.Should().NotBe(StartFen);
            botStartedAtLeastOnce = true;
            break;
        }

        botStartedAtLeastOnce.Should().BeTrue("bot should start first in at least one randomized game");
    }

    [Fact]
    public async Task StartVsBot_ShouldEventuallyGiveHumanTurnWithLegalMoves()
    {
        await this.SeedUserAsync("bot-user-human-turn-1", "bot-human-turn-1@example.com");
        await using var connection = this.CreateHubConnection("bot-user-human-turn-1", "bot-human-turn-1@example.com");

        var startTcs = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
        var syncQueue = new Queue<SyncMessage>();
        using var syncSignal = new SemaphoreSlim(0, int.MaxValue);

        connection.On<JsonElement>("Start", payload => startTcs.TrySetResult(payload));
        connection.On<string, string, long, string>("SyncPosition", (fen, movingPlayerName, turnNumber, movingPlayerId) =>
        {
            lock (syncQueue)
            {
                syncQueue.Enqueue(new SyncMessage(fen, movingPlayerName, turnNumber, movingPlayerId));
            }

            syncSignal.Release();
        });

        await connection.StartAsync();
        var humanPlayer = await connection.InvokeAsync<JsonElement>("StartVsBot", "human_turn_probe");
        var humanPlayerId = humanPlayer.GetProperty("id").GetString();
        humanPlayerId.Should().NotBeNullOrWhiteSpace();
        await WaitWithTimeout(startTcs.Task);

        await connection.InvokeAsync("RequestSync");
        var latest = await WaitNextSync(syncQueue, syncSignal, timeoutMs: 15000);
        for (var i = 0; i < 6 && !string.Equals(latest.MovingPlayerId, humanPlayerId, StringComparison.Ordinal); i++)
        {
            latest = await WaitNextSync(syncQueue, syncSignal, timeoutMs: 15000);
        }

        latest.MovingPlayerId.Should().Be(humanPlayerId);

        var legalMoves = await connection.InvokeAsync<JsonElement[]>("GetLegalMoves");
        legalMoves.Should().NotBeNull();
        legalMoves.Should().NotBeEmpty();
    }

    [Fact]
    public async Task AfterHumanMove_InBotGame_ShouldReceiveBotReplyAndTurnBack()
    {
        await this.SeedUserAsync("bot-user-2", "bot2@example.com");
        await using var connection = this.CreateHubConnection("bot-user-2", "bot2@example.com");

        var startTcs = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
        var syncQueue = new Queue<SyncMessage>();
        using var syncSignal = new SemaphoreSlim(0, int.MaxValue);

        connection.On<JsonElement>("Start", payload => startTcs.TrySetResult(payload));
        connection.On<string, string, long, string>("SyncPosition", (fen, movingPlayerName, turnNumber, movingPlayerId) =>
        {
            lock (syncQueue)
            {
                syncQueue.Enqueue(new SyncMessage(fen, movingPlayerName, turnNumber, movingPlayerId));
            }

            syncSignal.Release();
        });

        await connection.StartAsync();
        var player = await connection.InvokeAsync<JsonElement>("StartVsBot", "human_bot_2");
        var playerId = player.GetProperty("id").GetString();
        var startPayload = await WaitWithTimeout(startTcs.Task);

        await connection.InvokeAsync("RequestSync");
        var currentSync = await WaitNextSync(syncQueue, syncSignal);
        var currentTurn = currentSync.TurnNumber;
        var currentMovingPlayerId = currentSync.MovingPlayerId;

        if (!string.Equals(currentMovingPlayerId, playerId, StringComparison.Ordinal))
        {
            // Bot started first, wait for the bot move completion.
            currentSync = await WaitNextSync(syncQueue, syncSignal, timeoutMs: 15000);
            currentTurn = currentSync.TurnNumber;
            currentMovingPlayerId = currentSync.MovingPlayerId;
        }

        currentMovingPlayerId.Should().Be(playerId);

        var legalMoves = await connection.InvokeAsync<JsonElement[]>("GetLegalMoves");
        legalMoves.Should().NotBeNull();
        legalMoves.Should().NotBeEmpty();

        var source = legalMoves[0].GetProperty("source").GetString();
        var target = legalMoves[0].GetProperty("target").GetString();
        source.Should().NotBeNullOrWhiteSpace();
        target.Should().NotBeNullOrWhiteSpace();

        await connection.InvokeAsync("MoveSelected", source!, target!, currentSync.Fen, null);

        var expectedTurnAfterBotReply = currentTurn + 2;
        var latest = currentSync;
        for (var i = 0; i < 5; i++)
        {
            latest = await WaitNextSync(syncQueue, syncSignal, timeoutMs: 15000);
            if (latest.TurnNumber >= expectedTurnAfterBotReply)
            {
                break;
            }
        }

        latest.TurnNumber.Should().BeGreaterOrEqualTo(expectedTurnAfterBotReply);
        latest.MovingPlayerId.Should().Be(playerId);
    }

    [Fact]
    public async Task BotGame_MoveSelected_WhenNotYourTurn_ShouldSnapbackAndKeepTurn()
    {
        await this.SeedUserAsync("bot-user-not-your-turn-1", "bot-not-your-turn-1@example.com");
        await using var connection = this.CreateHubConnection("bot-user-not-your-turn-1", "bot-not-your-turn-1@example.com");

        var startTcs = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
        var snapbackTcs = new TaskCompletionSource<string>(TaskCreationOptions.RunContinuationsAsynchronously);
        var syncQueue = new Queue<SyncMessage>();
        var boardMoveCount = 0;
        using var syncSignal = new SemaphoreSlim(0, int.MaxValue);

        connection.On<JsonElement>("Start", payload => startTcs.TrySetResult(payload));
        connection.On<string>("BoardSnapback", fen => snapbackTcs.TrySetResult(fen));
        connection.On<string, string>("BoardMove", (_, _) => Interlocked.Increment(ref boardMoveCount));
        connection.On<string, string, long, string>("SyncPosition", (fen, movingPlayerName, turnNumber, movingPlayerId) =>
        {
            lock (syncQueue)
            {
                syncQueue.Enqueue(new SyncMessage(fen, movingPlayerName, turnNumber, movingPlayerId));
            }

            syncSignal.Release();
        });

        await connection.StartAsync();
        await connection.InvokeAsync<JsonElement>("StartVsBot", "human_notturn1");
        var startPayload = await WaitWithTimeout(startTcs.Task);
        var gameId = startPayload.GetProperty("game").GetProperty("id").GetString();
        gameId.Should().NotBeNullOrWhiteSpace();

        var botPlayerId = startPayload.GetProperty("botPlayerId").GetString();
        botPlayerId.Should().NotBeNullOrWhiteSpace();

        this.ConfigureBotPendingTurnPosition(gameId!);
        var snapshot = this.GetGameSnapshot(gameId!);

        ClearQueueAndSignal(syncQueue, syncSignal);
        Interlocked.Exchange(ref boardMoveCount, 0);

        await connection.InvokeAsync("MoveSelected", "a2", "a3", snapshot.Fen, null);

        var snapbackFen = await WaitWithTimeout(snapbackTcs.Task, timeoutMs: 5000);
        snapbackFen.Should().Be(snapshot.Fen);

        var sync = await WaitNextSync(syncQueue, syncSignal, timeoutMs: 5000);
        sync.Fen.Should().Be(snapshot.Fen);
        sync.TurnNumber.Should().Be(snapshot.TurnNumber);
        sync.MovingPlayerId.Should().Be(botPlayerId);
        boardMoveCount.Should().Be(0);
    }

    [Fact]
    public async Task BotGame_ShouldNotPersistGamesMovesOrStats()
    {
        const string userId = "bot-user-3";
        const string userEmail = "bot3@example.com";
        await this.SeedUserAsync(userId, userEmail);

        await using var scopeBefore = this.factory.Services.CreateAsyncScope();
        var dbBefore = scopeBefore.ServiceProvider.GetRequiredService<ChessDbContext>();
        if (!await dbBefore.Stats.AnyAsync(x => x.UserId == userId))
        {
            dbBefore.Stats.Add(new StatisticEntity
            {
                UserId = userId,
                Played = 10,
                Won = 4,
                Drawn = 3,
                Lost = 3,
                EloRating = 1210,
                CreatedOn = DateTime.UtcNow,
            });
            await dbBefore.SaveChangesAsync();
        }

        var beforeGames = await dbBefore.Games.CountAsync();
        var beforeMoves = await dbBefore.Moves.CountAsync();
        var beforeStats = await dbBefore.Stats.AsNoTracking().SingleAsync(x => x.UserId == userId);

        await using var connection = this.CreateHubConnection(userId, userEmail);
        var startTcs = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
        var syncQueue = new Queue<SyncMessage>();
        using var syncSignal = new SemaphoreSlim(0, int.MaxValue);

        connection.On<JsonElement>("Start", payload => startTcs.TrySetResult(payload));
        connection.On<string, string, long, string>("SyncPosition", (fen, movingPlayerName, turnNumber, movingPlayerId) =>
        {
            lock (syncQueue)
            {
                syncQueue.Enqueue(new SyncMessage(fen, movingPlayerName, turnNumber, movingPlayerId));
            }

            syncSignal.Release();
        });

        await connection.StartAsync();
        var player = await connection.InvokeAsync<JsonElement>("StartVsBot", "human_bot_3");
        var playerId = player.GetProperty("id").GetString();
        await WaitWithTimeout(startTcs.Task);

        await connection.InvokeAsync("RequestSync");
        var currentSync = await WaitNextSync(syncQueue, syncSignal);

        if (!string.Equals(currentSync.MovingPlayerId, playerId, StringComparison.Ordinal))
        {
            currentSync = await WaitNextSync(syncQueue, syncSignal, timeoutMs: 15000);
        }

        var legalMoves = await connection.InvokeAsync<JsonElement[]>("GetLegalMoves");
        if (legalMoves.Length > 0)
        {
            var source = legalMoves[0].GetProperty("source").GetString();
            var target = legalMoves[0].GetProperty("target").GetString();
            await connection.InvokeAsync("MoveSelected", source!, target!, currentSync.Fen, null);
            await WaitNextSync(syncQueue, syncSignal, timeoutMs: 15000);
        }

        await connection.InvokeAsync("Resign");
        await Task.Delay(600);

        await using var scopeAfter = this.factory.Services.CreateAsyncScope();
        var dbAfter = scopeAfter.ServiceProvider.GetRequiredService<ChessDbContext>();
        var afterGames = await dbAfter.Games.CountAsync();
        var afterMoves = await dbAfter.Moves.CountAsync();
        var afterStats = await dbAfter.Stats.AsNoTracking().SingleAsync(x => x.UserId == userId);

        afterGames.Should().Be(beforeGames);
        afterMoves.Should().Be(beforeMoves);
        afterStats.Played.Should().Be(beforeStats.Played);
        afterStats.Won.Should().Be(beforeStats.Won);
        afterStats.Drawn.Should().Be(beforeStats.Drawn);
        afterStats.Lost.Should().Be(beforeStats.Lost);
        afterStats.EloRating.Should().Be(beforeStats.EloRating);
    }

    [Fact]
    public async Task BotGame_WhenNoLegalMoves_ShouldEmitGameOver_NotStayInBotTurn()
    {
        await this.SeedUserAsync("bot-user-terminal-1", "bot-terminal-1@example.com");
        await using var connection = this.CreateHubConnection("bot-user-terminal-1", "bot-terminal-1@example.com");

        var startTcs = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
        var gameOverTcs = new TaskCompletionSource<(JsonElement Player, int GameOver)>(TaskCreationOptions.RunContinuationsAsynchronously);
        var statusEventCountAfterTrigger = 0;
        var recoveryTriggered = false;

        connection.On<JsonElement>("Start", payload => startTcs.TrySetResult(payload));
        connection.On<JsonElement, int>("GameOver", (player, gameOver) => gameOverTcs.TrySetResult((player, gameOver)));
        connection.On<string, string>("UpdateStatus", (_, _) =>
        {
            if (recoveryTriggered)
            {
                Interlocked.Increment(ref statusEventCountAfterTrigger);
            }
        });

        await connection.StartAsync();

        var humanPlayer = await connection.InvokeAsync<JsonElement>("StartVsBot", "human_bot_terminal_1");
        var humanName = humanPlayer.GetProperty("name").GetString();

        var startPayload = await WaitWithTimeout(startTcs.Task);
        var gameId = startPayload.GetProperty("game").GetProperty("id").GetString();
        gameId.Should().NotBeNullOrWhiteSpace();

        this.ConfigureBotTerminalPosition(gameId!, checkmate: true);

        recoveryTriggered = true;
        await connection.InvokeAsync("RequestSync");

        var gameOverEvent = await WaitWithTimeout(gameOverTcs.Task, timeoutMs: 15000);
        gameOverEvent.GameOver.Should().Be((int)GameOver.Checkmate);
        gameOverEvent.Player.ValueKind.Should().NotBe(JsonValueKind.Null);
        gameOverEvent.Player.GetProperty("name").GetString().Should().Be(humanName);

        await Task.Delay(500);
        statusEventCountAfterTrigger.Should().Be(0);
    }

    [Fact]
    public async Task BotGame_TerminalRecovery_ShouldEmitSingleImmediateGameOver()
    {
        await this.SeedUserAsync("bot-user-terminal-single-1", "bot-terminal-single-1@example.com");
        await using var connection = this.CreateHubConnection("bot-user-terminal-single-1", "bot-terminal-single-1@example.com");

        var startTcs = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
        var gameOverQueue = new Queue<(JsonElement Player, int GameOver)>();
        using var gameOverSignal = new SemaphoreSlim(0, int.MaxValue);

        connection.On<JsonElement>("Start", payload => startTcs.TrySetResult(payload));
        connection.On<JsonElement, int>("GameOver", (player, gameOver) =>
        {
            lock (gameOverQueue)
            {
                gameOverQueue.Enqueue((player, gameOver));
            }

            gameOverSignal.Release();
        });

        await connection.StartAsync();
        await connection.InvokeAsync<JsonElement>("StartVsBot", "human_bot_s1");

        var startPayload = await WaitWithTimeout(startTcs.Task);
        var gameId = startPayload.GetProperty("game").GetProperty("id").GetString();
        gameId.Should().NotBeNullOrWhiteSpace();

        this.ConfigureBotTerminalPosition(gameId!, checkmate: true, botToMove: true);
        ClearQueueAndSignal(gameOverQueue, gameOverSignal);

        await connection.InvokeAsync("RequestSync");

        var firstGameOver = await WaitNextGameOver(gameOverQueue, gameOverSignal, timeoutMs: 15000);
        firstGameOver.GameOver.Should().Be((int)GameOver.Checkmate);

        await Task.Delay(500);

        lock (gameOverQueue)
        {
            gameOverQueue.Count.Should().Be(0);
        }

        gameOverSignal.CurrentCount.Should().Be(0);
    }

    [Fact]
    public async Task BotGame_RequestSync_ShouldRecoverAndAdvance_WhenBotTurnPending()
    {
        await this.SeedUserAsync("bot-user-recovery-1", "bot-recovery-1@example.com");
        await using var connection = this.CreateHubConnection("bot-user-recovery-1", "bot-recovery-1@example.com");

        var startTcs = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
        var syncQueue = new Queue<SyncMessage>();
        using var syncSignal = new SemaphoreSlim(0, int.MaxValue);
        var gameOverTcs = new TaskCompletionSource<int>(TaskCreationOptions.RunContinuationsAsynchronously);

        connection.On<JsonElement>("Start", payload => startTcs.TrySetResult(payload));
        connection.On<string, string, long, string>("SyncPosition", (fen, movingPlayerName, turnNumber, movingPlayerId) =>
        {
            lock (syncQueue)
            {
                syncQueue.Enqueue(new SyncMessage(fen, movingPlayerName, turnNumber, movingPlayerId));
            }

            syncSignal.Release();
        });
        connection.On<JsonElement, int>("GameOver", (_, gameOver) => gameOverTcs.TrySetResult(gameOver));

        await connection.StartAsync();

        var humanPlayer = await connection.InvokeAsync<JsonElement>("StartVsBot", "human_bot_recovery_1");
        var humanId = humanPlayer.GetProperty("id").GetString();
        humanId.Should().NotBeNullOrWhiteSpace();

        var startPayload = await WaitWithTimeout(startTcs.Task);
        var gameId = startPayload.GetProperty("game").GetProperty("id").GetString();
        gameId.Should().NotBeNullOrWhiteSpace();

        this.ConfigureBotPendingTurnPosition(gameId!);

        await connection.InvokeAsync("RequestSync");

        var latestSync = await WaitNextSync(syncQueue, syncSignal, timeoutMs: 15000);
        for (var i = 0; i < 5 && latestSync.TurnNumber < 21; i++)
        {
            latestSync = await WaitNextSync(syncQueue, syncSignal, timeoutMs: 15000);
        }

        latestSync.TurnNumber.Should().BeGreaterOrEqualTo(21);
        latestSync.MovingPlayerId.Should().Be(humanId);

        var unexpectedGameOver = await Task.WhenAny(gameOverTcs.Task, Task.Delay(1000));
        unexpectedGameOver.Should().NotBe(gameOverTcs.Task);
    }

    [Fact]
    public async Task BotGame_WhenResignedDuringBotDelay_ShouldNotPublishBotSyncAfterGameOver()
    {
        await this.SeedUserAsync("bot-user-resign-race-1", "bot-resign-race-1@example.com");
        await using var connection = this.CreateHubConnection("bot-user-resign-race-1", "bot-resign-race-1@example.com");

        var startTcs = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
        var syncQueue = new Queue<SyncMessage>();
        var syncAfterGameOver = new List<SyncMessage>();
        using var syncSignal = new SemaphoreSlim(0, int.MaxValue);
        var resignGameOverTcs = new TaskCompletionSource<int>(TaskCreationOptions.RunContinuationsAsynchronously);
        var gameOverReceived = 0;
        var syncLock = new object();

        connection.On<JsonElement>("Start", payload => startTcs.TrySetResult(payload));
        connection.On<JsonElement, int>("GameOver", (_, gameOver) =>
        {
            Interlocked.Exchange(ref gameOverReceived, 1);
            resignGameOverTcs.TrySetResult(gameOver);
        });
        connection.On<string, string, long, string>("SyncPosition", (fen, movingPlayerName, turnNumber, movingPlayerId) =>
        {
            var sync = new SyncMessage(fen, movingPlayerName, turnNumber, movingPlayerId);
            lock (syncLock)
            {
                syncQueue.Enqueue(sync);
                if (Volatile.Read(ref gameOverReceived) == 1)
                {
                    syncAfterGameOver.Add(sync);
                }
            }

            syncSignal.Release();
        });

        await connection.StartAsync();
        await connection.InvokeAsync<JsonElement>("StartVsBot", "bot_resign_1");

        var startPayload = await WaitWithTimeout(startTcs.Task);
        var gameId = startPayload.GetProperty("game").GetProperty("id").GetString();
        gameId.Should().NotBeNullOrWhiteSpace();

        this.ConfigureBotPendingTurnPosition(gameId!);
        lock (syncLock)
        {
            syncQueue.Clear();
            syncAfterGameOver.Clear();
        }

        await connection.InvokeAsync("RequestSync");
        SyncMessage? syncBeforeResign = null;
        var syncDeadline = DateTime.UtcNow.AddSeconds(15);
        while (DateTime.UtcNow < syncDeadline)
        {
            var nextSync = await WaitNextSync(syncQueue, syncSignal, timeoutMs: 3000);
            if (nextSync.TurnNumber == 20)
            {
                syncBeforeResign = nextSync;
                break;
            }
        }

        syncBeforeResign.Should().NotBeNull();
        syncBeforeResign!.TurnNumber.Should().Be(20);

        await connection.InvokeAsync("Resign");

        var resignGameOver = await WaitWithTimeout(resignGameOverTcs.Task, timeoutMs: 15000);
        resignGameOver.Should().Be((int)GameOver.Resign);

        await Task.Delay(1200);

        lock (syncLock)
        {
            syncAfterGameOver.Should().BeEmpty();
        }
    }

    [Fact]
    public async Task BotGame_AfterGameOver_LateSyncOrStatus_ShouldNotOverrideTerminalStatus()
    {
        await this.SeedUserAsync("bot-user-terminal-2", "bot-terminal-2@example.com");
        await using var connection = this.CreateHubConnection("bot-user-terminal-2", "bot-terminal-2@example.com");

        var startTcs = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
        var gameOverTcs = new TaskCompletionSource<int>(TaskCreationOptions.RunContinuationsAsynchronously);
        var receivedGameOver = false;
        var updateStatusAfterGameOver = 0;

        connection.On<JsonElement>("Start", payload => startTcs.TrySetResult(payload));
        connection.On<JsonElement, int>("GameOver", (_, gameOver) =>
        {
            receivedGameOver = true;
            gameOverTcs.TrySetResult(gameOver);
        });
        connection.On<string, string>("UpdateStatus", (_, _) =>
        {
            if (receivedGameOver)
            {
                Interlocked.Increment(ref updateStatusAfterGameOver);
            }
        });

        await connection.StartAsync();
        await connection.InvokeAsync<JsonElement>("StartVsBot", "human_bot_terminal_2");

        var startPayload = await WaitWithTimeout(startTcs.Task);
        var gameId = startPayload.GetProperty("game").GetProperty("id").GetString();
        gameId.Should().NotBeNullOrWhiteSpace();

        this.ConfigureBotTerminalPosition(gameId!, checkmate: true);

        await connection.InvokeAsync("RequestSync");
        var gameOverCode = await WaitWithTimeout(gameOverTcs.Task, timeoutMs: 15000);
        gameOverCode.Should().Be((int)GameOver.Checkmate);

        await connection.InvokeAsync("RequestSync");
        await Task.Delay(500);

        updateStatusAfterGameOver.Should().Be(0);
    }

    [Fact]
    public async Task BotGame_RequestSync_AfterTerminalState_ShouldReplayGameOverToCaller()
    {
        await this.SeedUserAsync("bot-user-terminal-3", "bot-terminal-3@example.com");
        await using var connection = this.CreateHubConnection("bot-user-terminal-3", "bot-terminal-3@example.com");

        var startTcs = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
        var gameOverQueue = new Queue<(JsonElement Player, int GameOver)>();
        using var gameOverSignal = new SemaphoreSlim(0, int.MaxValue);

        connection.On<JsonElement>("Start", payload => startTcs.TrySetResult(payload));
        connection.On<JsonElement, int>("GameOver", (player, gameOver) =>
        {
            lock (gameOverQueue)
            {
                gameOverQueue.Enqueue((player, gameOver));
            }

            gameOverSignal.Release();
        });

        await connection.StartAsync();
        var humanPlayer = await connection.InvokeAsync<JsonElement>("StartVsBot", "human_bot_terminal_3");
        var humanName = humanPlayer.GetProperty("name").GetString();

        var startPayload = await WaitWithTimeout(startTcs.Task);
        var gameId = startPayload.GetProperty("game").GetProperty("id").GetString();
        gameId.Should().NotBeNullOrWhiteSpace();

        this.ConfigureBotTerminalPosition(gameId!, checkmate: true);

        await connection.InvokeAsync("RequestSync");
        var firstGameOver = await WaitNextGameOver(gameOverQueue, gameOverSignal, timeoutMs: 15000);
        firstGameOver.GameOver.Should().Be((int)GameOver.Checkmate);
        firstGameOver.Player.GetProperty("name").GetString().Should().Be(humanName);

        await connection.InvokeAsync("RequestSync");
        var secondGameOver = await WaitNextGameOver(gameOverQueue, gameOverSignal, timeoutMs: 5000);
        secondGameOver.GameOver.Should().Be((int)GameOver.Checkmate);
        secondGameOver.Player.GetProperty("name").GetString().Should().Be(humanName);
    }

    [Fact]
    public async Task BotGame_MoveSelected_AfterTerminalState_ShouldNotMutatePosition_AndReplayTerminalState()
    {
        await this.SeedUserAsync("bot-user-terminal-6", "bot-terminal-6@example.com");
        await using var connection = this.CreateHubConnection("bot-user-terminal-6", "bot-terminal-6@example.com");

        var startTcs = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
        var gameOverQueue = new Queue<(JsonElement Player, int GameOver)>();
        var syncQueue = new Queue<SyncMessage>();
        var boardMoveCount = 0;
        using var gameOverSignal = new SemaphoreSlim(0, int.MaxValue);
        using var syncSignal = new SemaphoreSlim(0, int.MaxValue);

        connection.On<JsonElement>("Start", payload => startTcs.TrySetResult(payload));
        connection.On<string, string>("BoardMove", (_, _) => Interlocked.Increment(ref boardMoveCount));
        connection.On<JsonElement, int>("GameOver", (player, gameOver) =>
        {
            lock (gameOverQueue)
            {
                gameOverQueue.Enqueue((player, gameOver));
            }

            gameOverSignal.Release();
        });
        connection.On<string, string, long, string>("SyncPosition", (fen, movingPlayerName, turnNumber, movingPlayerId) =>
        {
            lock (syncQueue)
            {
                syncQueue.Enqueue(new SyncMessage(fen, movingPlayerName, turnNumber, movingPlayerId));
            }

            syncSignal.Release();
        });

        await connection.StartAsync();
        await connection.InvokeAsync<JsonElement>("StartVsBot", "human_bot_terminal_6");

        var startPayload = await WaitWithTimeout(startTcs.Task);
        var gameId = startPayload.GetProperty("game").GetProperty("id").GetString();
        gameId.Should().NotBeNullOrWhiteSpace();

        this.ConfigureBotTerminalPosition(gameId!, checkmate: true);
        ClearQueueAndSignal(syncQueue, syncSignal);
        ClearQueueAndSignal(gameOverQueue, gameOverSignal);

        await connection.InvokeAsync("RequestSync");
        var firstGameOver = await WaitNextGameOver(gameOverQueue, gameOverSignal, timeoutMs: 15000);
        firstGameOver.GameOver.Should().Be((int)GameOver.Checkmate);
        var firstSync = await WaitNextSync(syncQueue, syncSignal, timeoutMs: 15000);

        var terminalSnapshot = this.GetGameSnapshot(gameId!);
        firstSync.Fen.Should().Be(terminalSnapshot.Fen);
        firstSync.TurnNumber.Should().Be(terminalSnapshot.TurnNumber);

        ClearQueueAndSignal(syncQueue, syncSignal);
        ClearQueueAndSignal(gameOverQueue, gameOverSignal);
        Interlocked.Exchange(ref boardMoveCount, 0);

        await connection.InvokeAsync("MoveSelected", "a2", "a3", terminalSnapshot.Fen, null);
        var secondSync = await WaitNextSync(syncQueue, syncSignal, timeoutMs: 5000);
        var secondGameOver = await WaitNextGameOver(gameOverQueue, gameOverSignal, timeoutMs: 5000);

        secondGameOver.GameOver.Should().Be((int)GameOver.Checkmate);
        secondSync.Fen.Should().Be(terminalSnapshot.Fen);
        secondSync.TurnNumber.Should().Be(terminalSnapshot.TurnNumber);
        boardMoveCount.Should().Be(0);
    }

    [Fact]
    public async Task BotGame_GetLegalMoves_AfterTerminalState_ShouldReturnEmpty()
    {
        await this.SeedUserAsync("bot-user-terminal-7", "bot-terminal-7@example.com");
        await using var connection = this.CreateHubConnection("bot-user-terminal-7", "bot-terminal-7@example.com");

        var startTcs = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
        var gameOverTcs = new TaskCompletionSource<int>(TaskCreationOptions.RunContinuationsAsynchronously);

        connection.On<JsonElement>("Start", payload => startTcs.TrySetResult(payload));
        connection.On<JsonElement, int>("GameOver", (_, gameOver) => gameOverTcs.TrySetResult(gameOver));

        await connection.StartAsync();
        await connection.InvokeAsync<JsonElement>("StartVsBot", "human_bot_terminal_7");

        var startPayload = await WaitWithTimeout(startTcs.Task);
        var gameId = startPayload.GetProperty("game").GetProperty("id").GetString();
        gameId.Should().NotBeNullOrWhiteSpace();

        this.ConfigureBotTerminalPosition(gameId!, checkmate: true);
        await connection.InvokeAsync("RequestSync");

        var gameOver = await WaitWithTimeout(gameOverTcs.Task, timeoutMs: 15000);
        gameOver.Should().Be((int)GameOver.Checkmate);

        var legalMoves = await connection.InvokeAsync<JsonElement[]>("GetLegalMoves");
        legalMoves.Should().NotBeNull();
        legalMoves.Should().BeEmpty();
    }

    [Fact]
    public async Task BotGame_RequestSync_ShouldResolveTerminalState_WhenHumanHasNoLegalMoves()
    {
        await this.SeedUserAsync("bot-user-terminal-4", "bot-terminal-4@example.com");
        await using var connection = this.CreateHubConnection("bot-user-terminal-4", "bot-terminal-4@example.com");

        var startTcs = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
        var gameOverTcs = new TaskCompletionSource<(JsonElement Player, int GameOver)>(TaskCreationOptions.RunContinuationsAsynchronously);

        connection.On<JsonElement>("Start", payload => startTcs.TrySetResult(payload));
        connection.On<JsonElement, int>("GameOver", (player, gameOver) => gameOverTcs.TrySetResult((player, gameOver)));

        await connection.StartAsync();
        await connection.InvokeAsync<JsonElement>("StartVsBot", "human_bot_terminal_4");

        var startPayload = await WaitWithTimeout(startTcs.Task);
        var gameId = startPayload.GetProperty("game").GetProperty("id").GetString();
        gameId.Should().NotBeNullOrWhiteSpace();

        var botName = startPayload.GetProperty("botPlayerName").GetString();
        botName.Should().NotBeNullOrWhiteSpace();

        this.ConfigureBotTerminalPosition(gameId!, checkmate: true, botToMove: false);

        await connection.InvokeAsync("RequestSync");
        var gameOverEvent = await WaitWithTimeout(gameOverTcs.Task, timeoutMs: 15000);
        gameOverEvent.GameOver.Should().Be((int)GameOver.Checkmate);
        gameOverEvent.Player.ValueKind.Should().NotBe(JsonValueKind.Null);
        gameOverEvent.Player.GetProperty("name").GetString().Should().Be(botName);
    }

    [Fact]
    public async Task BotGame_HumanMateMove_ShouldEmitGameOverWithoutBotStatusUpdate()
    {
        await this.SeedUserAsync("bot-user-terminal-5", "bot-terminal-5@example.com");
        await using var connection = this.CreateHubConnection("bot-user-terminal-5", "bot-terminal-5@example.com");

        var startTcs = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
        var gameOverTcs = new TaskCompletionSource<(JsonElement Player, int GameOver)>(TaskCreationOptions.RunContinuationsAsynchronously);
        var botStatusUpdates = 0;
        var botPlayerId = string.Empty;
        var botPlayerName = string.Empty;

        connection.On<JsonElement>("Start", payload => startTcs.TrySetResult(payload));
        connection.On<JsonElement, int>("GameOver", (player, gameOver) => gameOverTcs.TrySetResult((player, gameOver)));
        connection.On<string, string>("UpdateStatus", (movingPlayerId, movingPlayerName) =>
        {
            if (!string.IsNullOrWhiteSpace(botPlayerId) &&
                string.Equals(movingPlayerId, botPlayerId, StringComparison.Ordinal))
            {
                Interlocked.Increment(ref botStatusUpdates);
                return;
            }

            if (!string.IsNullOrWhiteSpace(botPlayerName) &&
                string.Equals(movingPlayerName, botPlayerName, StringComparison.Ordinal))
            {
                Interlocked.Increment(ref botStatusUpdates);
            }
        });

        await connection.StartAsync();
        var humanPlayer = await connection.InvokeAsync<JsonElement>("StartVsBot", "human_bot_terminal_5");
        var humanName = humanPlayer.GetProperty("name").GetString() ?? string.Empty;

        var startPayload = await WaitWithTimeout(startTcs.Task);
        var gameId = startPayload.GetProperty("game").GetProperty("id").GetString();
        gameId.Should().NotBeNullOrWhiteSpace();

        botPlayerId = startPayload.GetProperty("botPlayerId").GetString();
        botPlayerName = startPayload.GetProperty("botPlayerName").GetString();

        var matingMove = this.ConfigureHumanMateInOnePosition(gameId!);

        await connection.InvokeAsync("MoveSelected", matingMove.Source, matingMove.Target, string.Empty, null);

        var gameOverEvent = await WaitWithTimeout(gameOverTcs.Task, timeoutMs: 15000);
        gameOverEvent.GameOver.Should().BeOneOf((int)GameOver.Checkmate, (int)GameOver.Stalemate);
        if (gameOverEvent.GameOver == (int)GameOver.Checkmate)
        {
            gameOverEvent.Player.ValueKind.Should().NotBe(JsonValueKind.Null);
            gameOverEvent.Player.GetProperty("name").GetString().Should().Be(humanName);
        }

        await Task.Delay(500);
        botStatusUpdates.Should().Be(0);
    }

    [Fact]
    public async Task MoveSelected_WithInvalidSquares_ShouldSnapbackWithoutTerminatingGame()
    {
        await this.SeedUserAsync("bot-user-invalid-move-1", "bot-invalid-move-1@example.com");
        await using var connection = this.CreateHubConnection("bot-user-invalid-move-1", "bot-invalid-move-1@example.com");

        var startTcs = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
        var snapbackTcs = new TaskCompletionSource<string>(TaskCreationOptions.RunContinuationsAsynchronously);
        var gameOverTcs = new TaskCompletionSource<int>(TaskCreationOptions.RunContinuationsAsynchronously);

        connection.On<JsonElement>("Start", payload => startTcs.TrySetResult(payload));
        connection.On<string>("BoardSnapback", fen => snapbackTcs.TrySetResult(fen));
        connection.On<JsonElement, int>("GameOver", (_, gameOver) => gameOverTcs.TrySetResult(gameOver));

        await connection.StartAsync();
        await connection.InvokeAsync<JsonElement>("StartVsBot", "human_bot_1");
        await WaitWithTimeout(startTcs.Task);

        await connection.InvokeAsync("MoveSelected", "z9", "z9", "invalid_fen_payload", null);

        var snapbackFen = await WaitWithTimeout(snapbackTcs.Task, timeoutMs: 5000);
        snapbackFen.Should().NotBeNullOrWhiteSpace();
        snapbackFen.Should().NotBe("invalid_fen_payload");
        snapbackFen.Should().Contain("/");

        var unexpectedGameOver = await Task.WhenAny(gameOverTcs.Task, Task.Delay(1000));
        unexpectedGameOver.Should().NotBe(gameOverTcs.Task);

        await connection.InvokeAsync("RequestSync");
    }

    [Fact]
    public async Task LobbySendMessage_WhenSentTooFast_ShouldBeRateLimited()
    {
        await this.SeedUserAsync("chat-rate-user-1", "chat-rate-user-1@example.com");
        await using var connection = this.CreateHubConnection("chat-rate-user-1", "chat-rate-user-1@example.com");

        await connection.StartAsync();
        await connection.InvokeAsync("LobbySendMessage", "first");

        var exception = await Assert.ThrowsAsync<HubException>(() => connection.InvokeAsync("LobbySendMessage", "second"));
        exception.Message.Should().NotBeNullOrWhiteSpace();

        await Task.Delay(1100);
        await connection.InvokeAsync("LobbySendMessage", "third");
    }

    private HubConnection CreateHubConnection(string userId, string userName)
    {
        var baseAddress = this.factory.Server.BaseAddress ?? new Uri("http://localhost");
        var hubAddress = new Uri(baseAddress, "/hub");

        return new HubConnectionBuilder()
            .WithUrl(hubAddress, options =>
            {
                options.HttpMessageHandlerFactory = _ => this.factory.Server.CreateHandler();
                options.Transports = HttpTransportType.LongPolling;
                options.Headers[TestAuthHandler.HeaderName] = "1";
                options.Headers[TestAuthHandler.UserIdHeaderName] = userId;
                options.Headers[TestAuthHandler.UserNameHeaderName] = userName;
            })
            .Build();
    }

    private static async Task<T> WaitWithTimeout<T>(Task<T> task, int timeoutMs = 10000)
    {
        var timeoutTask = Task.Delay(timeoutMs);
        var completed = await Task.WhenAny(task, timeoutTask);
        if (completed == timeoutTask)
        {
            throw new TimeoutException("Timed out while waiting for SignalR event.");
        }

        return await task;
    }

    private static async Task<SyncMessage> WaitNextSync(Queue<SyncMessage> queue, SemaphoreSlim signal, int timeoutMs = 10000)
    {
        if (!await signal.WaitAsync(timeoutMs))
        {
            throw new TimeoutException("Timed out while waiting for SyncPosition.");
        }

        lock (queue)
        {
            return queue.Dequeue();
        }
    }

    private static async Task<(JsonElement Player, int GameOver)> WaitNextGameOver(
        Queue<(JsonElement Player, int GameOver)> queue,
        SemaphoreSlim signal,
        int timeoutMs = 10000)
    {
        if (!await signal.WaitAsync(timeoutMs))
        {
            throw new TimeoutException("Timed out while waiting for GameOver.");
        }

        lock (queue)
        {
            return queue.Dequeue();
        }
    }

    private static async Task<JsonElement> WaitNextStart(Queue<JsonElement> queue, SemaphoreSlim signal, int timeoutMs = 10000)
    {
        if (!await signal.WaitAsync(timeoutMs))
        {
            throw new TimeoutException("Timed out while waiting for Start payload.");
        }

        lock (queue)
        {
            return queue.Dequeue();
        }
    }

    private static void ClearQueueAndSignal<T>(Queue<T> queue, SemaphoreSlim signal)
    {
        lock (queue)
        {
            queue.Clear();
        }

        while (signal.Wait(0))
        {
        }
    }

    private async Task SeedUserAsync(string id, string email)
    {
        using var scope = this.factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ChessDbContext>();

        if (await dbContext.Users.AnyAsync(x => x.Id == id))
        {
            return;
        }

        await dbContext.Users.AddAsync(new UserEntity
        {
            Id = id,
            UserName = email,
            NormalizedUserName = email.ToUpperInvariant(),
            Email = email,
            NormalizedEmail = email.ToUpperInvariant(),
            EmailConfirmed = true,
            SecurityStamp = Guid.NewGuid().ToString(),
        });

        await dbContext.SaveChangesAsync();
    }

    private void ConfigureBotTerminalPosition(string gameId, bool checkmate, bool botToMove = true)
    {
        using var scope = this.factory.Services.CreateScope();
        var store = scope.ServiceProvider.GetRequiredService<IGameSessionStore>();
        store.TryGetGameById(gameId, out var gameSession).Should().BeTrue();

        gameSession.BotTurnLock.Wait();
        try
        {
            var botSession = gameSession.Player1.IsBot ? gameSession.Player1 : gameSession.Player2;
            var humanSession = gameSession.Player1.IsBot ? gameSession.Player2 : gameSession.Player1;
            var botColor = botSession.Player.Color;
            var opponentColor = humanSession.Player.Color;

            gameSession.Player1.Player.HasToMove = gameSession.Player1.IsBot == botToMove;
            gameSession.Player2.Player.HasToMove = gameSession.Player2.IsBot == botToMove;
            gameSession.Game.GameOver = GameOver.None;
            gameSession.Game.Turn = 20;

            foreach (var square in gameSession.Game.ChessBoard.Matrix.SelectMany(x => x))
            {
                square.Piece = null;
            }

            if (botToMove)
            {
                if (botColor == Color.Black)
                {
                    gameSession.Game.ChessBoard.GetSquareByName("h8").Piece = Factory.GetKing(botColor);
                    gameSession.Game.ChessBoard.GetSquareByName("f6").Piece = Factory.GetKing(opponentColor);
                    gameSession.Game.ChessBoard.GetSquareByName(checkmate ? "g7" : "g6").Piece = Factory.GetQueen(opponentColor);
                }
                else
                {
                    gameSession.Game.ChessBoard.GetSquareByName("h1").Piece = Factory.GetKing(botColor);
                    gameSession.Game.ChessBoard.GetSquareByName(checkmate ? "f3" : "f2").Piece = Factory.GetKing(opponentColor);
                    gameSession.Game.ChessBoard.GetSquareByName(checkmate ? "g2" : "g3").Piece = Factory.GetQueen(opponentColor);
                }
            }
            else
            {
                if (opponentColor == Color.Black)
                {
                    gameSession.Game.ChessBoard.GetSquareByName("h8").Piece = Factory.GetKing(opponentColor);
                    gameSession.Game.ChessBoard.GetSquareByName("f6").Piece = Factory.GetKing(botColor);
                    gameSession.Game.ChessBoard.GetSquareByName(checkmate ? "g7" : "g6").Piece = Factory.GetQueen(botColor);
                }
                else
                {
                    gameSession.Game.ChessBoard.GetSquareByName("h1").Piece = Factory.GetKing(opponentColor);
                    gameSession.Game.ChessBoard.GetSquareByName(checkmate ? "f3" : "f2").Piece = Factory.GetKing(botColor);
                    gameSession.Game.ChessBoard.GetSquareByName(checkmate ? "g2" : "g3").Piece = Factory.GetQueen(botColor);
                }
            }

            gameSession.Game.ChessBoard.CalculateAttackedSquares();
        }
        finally
        {
            gameSession.BotTurnLock.Release();
        }
    }

    private void ConfigureBotPendingTurnPosition(string gameId)
    {
        using var scope = this.factory.Services.CreateScope();
        var store = scope.ServiceProvider.GetRequiredService<IGameSessionStore>();
        store.TryGetGameById(gameId, out var gameSession).Should().BeTrue();

        gameSession.BotTurnLock.Wait();
        try
        {
            var botSession = gameSession.Player1.IsBot ? gameSession.Player1 : gameSession.Player2;
            var humanSession = gameSession.Player1.IsBot ? gameSession.Player2 : gameSession.Player1;
            var botColor = botSession.Player.Color;
            var opponentColor = humanSession.Player.Color;

            gameSession.Player1.Player.HasToMove = gameSession.Player1.IsBot;
            gameSession.Player2.Player.HasToMove = gameSession.Player2.IsBot;
            gameSession.Game.GameOver = GameOver.None;
            gameSession.Game.Turn = 20;

            foreach (var square in gameSession.Game.ChessBoard.Matrix.SelectMany(x => x))
            {
                square.Piece = null;
            }

            if (botColor == Color.Black)
            {
                gameSession.Game.ChessBoard.GetSquareByName("h8").Piece = Factory.GetKing(botColor);
                gameSession.Game.ChessBoard.GetSquareByName("f6").Piece = Factory.GetKing(opponentColor);
                gameSession.Game.ChessBoard.GetSquareByName("a8").Piece = Factory.GetRook(botColor);
            }
            else
            {
                gameSession.Game.ChessBoard.GetSquareByName("h1").Piece = Factory.GetKing(botColor);
                gameSession.Game.ChessBoard.GetSquareByName("f3").Piece = Factory.GetKing(opponentColor);
                gameSession.Game.ChessBoard.GetSquareByName("a1").Piece = Factory.GetRook(botColor);
            }

            gameSession.Game.ChessBoard.CalculateAttackedSquares();
        }
        finally
        {
            gameSession.BotTurnLock.Release();
        }
    }

    private (string Fen, long TurnNumber) GetGameSnapshot(string gameId)
    {
        using var scope = this.factory.Services.CreateScope();
        var store = scope.ServiceProvider.GetRequiredService<IGameSessionStore>();
        var serializer = scope.ServiceProvider.GetRequiredService<IBoardFenSerializer>();
        store.TryGetGameById(gameId, out var gameSession).Should().BeTrue();

        var fen = serializer.Serialize(gameSession.Game.ChessBoard);
        return (fen, gameSession.Game.Turn);
    }

    private (string Source, string Target) ConfigureHumanMateInOnePosition(string gameId)
    {
        using var scope = this.factory.Services.CreateScope();
        var store = scope.ServiceProvider.GetRequiredService<IGameSessionStore>();
        store.TryGetGameById(gameId, out var gameSession).Should().BeTrue();

        gameSession.BotTurnLock.Wait();
        try
        {
            var botSession = gameSession.Player1.IsBot ? gameSession.Player1 : gameSession.Player2;
            var humanSession = gameSession.Player1.IsBot ? gameSession.Player2 : gameSession.Player1;
            var botColor = botSession.Player.Color;
            var humanColor = humanSession.Player.Color;

            gameSession.Player1.Player.HasToMove = !gameSession.Player1.IsBot;
            gameSession.Player2.Player.HasToMove = !gameSession.Player2.IsBot;
            gameSession.Game.GameOver = GameOver.None;
            gameSession.Game.Turn = 40;

            foreach (var square in gameSession.Game.ChessBoard.Matrix.SelectMany(x => x))
            {
                square.Piece = null;
            }

            if (humanColor == Color.White)
            {
                gameSession.Game.ChessBoard.GetSquareByName("h8").Piece = Factory.GetKing(botColor);
                gameSession.Game.ChessBoard.GetSquareByName("f6").Piece = Factory.GetKing(humanColor);
                gameSession.Game.ChessBoard.GetSquareByName("f7").Piece = Factory.GetQueen(humanColor);
                gameSession.Game.ChessBoard.CalculateAttackedSquares();
                return ("f7", "g7");
            }

            gameSession.Game.ChessBoard.GetSquareByName("h1").Piece = Factory.GetKing(botColor);
            gameSession.Game.ChessBoard.GetSquareByName("f3").Piece = Factory.GetKing(humanColor);
            gameSession.Game.ChessBoard.GetSquareByName("f2").Piece = Factory.GetQueen(humanColor);
            gameSession.Game.ChessBoard.CalculateAttackedSquares();
            return ("f2", "g2");
        }
        finally
        {
            gameSession.BotTurnLock.Release();
        }
    }

    private sealed record SyncMessage(string Fen, string MovingPlayerName, long TurnNumber, string MovingPlayerId);
}
