namespace Chess.Web.IntegrationTests;

using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Threading.Tasks;

using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

public class TestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    public const string HeaderName = "X-Test-Auth";
    public const string UserIdHeaderName = "X-Test-UserId";
    public const string UserNameHeaderName = "X-Test-UserName";
    public const string UserId = "test-user";
    public const string UserName = "tester@example.com";

    public TestAuthHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder)
        : base(options, logger, encoder)
    {
    }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!this.Request.Headers.TryGetValue(HeaderName, out var headerValue) || headerValue != "1")
        {
            return Task.FromResult(AuthenticateResult.NoResult());
        }

        var userId = this.Request.Headers.TryGetValue(UserIdHeaderName, out var incomingUserId)
            ? incomingUserId.ToString()
            : UserId;
        var userName = this.Request.Headers.TryGetValue(UserNameHeaderName, out var incomingUserName)
            ? incomingUserName.ToString()
            : UserName;

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, userId),
            new Claim(ClaimTypes.Name, userName),
            new Claim(ClaimTypes.Email, userName),
        };

        var identity = new ClaimsIdentity(claims, this.Scheme.Name);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, this.Scheme.Name);

        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}
