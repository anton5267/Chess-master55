namespace Chess.Web.Hubs
{
    using System;
    using System.Collections.Generic;
    using System.Linq;
    using System.Threading.Tasks;

    using Chess.Common.Enums;
    using Chess.Common.EventArgs;
    using Chess.Data.Common.Repositories;
    using Chess.Data.Models;
    using Chess.Services.Data.Models;
    using Chess.Web.Hubs.Sessions;
    using Microsoft.AspNetCore.SignalR;
    using Microsoft.Extensions.DependencyInjection;
    using Microsoft.Extensions.Logging;

    public partial class GameHub
    {
        public async Task MoveSelected(string source, string target, string sourceFen, string targetFen)
        {
            var gameSession = this.GetGameSession();
            var player = this.GetPlayer();
            var game = gameSession.Game;
            var isBotGame = gameSession.IsBotGame;

            EventHandler onGameOver = (sender, eventArgs) =>
            {
                if (!this.IsEventForGame(sender, game.Id, out var eventPlayer) || eventArgs is not GameOverEventArgs args)
                {
                    return;
                }

                _ = this.HandleGameOverEventAsync(game, eventPlayer, args.GameOver, isBotGame);
            };

            EventHandler onTakePiece = (sender, eventArgs) =>
            {
                if (!this.IsEventForGame(sender, game.Id, out var eventPlayer) || eventArgs is not TakePieceEventArgs args)
                {
                    return;
                }

                this.HandleTakePieceEvent(game, eventPlayer, args);
            };

            EventHandler onAvailableThreefoldDraw = (sender, eventArgs) =>
            {
                if (!this.IsEventForGame(sender, game.Id, out _) || eventArgs is not ThreefoldDrawEventArgs args)
                {
                    return;
                }

                this.HandleThreefoldAvailabilityEvent(game, args);
            };

            EventHandler onMoveEvent = (sender, eventArgs) =>
            {
                if (!this.IsEventForGame(sender, game.Id, out var eventPlayer) || eventArgs is not MoveArgs args)
                {
                    return;
                }

                this.HandleMoveEvent(game, eventPlayer, args);
            };

            EventHandler onCompleteMove = (sender, eventArgs) =>
            {
                if (!this.IsEventForGame(sender, game.Id, out var eventPlayer) || eventArgs is not HistoryUpdateArgs args)
                {
                    return;
                }

                this.HandleCompleteMoveEvent(game, eventPlayer, args);
            };

            this.notificationService.OnGameOver += onGameOver;
            this.notificationService.OnTakePiece += onTakePiece;
            this.notificationService.OnAvailableThreefoldDraw += onAvailableThreefoldDraw;
            this.notificationService.OnMoveEvent += onMoveEvent;
            this.notificationService.OnCompleteMove += onCompleteMove;

            try
            {
                if (player.HasToMove && await game.MakeMoveAsync(source, target, targetFen, persistHistory: !isBotGame))
                {
                    await this.OpponentBoardMove(source, target, game);
                    await this.HighlightMove(source, target, game);
                    await this.IsSpecialMove(target, game);
                    await this.SyncPosition(game);
                    await this.UpdateStatus(game);
                    await this.TryExecuteBotTurnIfNeededAsync(gameSession, trigger: "human_move");
                }
                else
                {
                    await this.Snapback(sourceFen);
                }
            }
            catch (Exception ex)
            {
                using var scope = this.serviceProvider.CreateScope();
                var errorLogRepository = scope.ServiceProvider.GetRequiredService<IRepository<ErrorLogEntity>>();

                await errorLogRepository.AddAsync(new ErrorLogEntity
                {
                    GameId = game.Id,
                    Source = source,
                    Target = target,
                    FenString = sourceFen,
                    ExceptionMessage = ex.Message,
                    CreatedOn = this.clock.UtcNow,
                });

                await errorLogRepository.SaveChangesAsync();
            }
            finally
            {
                this.notificationService.OnGameOver -= onGameOver;
                this.notificationService.OnTakePiece -= onTakePiece;
                this.notificationService.OnAvailableThreefoldDraw -= onAvailableThreefoldDraw;
                this.notificationService.OnMoveEvent -= onMoveEvent;
                this.notificationService.OnCompleteMove -= onCompleteMove;
            }
        }

        public async Task RequestSync()
        {
            if (!this.gameSessionStore.TryGetGameByConnection(this.Context.ConnectionId, out var gameSession, out _))
            {
                return;
            }

            await this.SyncPositionToCaller(gameSession.Game);

            if (!gameSession.IsBotGame)
            {
                this.logger.LogDebug("BotTurnRecoverySkipped GameId={GameId} Reason=NotBotGame", gameSession.GameId);
                return;
            }

            var game = gameSession.Game;
            var botSession = this.GetBotSession(gameSession);
            if (botSession == null || game.GameOver != GameOver.None)
            {
                this.logger.LogDebug("BotTurnRecoverySkipped GameId={GameId} Reason=NoBotOrGameOver", gameSession.GameId);
                return;
            }

            if (!string.Equals(game.MovingPlayer.Id, botSession.ConnectionId, StringComparison.OrdinalIgnoreCase))
            {
                this.logger.LogDebug("BotTurnRecoverySkipped GameId={GameId} Reason=HumanToMove", gameSession.GameId);
                return;
            }

            this.logger.LogInformation(
                "BotTurnRecoveryRequested GameId={GameId} Trigger=RequestSync ConnectionId={ConnectionId}",
                gameSession.GameId,
                this.Context.ConnectionId);

            await this.TryExecuteBotTurnIfNeededAsync(gameSession, trigger: "request_sync_recovery");
        }

        public LegalMoveDto[] GetLegalMoves()
        {
            var player = this.GetPlayer();
            if (!player.HasToMove)
            {
                return Array.Empty<LegalMoveDto>();
            }

            var game = this.GetGame();

            return game.GetLegalMoves()
                .Select(x => new LegalMoveDto
                {
                    Source = x.Source,
                    Target = x.Target,
                    IsCapture = x.IsCapture,
                })
                .ToArray();
        }

        public async Task ThreefoldDraw()
        {
            var player = this.GetPlayer();
            var gameSession = this.GetGameSession();
            var game = gameSession.Game;
            var opponent = game.Opponent;

            game.GameOver = GameOver.ThreefoldDraw;
            await this.Clients
                .Group(game.Id)
                .SendAsync("GameOver", player, game.GameOver);
            await this.GameSendInternalMessage(game.Id, player.Name, null);

            if (!gameSession.IsBotGame)
            {
                await this.UpdateStatsAsync(player, opponent, game.GameOver);
            }
        }

        public async Task OfferDrawRequest()
        {
            var player = this.GetPlayer();
            var game = this.GetGame();

            await this.GameSendInternalMessage(game.Id, player.Name, null);
            await this.Clients.GroupExcept(game.Id, new[] { this.Context.ConnectionId }).SendAsync("DrawOffered", player);
        }

        public async Task OfferDrawAnswer(bool isAccepted)
        {
            var player = this.GetPlayer();
            var gameSession = this.GetGameSession();
            var game = gameSession.Game;

            if (isAccepted)
            {
                var opponent = this.GetOpponentPlayer(game, player);

                game.GameOver = GameOver.Draw;
                await this.Clients.Group(game.Id).SendAsync("GameOver", null, game.GameOver);
                await this.GameSendInternalMessage(game.Id, player.Name, game.GameOver.ToString());

                if (!gameSession.IsBotGame)
                {
                    await this.UpdateStatsAsync(player, opponent, game.GameOver);
                }
            }
            else
            {
                await this.Clients.GroupExcept(game.Id, new[] { this.Context.ConnectionId }).SendAsync("DrawOfferRejected", player);
                await this.GameSendInternalMessage(game.Id, player.Name, game.GameOver.ToString());
            }
        }

        public async Task Resign()
        {
            var player = this.GetPlayer();
            var gameSession = this.GetGameSession();
            var game = gameSession.Game;
            var opponent = this.GetOpponentPlayer(game, player);

            game.GameOver = GameOver.Resign;
            await this.Clients.Group(game.Id).SendAsync("GameOver", player, game.GameOver);
            await this.GameSendInternalMessage(game.Id, player.Name, null);

            if (!gameSession.IsBotGame)
            {
                await this.UpdateStatsAsync(opponent, player, game.GameOver);
            }
        }

        private async Task OpponentBoardMove(string source, string target, Game game)
        {
            await this.Clients.GroupExcept(game.Id, new[] { this.Context.ConnectionId }).SendAsync("BoardMove", source, target);
        }

        private async Task HighlightMove(string source, string target, Game game)
        {
            await this.Clients.Group(game.Id).SendAsync("HighlightMove", source, target, game.Opponent);
        }

        private async Task IsSpecialMove(string target, Game game)
        {
            if (game.Move.Type != MoveType.Normal && game.Move.Type != MoveType.Taking)
            {
                switch (game.Move.Type)
                {
                    case MoveType.Castling:
                        await this.Clients.Group(game.Id).SendAsync("BoardMove", game.Move.CastlingArgs.RookSource, game.Move.CastlingArgs.RookTarget);
                        break;
                    case MoveType.EnPassant:
                        await this.Clients.Group(game.Id).SendAsync("EnPassantTake", game.Move.EnPassantArgs.SquareTakenPiece.Name, target);
                        break;
                    case MoveType.PawnPromotion:
                        await this.Clients.Group(game.Id).SendAsync("BoardSetPosition", game.Move.PawnPromotionArgs.FenString);
                        break;
                }
            }

            game.Move.Type = MoveType.Normal;
        }

        private async Task UpdateStatus(Game game)
        {
            if (game.GameOver.ToString() == GameOver.None.ToString())
            {
                await this.Clients.Group(game.Id).SendAsync("UpdateStatus", game.MovingPlayer.Id, game.MovingPlayer.Name);
            }
        }

        private async Task SyncPosition(Game game)
        {
            var fen = this.boardFenSerializer.Serialize(game.ChessBoard);
            await this.Clients.Group(game.Id).SendAsync("SyncPosition", fen, game.MovingPlayer.Name, game.Turn, game.MovingPlayer.Id);
        }

        private async Task SyncPositionToCaller(Game game)
        {
            var fen = this.boardFenSerializer.Serialize(game.ChessBoard);
            await this.Clients.Caller.SendAsync("SyncPosition", fen, game.MovingPlayer.Name, game.Turn, game.MovingPlayer.Id);
        }

        private async Task Snapback(string sourceFen)
        {
            await this.Clients.Caller.SendAsync("BoardSnapback", sourceFen);
        }

        private bool IsEventForGame(object sender, string gameId, out Player eventPlayer)
        {
            eventPlayer = sender as Player;
            return eventPlayer != null &&
                !string.IsNullOrEmpty(eventPlayer.GameId) &&
                eventPlayer.GameId.Equals(gameId, StringComparison.OrdinalIgnoreCase);
        }

        private async Task HandleGameOverEventAsync(Game game, Player player, GameOver gameOver, bool isBotGame)
        {
            var opponent = this.GetOpponentPlayer(game, player);

            await this.Clients.Group(game.Id).SendAsync("GameOver", player, gameOver);
            await this.GameSendInternalMessage(game.Id, player.Name, gameOver.ToString());
            if (!isBotGame)
            {
                await this.UpdateStatsAsync(player, opponent, gameOver);
            }
        }

        private void HandleCompleteMoveEvent(Game game, Player player, HistoryUpdateArgs args)
        {
            _ = this.Clients.Group(game.Id).SendAsync("UpdateMoveHistory", player, args.Notation);
        }

        private void HandleMoveEvent(Game game, Player player, MoveArgs message)
        {
            if (message.Type == Message.CheckOpponent || message.Type == Message.CheckClear)
            {
                if (message.Type == Message.CheckOpponent)
                {
                    _ = this.GameSendInternalMessage(game.Id, player.Name, null);
                }

                _ = this.Clients.Group(game.Id).SendAsync("CheckStatus", message.Type);
            }
            else
            {
                _ = this.Clients.Caller.SendAsync("InvalidMove", message.Type);
            }
        }

        private void HandleTakePieceEvent(Game game, Player player, TakePieceEventArgs args)
        {
            _ = this.Clients.Group(game.Id).SendAsync("UpdateTakenFigures", player, args.PieceName, args.Points);
        }

        private void HandleThreefoldAvailabilityEvent(Game game, ThreefoldDrawEventArgs args)
        {
            _ = this.Clients.Caller.SendAsync("ThreefoldAvailable", false);
            _ = this.Clients.GroupExcept(game.Id, new[] { this.Context.ConnectionId }).SendAsync("ThreefoldAvailable", args.IsAvailable);
        }

        private async Task TryExecuteBotTurnIfNeededAsync(GameSession gameSession, string trigger)
        {
            if (gameSession == null || !gameSession.IsBotGame)
            {
                return;
            }

            var game = gameSession.Game;
            var botSession = this.GetBotSession(gameSession);
            if (botSession == null || game.GameOver != GameOver.None)
            {
                return;
            }

            if (!string.Equals(game.MovingPlayer.Id, botSession.ConnectionId, StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            await gameSession.BotTurnLock.WaitAsync();
            try
            {
                if (game.GameOver != GameOver.None ||
                    !string.Equals(game.MovingPlayer.Id, botSession.ConnectionId, StringComparison.OrdinalIgnoreCase))
                {
                    return;
                }

                this.logger.LogInformation("BotTurnScheduled GameId={GameId} Trigger={Trigger}", game.Id, trigger);
                await Task.Delay(Random.Shared.Next(300, 701));

                var candidateMoves = game.GetLegalMoves().ToList();
                if (candidateMoves.Count == 0)
                {
                    this.logger.LogInformation(
                        "BotTurnNoLegalMoves GameId={GameId} Trigger={Trigger}",
                        game.Id,
                        trigger);
                    await this.FinalizeBotGameOnNoLegalMovesAsync(game, trigger);
                    return;
                }

                while (candidateMoves.Count > 0)
                {
                    var botMove = this.SelectBotMoveCandidate(game, candidateMoves);
                    this.RemoveCandidate(candidateMoves, botMove);

                    var moved = await game.MakeMoveAsync(botMove.Source, botMove.Target, targetFen: null, persistHistory: false);
                    if (!moved)
                    {
                        this.logger.LogWarning(
                            "BotTurnFailedInvalidMoveCandidate GameId={GameId} Trigger={Trigger} Source={Source} Target={Target} Remaining={Remaining}",
                            game.Id,
                            trigger,
                            botMove.Source,
                            botMove.Target,
                            candidateMoves.Count);
                        continue;
                    }

                    await this.hubContext.Clients.Group(game.Id).SendAsync("BoardMove", botMove.Source, botMove.Target);
                    await this.HighlightMove(botMove.Source, botMove.Target, game);
                    await this.IsSpecialMove(botMove.Target, game);
                    await this.SyncPosition(game);

                    if (game.GameOver != GameOver.None)
                    {
                        await this.PublishBotGameOverAsync(game, this.ResolveWinnerForBotTurnResult(botSession, game.GameOver), game.GameOver);
                        this.logger.LogInformation(
                            "BotTurnExecutedTerminal GameId={GameId} Trigger={Trigger} Source={Source} Target={Target} GameOver={GameOver}",
                            game.Id,
                            trigger,
                            botMove.Source,
                            botMove.Target,
                            game.GameOver);
                        return;
                    }

                    await this.UpdateStatus(game);
                    this.logger.LogInformation(
                        "BotTurnExecuted GameId={GameId} Trigger={Trigger} Source={Source} Target={Target} NextMovingPlayer={MovingPlayer}",
                        game.Id,
                        trigger,
                        botMove.Source,
                        botMove.Target,
                        game.MovingPlayer.Name);
                    return;
                }

                this.logger.LogWarning(
                    "BotTurnFailedAllCandidates GameId={GameId} Trigger={Trigger}",
                    game.Id,
                    trigger);
                await this.FinalizeBotGameOnNoLegalMovesAsync(game, trigger);
            }
            catch (Exception ex)
            {
                this.logger.LogWarning(ex, "BotTurnFailed GameId={GameId} Trigger={Trigger}", gameSession.GameId, trigger);
                await this.SyncPosition(game);
                if (game.GameOver == GameOver.None)
                {
                    await this.UpdateStatus(game);
                }
            }
            finally
            {
                gameSession.BotTurnLock.Release();
            }
        }

        private async Task FinalizeBotGameOnNoLegalMovesAsync(Game game, string trigger)
        {
            var (resolved, gameOver, winnerOrActor) = game.ResolveTerminalStateForCurrentMovingPlayer();
            if (resolved)
            {
                await this.PublishBotGameOverAsync(game, winnerOrActor, gameOver);
                await this.SyncPosition(game);
                this.logger.LogInformation(
                    "BotTurnRecoveryExecuted GameId={GameId} Trigger={Trigger} ResolvedAs={GameOver} Winner={Winner}",
                    game.Id,
                    trigger,
                    gameOver,
                    winnerOrActor?.Name ?? "<none>");
                return;
            }

            await this.SyncPosition(game);
            if (game.GameOver == GameOver.None)
            {
                await this.UpdateStatus(game);
            }

            this.logger.LogWarning(
                "BotTurnRecoverySkipped GameId={GameId} Trigger={Trigger} Reason=StateNotTerminal",
                game.Id,
                trigger);
        }

        private LegalMove SelectBotMoveCandidate(Game game, List<LegalMove> candidates)
        {
            if (this.botMoveSelector.TrySelectMove(game, out var selectedByStrategy))
            {
                var selectedCandidate = candidates.FirstOrDefault(x =>
                    x.Source.Equals(selectedByStrategy.Source, StringComparison.OrdinalIgnoreCase) &&
                    x.Target.Equals(selectedByStrategy.Target, StringComparison.OrdinalIgnoreCase));

                if (selectedCandidate != null)
                {
                    return selectedCandidate;
                }
            }

            return candidates[Random.Shared.Next(candidates.Count)];
        }

        private void RemoveCandidate(List<LegalMove> candidates, LegalMove selectedMove)
        {
            candidates.RemoveAll(x =>
                x.Source.Equals(selectedMove.Source, StringComparison.OrdinalIgnoreCase) &&
                x.Target.Equals(selectedMove.Target, StringComparison.OrdinalIgnoreCase));
        }

        private PlayerSession GetBotSession(GameSession gameSession)
        {
            return gameSession.Player1.IsBot
                ? gameSession.Player1
                : (gameSession.Player2.IsBot ? gameSession.Player2 : null);
        }

        private Player ResolveWinnerForBotTurnResult(PlayerSession botSession, GameOver gameOver)
        {
            return gameOver == GameOver.Checkmate
                ? botSession.Player
                : null;
        }

        private async Task PublishBotGameOverAsync(Game game, Player winner, GameOver gameOver)
        {
            await this.Clients.Group(game.Id).SendAsync("GameOver", winner, gameOver);
            await this.SendBotGameOverInternalMessageAsync(game.Id, winner, gameOver);
        }

        private async Task SendBotGameOverInternalMessageAsync(string gameId, Player winner, GameOver gameOver)
        {
            string message;
            switch (gameOver)
            {
                case GameOver.Checkmate:
                    if (winner != null)
                    {
                        message = this.localizer["BotGame_CheckmateWin", winner.Name];
                    }
                    else
                    {
                        message = this.localizer["Js_Checkmate"];
                    }

                    break;
                case GameOver.Stalemate:
                    message = this.localizer["BotGame_Stalemate"];
                    break;
                default:
                    message = $"{gameOver}!";
                    break;
            }

            await this.Clients.Group(gameId).SendAsync("UpdateGameChatInternalMessage", message);
        }
    }
}

