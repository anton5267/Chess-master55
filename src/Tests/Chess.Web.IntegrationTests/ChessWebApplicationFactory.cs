namespace Chess.Web.IntegrationTests;

using System;
using System.Linq;

using Chess.Data;
using Chess.Web;
using Chess.Web.Infrastructure;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

public class ChessWebApplicationFactory : WebApplicationFactory<Startup>
{
    private readonly string testDatabaseName = $"ChessIntegrationTestsDb-{Guid.NewGuid()}";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<ChessDbContext>>();
            services.RemoveAll<IDbContextOptionsConfiguration<ChessDbContext>>();

            services.AddDbContext<ChessDbContext>(options =>
            {
                options.UseInMemoryDatabase(this.testDatabaseName);
            });

            var hostedServiceDescriptor = services.SingleOrDefault(
                d => d.ImplementationType == typeof(DatabaseInitializationHostedService));
            if (hostedServiceDescriptor != null)
            {
                services.Remove(hostedServiceDescriptor);
            }

            services.AddAuthentication(options =>
                {
                    options.DefaultAuthenticateScheme = "IntegrationTestAuth";
                    options.DefaultChallengeScheme = "IntegrationTestAuth";
                    options.DefaultScheme = "IntegrationTestAuth";
                })
                .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>("IntegrationTestAuth", _ => { });
        });
    }
}
