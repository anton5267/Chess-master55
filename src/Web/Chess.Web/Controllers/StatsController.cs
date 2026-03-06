namespace Chess.Web.Controllers
{
    using System;
    using System.Linq;
    using System.Security.Claims;
    using System.Threading.Tasks;

    using Chess.Data.Models;
    using Chess.Services.Data.Services.Contracts;
    using Chess.Web.ViewModels;
    using Microsoft.AspNetCore.Authorization;
    using Microsoft.AspNetCore.Identity;
    using Microsoft.AspNetCore.Mvc;

    [Authorize]
    public class StatsController : BaseController
    {
        private readonly IStatsService statsService;
        private readonly UserManager<UserEntity> userManager;

        public StatsController(IStatsService statsService, UserManager<UserEntity> userManager)
        {
            this.statsService = statsService;
            this.userManager = userManager;
        }

        public async Task<IActionResult> Index()
        {
            var userId = this.User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrWhiteSpace(userId))
            {
                return this.RedirectToAction("Index", "Home");
            }

            var stats = this.statsService.GetUserStats<UserStatsViewModel>(userId);

            if (stats == null)
            {
                await this.statsService.InitiateStatsAsync(userId);
                stats = this.statsService.GetUserStats<UserStatsViewModel>(userId);
            }

            if (stats == null)
            {
                return this.RedirectToAction("Index", "Home");
            }

            var mostGamesUser = this.statsService.GetMostGamesUser();
            var mostWinsUser = this.statsService.GetMostWinsUser();

            var model = new StatsViewModel
            {
                UserName = this.User.Identity.Name,
                UserStats = stats,
                TotalUsers = this.userManager.Users.Count(),
                LastThirtyDaysRegisteredUsers = this.userManager.Users.Where(x => x.CreatedOn >= DateTime.UtcNow.AddDays(-30)).Count(),
                TotalGames = this.statsService.GetTotalGames(),
                MostGamesUser = string.IsNullOrWhiteSpace(mostGamesUser) ? string.Empty : mostGamesUser,
                MostWinsUser = string.IsNullOrWhiteSpace(mostWinsUser) ? string.Empty : mostWinsUser,
            };

            return this.View(model);
        }
    }
}
