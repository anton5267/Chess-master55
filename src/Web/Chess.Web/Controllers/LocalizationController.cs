namespace Chess.Web.Controllers
{
    using System.Linq;

    using Chess.Web.Infrastructure;
    using Microsoft.AspNetCore.Authorization;
    using Microsoft.AspNetCore.Http;
    using Microsoft.AspNetCore.Localization;
    using Microsoft.AspNetCore.Mvc;

    [AllowAnonymous]
    [Route("localization")]
    public class LocalizationController : Controller
    {
        [HttpPost("set-language")]
        [ValidateAntiForgeryToken]
        public IActionResult SetLanguage(string culture, string returnUrl)
        {
            if (string.IsNullOrWhiteSpace(culture) ||
                !LocalizationConstants.SupportedCultures.Contains(culture))
            {
                return this.BadRequest("Unsupported culture.");
            }

            if (string.IsNullOrWhiteSpace(returnUrl) || !this.Url.IsLocalUrl(returnUrl))
            {
                returnUrl = this.Url.Content("~/");
            }

            var cookieValue = CookieRequestCultureProvider.MakeCookieValue(new RequestCulture(culture));
            this.Response.Cookies.Append(
                CookieRequestCultureProvider.DefaultCookieName,
                cookieValue,
                new Microsoft.AspNetCore.Http.CookieOptions
                {
                    IsEssential = true,
                    HttpOnly = false,
                    Secure = this.Request.IsHttps,
                    SameSite = SameSiteMode.Lax,
                });

            return this.LocalRedirect(returnUrl);
        }
    }
}
