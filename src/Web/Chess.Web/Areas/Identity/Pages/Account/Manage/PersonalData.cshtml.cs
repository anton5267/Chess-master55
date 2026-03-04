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
    public class PersonalDataModel : PageModel
    {
        private readonly UserManager<UserEntity> _userManager;
        private readonly ILogger<PersonalDataModel> _logger;
        private readonly IStringLocalizer<SharedResource> localizer;

        public PersonalDataModel(
            UserManager<UserEntity> userManager,
            ILogger<PersonalDataModel> logger,
            IStringLocalizer<SharedResource> localizer)
        {
            _userManager = userManager;
            _logger = logger;
            this.localizer = localizer;
        }

        public async Task<IActionResult> OnGet()
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null)
            {
                return NotFound(this.localizer["Identity_UnableToLoadUser", _userManager.GetUserId(User)]);
            }

            return Page();
        }
    }
}


