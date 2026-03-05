namespace Chess.Web
{
    using System;
    using System.Collections.Generic;
    using System.Globalization;
    using System.Linq;
    using System.Reflection;

    using Chess.Common.Configuration;
    using Chess.Common.Extensions;
    using Chess.Common.Time;
    using Chess.Data;
    using Chess.Data.Common;
    using Chess.Data.Common.Repositories;
    using Chess.Data.Models;
    using Chess.Data.Repositories;
    using Chess.Services.Data.Services;
    using Chess.Services.Data.Services.Contracts;
    using Chess.Services.Mapping;
    using Chess.Services.Messaging;
    using Chess.Services.Messaging.Contracts;
    using Chess.Web.Hubs.Bot;
    using Chess.Web.Hubs;
    using Chess.Web.Hubs.Sessions;
    using Chess.Web.Infrastructure.HealthChecks;
    using Chess.Web.Infrastructure;
    using Chess.Web.Infrastructure.Identity;
    using Chess.Web.ViewModels;
    using Microsoft.AspNetCore.Builder;
    using Microsoft.AspNetCore.Diagnostics.HealthChecks;
    using Microsoft.AspNetCore.Hosting;
    using Microsoft.AspNetCore.Http;
    using Microsoft.AspNetCore.Localization;
    using Microsoft.AspNetCore.Mvc;
    using Microsoft.AspNetCore.Mvc.Razor;
    using Microsoft.EntityFrameworkCore;
    using Microsoft.Extensions.Configuration;
    using Microsoft.Extensions.DependencyInjection;
    using Microsoft.Extensions.Diagnostics.HealthChecks;
    using Microsoft.Extensions.Hosting;

    public class Startup
    {
        private readonly IConfiguration configuration;

        public Startup(IConfiguration configuration)
        {
            this.configuration = configuration;
        }

        public void ConfigureServices(IServiceCollection services)
        {
            this.AddDatabase(services);
            this.AddLocalization(services);
            this.AddIdentity(services);
            this.AddCookiePolicy(services);
            this.AddControllers(services);
            this.AddSettings(services);
            this.AddSignalR(services);
            this.AddRepositories(services);
            this.AddServices(services);
            services.AddHealthChecks()
                .AddCheck("self", () => HealthCheckResult.Healthy(), tags: new[] { "live" })
                .AddCheck<DatabaseHealthCheck>("database", tags: new[] { "ready" });
            services.AddDatabaseDeveloperPageExceptionFilter();
            this.AddRazorPages(services);
        }

        public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
        {
            AutoMapperConfig.RegisterMappings(typeof(ErrorViewModel).GetTypeInfo().Assembly);

            if (env.IsDevelopment())
            {
                app.UseDeveloperExceptionPage();
                app.UseMigrationsEndPoint();
            }
            else
            {
                app.UseExceptionHandler("/Home/Error");
                app.UseHsts();
            }

            app.Use(async (context, next) =>
            {
                context.Response.Headers["X-Content-Type-Options"] = "nosniff";
                context.Response.Headers["X-Frame-Options"] = "SAMEORIGIN";
                context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";

                await next();
            });

            app.UseHttpsRedirection();
            app.UseStaticFiles();
            app.UseCookiePolicy();
            app.UseRequestLocalization(this.GetRequestLocalizationOptions());

            app.UseRouting();

            app.UseAuthentication();
            app.UseAuthorization();

            app.UseEndpoints(
                endpoints =>
                    {
                        endpoints.MapControllerRoute("areaRoute", "{area:exists}/{controller=Home}/{action=Index}/{id?}");
                        endpoints.MapControllerRoute("default", "{controller=Home}/{action=Index}/{id?}");
                        endpoints.MapRazorPages();
                        endpoints.MapHub<GameHub>("/hub").RequireAuthorization();
                        endpoints.MapHealthChecks("/healthz");
                        endpoints.MapHealthChecks("/healthz/live", new HealthCheckOptions
                        {
                            Predicate = check => check.Tags.Contains("live"),
                        });
                        endpoints.MapHealthChecks("/healthz/ready", new HealthCheckOptions
                        {
                            Predicate = check => check.Tags.Contains("ready"),
                        });
                    });
        }

        private void AddDatabase(IServiceCollection services)
        {
            services.AddDbContext<ChessDbContext>(options => options.UseSqlServer(
                Environment.GetEnvironmentVariable("CONNECTION_STRING") ?? this.configuration.GetChessDbConnectionString(),
                options => options.EnableRetryOnFailure()));
        }

        private void AddIdentity(IServiceCollection services)
        {
            services.AddDefaultIdentity<UserEntity>(IdentityOptionsProvider.GetIdentityOptions)
                .AddRoles<RoleEntity>()
                .AddEntityFrameworkStores<ChessDbContext>()
                .AddErrorDescriber<LocalizedIdentityErrorDescriber>();
        }

        private void AddCookiePolicy(IServiceCollection services)
        {
            services.Configure<CookiePolicyOptions>(
                            options =>
                            {
                                options.CheckConsentNeeded = context => true;
                                options.MinimumSameSitePolicy = SameSiteMode.None;
                            });
        }

        private void AddControllers(IServiceCollection services)
        {
            services.AddControllersWithViews(options =>
            {
                options.Filters.Add(new AutoValidateAntiforgeryTokenAttribute());
            })
            .AddViewLocalization(LanguageViewLocationExpanderFormat.Suffix)
            .AddDataAnnotationsLocalization(options =>
            {
                options.DataAnnotationLocalizerProvider = (_, factory) => factory.Create(typeof(SharedResource));
            });
        }

        private void AddLocalization(IServiceCollection services)
        {
            services.AddLocalization(options => options.ResourcesPath = "Resources");
        }

        private void AddRazorPages(IServiceCollection services)
        {
            services.AddRazorPages()
                .AddViewLocalization(LanguageViewLocationExpanderFormat.Suffix)
                .AddDataAnnotationsLocalization(options =>
                {
                    options.DataAnnotationLocalizerProvider = (_, factory) => factory.Create(typeof(SharedResource));
                });
        }

        private void AddSettings(IServiceCollection services)
        {
            services.Configure<EmailConfiguration>(this.configuration.GetEmailConfigurationSection());
        }

        private void AddSignalR(IServiceCollection services)
        {
            services.AddSignalR();
            services.AddSingleton<IClock, SystemClock>();
            services.AddSingleton<IGameSessionStore, InMemoryGameSessionStore>();
        }

        private void AddRepositories(IServiceCollection services)
        {
            services.AddScoped(typeof(IDeletableEntityRepository<>), typeof(EfDeletableEntityRepository<>));
            services.AddScoped(typeof(IRepository<>), typeof(EfRepository<>));
        }

        private void AddServices(IServiceCollection services)
        {
            services.AddTransient<IEmailSender>(x =>
                new SendGridEmailSender(this.configuration.GetValue<string>("SendGridApiKey")));
            services.AddTransient<Microsoft.AspNetCore.Identity.UI.Services.IEmailSender, IdentityUiEmailSender>();
            services.AddTransient<IBoardFenSerializer, BoardFenSerializer>();
            services.AddTransient<IGameService, GameService>();
            services.AddTransient<IStatsService, StatsService>();
            services.AddTransient<IDrawService, DrawService>();
            services.AddTransient<ICheckService, CheckService>();
            services.AddTransient<IUtilityService, UtilityService>();
            services.AddSingleton<IBotMoveSelector, RandomLegalMoveSelector>();
            services.AddSingleton<INotificationService, NotificationService>();
            services.AddHostedService<DatabaseInitializationHostedService>();
        }

        private RequestLocalizationOptions GetRequestLocalizationOptions()
        {
            var supportedCultures = LocalizationConstants.SupportedCultures
                .Select(culture => new CultureInfo(culture))
                .ToList();

            return new RequestLocalizationOptions
            {
                DefaultRequestCulture = new RequestCulture(LocalizationConstants.DefaultCulture),
                SupportedCultures = supportedCultures,
                SupportedUICultures = supportedCultures,
                FallBackToParentCultures = true,
                FallBackToParentUICultures = true,
                RequestCultureProviders = new List<IRequestCultureProvider>
                {
                    new CookieRequestCultureProvider(),
                    new AcceptLanguageHeaderRequestCultureProvider(),
                },
            };
        }
    }
}
