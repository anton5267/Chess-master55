namespace Chess.Web.Infrastructure.Identity
{
    using System.Threading.Tasks;

    using Chess.Common.Configuration;
    using Chess.Common.Constants;
    using Chess.Services.Messaging;
    using Chess.Services.Messaging.Contracts;
    using Microsoft.Extensions.Options;

    public class IdentityUiEmailSender : Microsoft.AspNetCore.Identity.UI.Services.IEmailSender
    {
        private readonly IEmailSender emailSender;
        private readonly EmailConfiguration configuration;

        public IdentityUiEmailSender(
            IEmailSender emailSender,
            IOptions<EmailConfiguration> options)
        {
            this.emailSender = emailSender;
            this.configuration = options.Value;
        }

        public Task SendEmailAsync(string email, string subject, string htmlMessage)
        {
            var from = string.IsNullOrWhiteSpace(this.configuration.MyAbvMail)
                ? "no-reply@localhost"
                : this.configuration.MyAbvMail;

            return this.emailSender.SendEmailAsync(
                new MailMessageBuilder()
                    .From(from)
                    .FromName(MailConstants.MyName)
                    .To(email)
                    .Subject(subject)
                    .HtmlContent(htmlMessage)
                    .Build());
        }
    }
}
