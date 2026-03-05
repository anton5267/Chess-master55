namespace Chess.Web.Infrastructure.HealthChecks
{
    using System;
    using System.Threading;
    using System.Threading.Tasks;

    using Chess.Data;
    using Microsoft.EntityFrameworkCore;
    using Microsoft.Extensions.Diagnostics.HealthChecks;

    public sealed class DatabaseHealthCheck : IHealthCheck
    {
        private readonly ChessDbContext dbContext;

        public DatabaseHealthCheck(ChessDbContext dbContext)
        {
            this.dbContext = dbContext;
        }

        public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
        {
            try
            {
                _ = await this.dbContext.Users.AsNoTracking().AnyAsync(cancellationToken);
                return HealthCheckResult.Healthy("Database query succeeded.");
            }
            catch (Exception ex)
            {
                return HealthCheckResult.Unhealthy("Database query failed.", ex);
            }
        }
    }
}
