namespace Chess.Web.Hubs
{
    using System;
    using System.Threading.Tasks;

    using Chess.Common.Enums;
    using Chess.Common.EventArgs;
    using Chess.Data.Common.Repositories;
    using Chess.Data.Models;
    using Chess.Services.Data.Models;
    using Microsoft.AspNetCore.SignalR;
    using Microsoft.Extensions.DependencyInjection;

    public partial class GameHub
    {
        public async Task MoveSelected(string source, string target, string sourceFen, string targetFen)
        {
            var player = this.GetPlayer();
            var game = this.GetGame();

            EventHandler onGameOver = (sender, eventArgs) =>
            {
                if (!this.IsEventForGame(sender, game.Id, out var eventPlayer) || eventArgs is not GameOverEventArgs args)
                {
                    return;
                }

                _ = this.HandleGameOverEventAsync(game, eventPlayer, args.GameOver);
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
                if (player.HasToMove && await game.MakeMoveAsync(source, target, targetFen))
                {
                    await this.OpponentBoardMove(source, target, game);
                    await this.HighlightMove(source, target, game);
                    await this.IsSpecialMove(target, game);
                    await this.UpdateStatus(game);
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

        public async Task ThreefoldDraw()
        {
            var player = this.GetPlayer();
            var game = this.GetGame();
            var opponent = game.Opponent;

            game.GameOver = GameOver.ThreefoldDraw;
            await this.Clients
                .Group(game.Id)
                .SendAsync("GameOver", player, game.GameOver);
            await this.GameSendInternalMessage(game.Id, player.Name, null);

            await this.UpdateStatsAsync(player, opponent, game.GameOver);
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
            var game = this.GetGame();

            if (isAccepted)
            {
                var opponent = this.GetOpponentPlayer(game, player);

                game.GameOver = GameOver.Draw;
                await this.Clients.Group(game.Id).SendAsync("GameOver", null, game.GameOver);
                await this.GameSendInternalMessage(game.Id, player.Name, game.GameOver.ToString());

                await this.UpdateStatsAsync(player, opponent, game.GameOver);
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
            var game = this.GetGame();
            var opponent = this.GetOpponentPlayer(game, player);

            game.GameOver = GameOver.Resign;
            await this.Clients.Group(game.Id).SendAsync("GameOver", player, game.GameOver);
            await this.GameSendInternalMessage(game.Id, player.Name, null);

            await this.UpdateStatsAsync(opponent, player, game.GameOver);
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
                await this.Clients.Group(game.Id).SendAsync("UpdateStatus", game.MovingPlayer.Name);
            }
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

        private async Task HandleGameOverEventAsync(Game game, Player player, GameOver gameOver)
        {
            var opponent = this.GetOpponentPlayer(game, player);

            await this.Clients.Group(game.Id).SendAsync("GameOver", player, gameOver);
            await this.GameSendInternalMessage(game.Id, player.Name, gameOver.ToString());
            await this.UpdateStatsAsync(player, opponent, gameOver);
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
    }
}

