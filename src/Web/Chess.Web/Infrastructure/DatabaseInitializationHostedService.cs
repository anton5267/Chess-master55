namespace Chess.Web.Infrastructure
{
    using System;
    using System.Threading;
    using System.Threading.Tasks;

    using Chess.Data;
    using Chess.Data.Seeding;
    using Microsoft.AspNetCore.Hosting;
    using Microsoft.EntityFrameworkCore;
    using Microsoft.Extensions.DependencyInjection;
    using Microsoft.Extensions.Hosting;
    using Microsoft.Extensions.Logging;

    public class DatabaseInitializationHostedService : IHostedService
    {
        private readonly IServiceProvider serviceProvider;
        private readonly IWebHostEnvironment environment;
        private readonly ILogger<DatabaseInitializationHostedService> logger;

        public DatabaseInitializationHostedService(
            IServiceProvider serviceProvider,
            IWebHostEnvironment environment,
            ILogger<DatabaseInitializationHostedService> logger)
        {
            this.serviceProvider = serviceProvider;
            this.environment = environment;
            this.logger = logger;
        }

        public async Task StartAsync(CancellationToken cancellationToken)
        {
            using var scope = this.serviceProvider.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<ChessDbContext>();

            if (this.environment.IsDevelopment())
            {
                await dbContext.Database.MigrateAsync(cancellationToken);
            }

            await new ChessDbContextSeeder().SeedAsync(dbContext, scope.ServiceProvider);
            this.logger.LogInformation("Database migration and seeding completed.");
        }

        public Task StopAsync(CancellationToken cancellationToken)
        {
            return Task.CompletedTask;
        }
    }
}
