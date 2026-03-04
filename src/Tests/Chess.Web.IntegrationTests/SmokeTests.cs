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

using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

public class SmokeTests : IClassFixture<ChessWebApplicationFactory>
{
    private readonly HttpClient client;

    public SmokeTests(ChessWebApplicationFactory factory)
    {
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

        response.StatusCode.Should().Be(HttpStatusCode.OK);
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
}
