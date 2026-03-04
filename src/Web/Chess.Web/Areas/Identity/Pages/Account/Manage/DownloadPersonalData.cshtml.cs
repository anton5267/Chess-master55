using Chess.Data.Models;
using Chess.Web;
// Licensed to the .NET Foundation under one or more agreements.
// The .NET Foundation licenses this file to you under the MIT license.

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.Extensions.Localization;
using Microsoft.Extensions.Logging;

namespace Chess.Web.Areas.Identity.Pages.Account.Manage
{
    public class DownloadPersonalDataModel : PageModel
    {
        private readonly UserManager<UserEntity> _userManager;
        private readonly ILogger<DownloadPersonalDataModel> _logger;
        private readonly IStringLocalizer<SharedResource> localizer;

        public DownloadPersonalDataModel(
            UserManager<UserEntity> userManager,
            ILogger<DownloadPersonalDataModel> logger,
            IStringLocalizer<SharedResource> localizer)
        {
            _userManager = userManager;
            _logger = logger;
            this.localizer = localizer;
        }

        public IActionResult OnGet()
        {
            return NotFound();
        }

        public async Task<IActionResult> OnPostAsync()
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null)
            {
                return NotFound(this.localizer["Identity_UnableToLoadUser", _userManager.GetUserId(User)]);
            }

            _logger.LogInformation("User with ID '{UserId}' asked for their personal data.", _userManager.GetUserId(User));

            // Only include personal data for download
            var personalData = new Dictionary<string, string>();
            var personalDataProps = typeof(UserEntity).GetProperties().Where(
                            prop => Attribute.IsDefined(prop, typeof(PersonalDataAttribute)));
            foreach (var p in personalDataProps)
            {
                personalData.Add(p.Name, p.GetValue(user)?.ToString() ?? this.localizer["Manage_NullValue"]);
            }

            var logins = await _userManager.GetLoginsAsync(user);
            foreach (var l in logins)
            {
                personalData.Add($"{l.LoginProvider} {this.localizer["Manage_ExternalLoginProviderKey"]}", l.ProviderKey);
            }

            personalData.Add(this.localizer["Manage_AuthenticatorKey"], await _userManager.GetAuthenticatorKeyAsync(user));

            Response.Headers.TryAdd("Content-Disposition", $"attachment; filename={this.localizer["Manage_PersonalDataFileName"]}");
            return new FileContentResult(JsonSerializer.SerializeToUtf8Bytes(personalData), "application/json");
        }
    }
}


