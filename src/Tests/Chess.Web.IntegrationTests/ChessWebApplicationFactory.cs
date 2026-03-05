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
using Microsoft.Extensions.DependencyInjection;

public class ChessWebApplicationFactory : WebApplicationFactory<Startup>
{
    private readonly string testDatabaseName = $"ChessIntegrationTestsDb-{Guid.NewGuid()}";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            var dbContextDescriptor = services.SingleOrDefault(d => d.ServiceType == typeof(DbContextOptions<ChessDbContext>));
            if (dbContextDescriptor != null)
            {
                services.Remove(dbContextDescriptor);
            }

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
