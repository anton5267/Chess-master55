namespace Chess.Web.Infrastructure.Identity
{
    using System.Threading.Tasks;

    using Chess.Services.Messaging;
    using Chess.Services.Messaging.Contracts;
    using Microsoft.Extensions.Logging;

    public class NoOpEmailSender : IEmailSender
    {
        private readonly ILogger<NoOpEmailSender> logger;

        public NoOpEmailSender(ILogger<NoOpEmailSender> logger)
        {
            this.logger = logger;
        }

        public Task SendEmailAsync(MailMessage mailMessage)
        {
            this.logger.LogWarning(
                "Email sending skipped because SendGridApiKey is missing. Recipient: {Recipient}, Subject: {Subject}",
                mailMessage?.To,
                mailMessage?.Subject);

            return Task.CompletedTask;
        }
    }
}
