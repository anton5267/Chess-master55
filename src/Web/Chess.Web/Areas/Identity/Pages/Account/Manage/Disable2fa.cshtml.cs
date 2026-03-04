using Chess.Data.Models;
using Chess.Web;
// Licensed to the .NET Foundation under one or more agreements.
// The .NET Foundation licenses this file to you under the MIT license.

using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.Extensions.Localization;
using Microsoft.Extensions.Logging;

namespace Chess.Web.Areas.Identity.Pages.Account.Manage
{
    public class Disable2faModel : PageModel
    {
        private readonly UserManager<UserEntity> _userManager;
        private readonly ILogger<Disable2faModel> _logger;
        private readonly IStringLocalizer<SharedResource> localizer;

        public Disable2faModel(
            UserManager<UserEntity> userManager,
            ILogger<Disable2faModel> logger,
            IStringLocalizer<SharedResource> localizer)
        {
            _userManager = userManager;
            _logger = logger;
            this.localizer = localizer;
        }

        /// <summary>
        ///     This API supports the ASP.NET Core Identity default UI infrastructure and is not intended to be used
        ///     directly from your code. This API may change or be removed in future releases.
        /// </summary>
        [TempData]
        public string StatusMessage { get; set; }

        public async Task<IActionResult> OnGet()
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null)
            {
                return NotFound(this.localizer["Identity_UnableToLoadUser", _userManager.GetUserId(User)]);
            }

            if (!await _userManager.GetTwoFactorEnabledAsync(user))
            {
                throw new InvalidOperationException(this.localizer["Manage_CannotDisable2fa"]);
            }

            return Page();
        }

        public async Task<IActionResult> OnPostAsync()
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null)
            {
                return NotFound(this.localizer["Identity_UnableToLoadUser", _userManager.GetUserId(User)]);
            }

            var disable2faResult = await _userManager.SetTwoFactorEnabledAsync(user, false);
            if (!disable2faResult.Succeeded)
            {
                throw new InvalidOperationException(this.localizer["Manage_Disable2faUnexpectedError"]);
            }

            _logger.LogInformation("User with ID '{UserId}' has disabled 2fa.", _userManager.GetUserId(User));
            StatusMessage = this.localizer["Manage_2faDisabledStatus"];
            return RedirectToPage("./TwoFactorAuthentication");
        }
    }
}


