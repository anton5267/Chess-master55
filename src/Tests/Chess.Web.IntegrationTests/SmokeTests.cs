namespace Chess.Web.IntegrationTests;

using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

using Chess.Data;
using Chess.Data.Models;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

public class SmokeTests : IClassFixture<ChessWebApplicationFactory>
{
    private readonly HttpClient client;
    private readonly ChessWebApplicationFactory factory;

    public SmokeTests(ChessWebApplicationFactory factory)
    {
        this.factory = factory;
        this.client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
        });
    }

    [Fact]
    public async Task Home_ShouldOpenSuccessfully()
    {
        var response = await this.client.GetAsync("/");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Healthz_ShouldOpenSuccessfully()
    {
        var response = await this.client.GetAsync("/healthz");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task HealthzLive_ShouldOpenSuccessfully()
    {
        var response = await this.client.GetAsync("/healthz/live");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task HealthzReady_ShouldOpenSuccessfully()
    {
        var response = await this.client.GetAsync("/healthz/ready");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Home_ShouldContainBaselineSecurityHeaders()
    {
        var response = await this.client.GetAsync("/");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Headers.TryGetValues("X-Content-Type-Options", out var nosniffValues).Should().BeTrue();
        nosniffValues.Should().ContainSingle(x => x == "nosniff");
        response.Headers.TryGetValues("X-Frame-Options", out var frameOptionsValues).Should().BeTrue();
        frameOptionsValues.Should().ContainSingle(x => x == "SAMEORIGIN");
        response.Headers.TryGetValues("Referrer-Policy", out var referrerValues).Should().BeTrue();
        referrerValues.Should().ContainSingle(x => x == "strict-origin-when-cross-origin");
    }

    [Theory]
    [InlineData("en", "Home", "Play")]
    [InlineData("uk", "додому", "грати")]
    [InlineData("de", "Heim", "Spielen")]
    [InlineData("pl", "Dom", "Grać")]
    [InlineData("es", "Hogar", "Jugar")]
    public async Task Home_ShouldHonorAcceptLanguage(string culture, string homeMarker, string playMarker)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/");
        request.Headers.AcceptLanguage.Add(new StringWithQualityHeaderValue(culture));

        var response = await this.client.SendAsync(request);
        var html = await response.Content.ReadAsStringAsync();
        var decodedHtml = WebUtility.HtmlDecode(html);

        response.StatusCode.Should().Be(HttpStatusCode.OK, because: decodedHtml);
        decodedHtml.Should().Contain(homeMarker);
        decodedHtml.Should().Contain(playMarker);
    }

    [Fact]
    public async Task Home_ShouldRenderAutonymLanguageOptions()
    {
        var response = await this.client.GetAsync("/");
        var html = await response.Content.ReadAsStringAsync();
        var decodedHtml = WebUtility.HtmlDecode(html);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        decodedHtml.Should().Contain(">English<");
        decodedHtml.Should().Contain(">Українська<");
        decodedHtml.Should().Contain(">Deutsch<");
        decodedHtml.Should().Contain(">Polski<");
        decodedHtml.Should().Contain(">Español<");
    }

    [Fact]
    public async Task SetLanguage_ShouldSetCultureCookie_AndRedirect()
    {
        var antiForgery = await this.GetAntiForgeryAsync();
        var request = new HttpRequestMessage(HttpMethod.Post, "/localization/set-language");
        request.Headers.Add("Cookie", antiForgery.CookieHeader);
        request.Content = new FormUrlEncodedContent(new[]
        {
            new KeyValuePair<string, string>("culture", "de"),
            new KeyValuePair<string, string>("returnUrl", "/"),
            new KeyValuePair<string, string>("__RequestVerificationToken", antiForgery.Token),
        });

        var response = await this.client.SendAsync(request);

        response.StatusCode.Should().Be(HttpStatusCode.Redirect);
        response.Headers.Location?.ToString().Should().Be("/");
        response.Headers.TryGetValues("Set-Cookie", out var responseCookies).Should().BeTrue();
        responseCookies!.Any(x => x.Contains(".AspNetCore.Culture", StringComparison.Ordinal)).Should().BeTrue();
    }

    [Fact]
    public async Task SetLanguage_ShouldRejectUnsupportedCulture()
    {
        var antiForgery = await this.GetAntiForgeryAsync();
        var request = new HttpRequestMessage(HttpMethod.Post, "/localization/set-language");
        request.Headers.Add("Cookie", antiForgery.CookieHeader);
        request.Content = new FormUrlEncodedContent(new[]
        {
            new KeyValuePair<string, string>("culture", "fr"),
            new KeyValuePair<string, string>("returnUrl", "/"),
            new KeyValuePair<string, string>("__RequestVerificationToken", antiForgery.Token),
        });

        var response = await this.client.SendAsync(request);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task SetLanguage_ShouldIgnoreExternalReturnUrl()
    {
        var antiForgery = await this.GetAntiForgeryAsync();
        var request = new HttpRequestMessage(HttpMethod.Post, "/localization/set-language");
        request.Headers.Add("Cookie", antiForgery.CookieHeader);
        request.Content = new FormUrlEncodedContent(new[]
        {
            new KeyValuePair<string, string>("culture", "uk"),
            new KeyValuePair<string, string>("returnUrl", "https://evil.example"),
            new KeyValuePair<string, string>("__RequestVerificationToken", antiForgery.Token),
        });

        var response = await this.client.SendAsync(request);

        response.StatusCode.Should().Be(HttpStatusCode.Redirect);
        response.Headers.Location?.ToString().Should().Be("/");
    }

    [Theory]
    [InlineData("en", "Log in", "Register", "Use another service to register.")]
    [InlineData("uk", "авторизуватися", "зареєструватися", "Для реєстрації скористайтеся іншим сервісом.")]
    [InlineData("de", "Einloggen", "Registrieren", "Nutzen Sie für die Registrierung einen anderen Dienst.")]
    [InlineData("pl", "Zaloguj się", "Rejestr", "Aby się zarejestrować, skorzystaj z innej usługi.")]
    [InlineData("es", "Acceso", "Registro", "Utilice otro servicio para registrarse.")]
    public async Task Login_And_Register_ShouldRenderLocalizedText(string culture, string loginTitle, string registerTitle, string registerExternalMarker)
    {
        var loginRequest = new HttpRequestMessage(HttpMethod.Get, "/Identity/Account/Login");
        loginRequest.Headers.AcceptLanguage.Add(new StringWithQualityHeaderValue(culture));
        var loginResponse = await this.client.SendAsync(loginRequest);
        var loginHtml = await loginResponse.Content.ReadAsStringAsync();
        var decodedLoginHtml = WebUtility.HtmlDecode(loginHtml);

        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        decodedLoginHtml.Should().Contain(loginTitle);

        var registerRequest = new HttpRequestMessage(HttpMethod.Get, "/Identity/Account/Register");
        registerRequest.Headers.AcceptLanguage.Add(new StringWithQualityHeaderValue(culture));
        var registerResponse = await this.client.SendAsync(registerRequest);
        var registerHtml = await registerResponse.Content.ReadAsStringAsync();
        var decodedRegisterHtml = WebUtility.HtmlDecode(registerHtml);

        registerResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        decodedRegisterHtml.Should().Contain(registerTitle);
        decodedRegisterHtml.Should().Contain(registerExternalMarker);
    }

    [Fact]
    public async Task About_ShouldNotContainPersonalContactBlock()
    {
        var response = await this.client.GetAsync("/About");
        var html = await response.Content.ReadAsStringAsync();
        var decodedHtml = WebUtility.HtmlDecode(html);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        decodedHtml.Should().NotContain("Anton Lyshtva");
        decodedHtml.Should().NotContain("antonlistva47@gmail.com");
        decodedHtml.Should().NotContain("Chess.Web -");
        decodedHtml.Should().NotContain("Chess.Console -");
    }

    [Fact]
    public async Task Stats_ShouldRenderCleanUtf8AndMappedValues_ForAuthenticatedUser()
    {
        await this.SeedAuthenticatedUserAsync();

        var request = new HttpRequestMessage(HttpMethod.Get, "/Stats");
        request.Headers.Add(TestAuthHandler.HeaderName, "1");

        var response = await this.client.SendAsync(request);
        var html = await response.Content.ReadAsStringAsync();
        var decodedHtml = WebUtility.HtmlDecode(html);

        response.StatusCode.Should().Be(HttpStatusCode.OK, because: decodedHtml);
        decodedHtml.Should().Contain("1440");
        decodedHtml.Should().NotContain("&#x");
        decodedHtml.Should().NotContain("&amp;#x");
        decodedHtml.Should().Contain("stats-data");
        decodedHtml.Should().Contain("stats-pie-chart");
    }

    [Fact]
    public async Task Game_ShouldRenderHintToggles_ForAuthenticatedUser()
    {
        await this.SeedAuthenticatedUserAsync();

        var request = new HttpRequestMessage(HttpMethod.Get, "/Game");
        request.Headers.Add(TestAuthHandler.HeaderName, "1");

        var response = await this.client.SendAsync(request);
        var html = await response.Content.ReadAsStringAsync();
        var decodedHtml = WebUtility.HtmlDecode(html);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        decodedHtml.Should().Contain("check-hints-toggle");
        decodedHtml.Should().Contain("legal-moves-toggle");
        decodedHtml.Should().Contain("game-lobby-input-vs-bot-btn");
        decodedHtml.Should().Contain("bot-difficulty-select");
        decodedHtml.Should().Contain("game-play-again-btn");
        decodedHtml.Should().Contain("game-result-banner");
    }

    [Fact]
    public async Task GameBundle_ShouldContainTerminalLockMarkers()
    {
        var response = await this.client.GetAsync("/js/game.bundle.js");
        var script = await response.Content.ReadAsStringAsync();

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        script.Should().Contain("hasGameEnded");
        script.Should().Contain("gameOverCode");
        script.Should().Contain("gameOverWinnerName");
        script.Should().NotContain("alert(");
    }

    [Fact]
    public async Task LegacyGameScript_ShouldBridgeToModernBundle()
    {
        var response = await this.client.GetAsync("/js/game.js");
        var script = await response.Content.ReadAsStringAsync();

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        script.Should().Contain("__chessLegacyGameBridgeLoaded");
        script.Should().Contain("/js/game.bundle.js");
        script.Should().NotContain("alert(");
    }

    [Fact]
    public async Task Manage_ShouldRenderModernShell_ForAuthenticatedUser()
    {
        await this.SeedAuthenticatedUserAsync();

        var request = new HttpRequestMessage(HttpMethod.Get, "/Identity/Account/Manage");
        request.Headers.Add(TestAuthHandler.HeaderName, "1");

        var response = await this.client.SendAsync(request);
        var html = await response.Content.ReadAsStringAsync();

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        html.Should().Contain("manage-shell");
        html.Should().Contain("manage-user-chip");
        html.Should().Contain("manage-shell-content");
    }

    [Fact]
    public async Task Layout_ShouldIncludePasswordToggleScript()
    {
        var response = await this.client.GetAsync("/Identity/Account/Login");
        var html = await response.Content.ReadAsStringAsync();

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        html.Should().Contain("/js/password-toggle.js");
        html.Should().Contain("data-show-password-text");
        html.Should().Contain("data-hide-password-text");
    }

    [Fact]
    public async Task Hub_ShouldRejectAnonymousNegotiateRequest()
    {
        using var payload = new StringContent("{}", Encoding.UTF8, "application/json");

        var response = await this.client.PostAsync("/hub/negotiate?negotiateVersion=1", payload);

        response.StatusCode.Should().BeOneOf(HttpStatusCode.Unauthorized, HttpStatusCode.Redirect, HttpStatusCode.Found);
    }

    private async Task<(string Token, string CookieHeader)> GetAntiForgeryAsync()
    {
        var landing = await this.client.GetAsync("/");
        var landingHtml = await landing.Content.ReadAsStringAsync();

        var tokenMatch = Regex.Match(
            landingHtml,
            "name=\"__RequestVerificationToken\" type=\"hidden\" value=\"([^\"]+)\"",
            RegexOptions.IgnoreCase);
        tokenMatch.Success.Should().BeTrue();

        var antiForgeryCookie = landing.Headers.TryGetValues("Set-Cookie", out var setCookieValues)
            ? setCookieValues.FirstOrDefault(x => x.Contains(".AspNetCore.Antiforgery", StringComparison.Ordinal))
            : null;

        antiForgeryCookie.Should().NotBeNullOrEmpty();

        return (tokenMatch.Groups[1].Value, antiForgeryCookie!.Split(';')[0]);
    }

    private async Task SeedAuthenticatedUserAsync()
    {
        await using var scope = this.factory.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ChessDbContext>();

        if (!await dbContext.Users.AnyAsync(x => x.Id == TestAuthHandler.UserId))
        {
            dbContext.Users.Add(new UserEntity
            {
                Id = TestAuthHandler.UserId,
                UserName = TestAuthHandler.UserName,
                NormalizedUserName = TestAuthHandler.UserName.ToUpperInvariant(),
                Email = TestAuthHandler.UserName,
                NormalizedEmail = TestAuthHandler.UserName.ToUpperInvariant(),
                CreatedOn = DateTime.UtcNow,
                SecurityStamp = Guid.NewGuid().ToString("N"),
            });
        }

        if (!await dbContext.Stats.AnyAsync(x => x.UserId == TestAuthHandler.UserId))
        {
            dbContext.Stats.Add(new StatisticEntity
            {
                UserId = TestAuthHandler.UserId,
                Played = 18,
                Won = 10,
                Drawn = 4,
                Lost = 4,
                EloRating = 1440,
                CreatedOn = DateTime.UtcNow,
            });
        }

        await dbContext.SaveChangesAsync();
    }
}
