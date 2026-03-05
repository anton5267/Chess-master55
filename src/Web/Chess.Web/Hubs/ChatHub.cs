namespace Chess.Web.Hubs
{
    using System;
    using System.Runtime.CompilerServices;
    using System.Threading.Tasks;

    using Chess.Common.Enums;
    using Microsoft.AspNetCore.SignalR;

    public partial class GameHub
    {
        public async Task LobbySendMessage(string message)
        {
            this.EnsureAuthenticatedUserContext();
            var normalizedMessage = this.ValidateAndNormalizeChatMessage(message);
            var msgFormat = $"{this.GetTimestamp()}, {this.Context.User.Identity.Name}: {normalizedMessage}";
            await this.Clients.All.SendAsync("UpdateLobbyChat", msgFormat);
        }

        public async Task GameSendMessage(string message)
        {
            var normalizedMessage = this.ValidateAndNormalizeChatMessage(message);
            var player = this.GetPlayer();
            var game = this.GetGame();

            var msgFormat = $"{this.GetTimestamp()}, {player.Name}: {normalizedMessage}";
            await this.Clients.Group(game.Id).SendAsync("UpdateGameChat", msgFormat, player);
        }

        private async Task LobbySendInternalMessage(string name, [CallerMemberName] string caller = "")
        {
            var message = string.Empty;
            switch (caller)
            {
                case nameof(this.OnConnectedAsync):
                    message = this.localizer["Hub_LobbyJoinedFormat", name];
                    break;
                case nameof(this.CreateRoom):
                    message = this.localizer["Hub_LobbyRoomCreatedFormat", name];
                    break;
            }

            if (!string.IsNullOrEmpty(message))
            {
                await this.Clients.All.SendAsync("UpdateLobbyChatInternalMessage", message);
            }
        }

        private async Task GameSendInternalMessage(string gameId, string name, string gameOver, [CallerMemberName] string caller = "")
        {
            var message = string.Empty;
            switch (caller)
            {
                case nameof(this.HandleMoveEvent):
                    message = this.localizer["Hub_GameCheckAnnouncedByFormat", name];
                    break;
                case nameof(this.StartGame):
                    message = this.localizer["Hub_GameStartedByJoinFormat", name];
                    break;
                case nameof(this.HandleGameOverEventAsync):
                    message = this.LocalizeGameOverMessage(gameOver);
                    break;
                case nameof(this.Resign):
                    message = this.localizer["Hub_GameResignedFormat", name];
                    break;
                case nameof(this.OfferDrawRequest):
                    message = this.localizer["Hub_GameDrawRequestedFormat", name];
                    break;
                case nameof(this.OfferDrawAnswer):
                    if (Enum.TryParse<GameOver>(gameOver, ignoreCase: true, out var drawOfferResult) &&
                        drawOfferResult == GameOver.Draw)
                    {
                        message = this.localizer["Hub_GameDrawAcceptedFormat", name];
                    }
                    else
                    {
                        message = this.localizer["Hub_GameDrawRejectedFormat", name];
                    }

                    break;
                case nameof(this.OnDisconnectedAsync):
                    message = this.localizer["Hub_PlayerLeftYouWinFormat", name];
                    break;
                case nameof(this.ThreefoldDraw):
                    message = this.localizer["Hub_GameThreefoldDeclaredFormat", name];
                    break;
            }

            if (!string.IsNullOrEmpty(message))
            {
                await this.Clients.Group(gameId).SendAsync("UpdateGameChatInternalMessage", message);
            }
        }

        private string LocalizeGameOverMessage(string gameOver)
        {
            if (!Enum.TryParse<GameOver>(gameOver, ignoreCase: true, out var parsedGameOver))
            {
                return gameOver;
            }

            return parsedGameOver switch
            {
                GameOver.Checkmate => this.localizer["Hub_GameOver_Checkmate"],
                GameOver.Stalemate => this.localizer["Hub_GameOver_Stalemate"],
                GameOver.Draw => this.localizer["Hub_GameOver_Draw"],
                GameOver.ThreefoldDraw => this.localizer["Hub_GameOver_ThreefoldDraw"],
                GameOver.FivefoldDraw => this.localizer["Hub_GameOver_FivefoldDraw"],
                GameOver.Resign => this.localizer["Hub_GameOver_Resign"],
                GameOver.Disconnected => this.localizer["Hub_GameOver_Disconnected"],
                GameOver.FiftyMoveDraw => this.localizer["Hub_GameOver_FiftyMoveDraw"],
                _ => gameOver,
            };
        }
    }
}

