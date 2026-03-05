namespace Chess.Web.Infrastructure.Identity
{
    using Chess.Web;
    using Microsoft.AspNetCore.Identity;
    using Microsoft.Extensions.Localization;

    public class LocalizedIdentityErrorDescriber : IdentityErrorDescriber
    {
        private readonly IStringLocalizer<SharedResource> localizer;

        public LocalizedIdentityErrorDescriber(IStringLocalizer<SharedResource> localizer)
        {
            this.localizer = localizer;
        }

        public override IdentityError DefaultError() => this.Create(nameof(this.DefaultError));

        public override IdentityError ConcurrencyFailure() => this.Create(nameof(this.ConcurrencyFailure));

        public override IdentityError PasswordMismatch() => this.Create(nameof(this.PasswordMismatch));

        public override IdentityError InvalidToken() => this.Create(nameof(this.InvalidToken));

        public override IdentityError LoginAlreadyAssociated() => this.Create(nameof(this.LoginAlreadyAssociated));

        public override IdentityError InvalidUserName(string userName) => this.Create(nameof(this.InvalidUserName), userName);

        public override IdentityError InvalidEmail(string email) => this.Create(nameof(this.InvalidEmail), email);

        public override IdentityError DuplicateUserName(string userName) => this.Create(nameof(this.DuplicateUserName), userName);

        public override IdentityError DuplicateEmail(string email) => this.Create(nameof(this.DuplicateEmail), email);

        public override IdentityError InvalidRoleName(string role) => this.Create(nameof(this.InvalidRoleName), role);

        public override IdentityError DuplicateRoleName(string role) => this.Create(nameof(this.DuplicateRoleName), role);

        public override IdentityError UserAlreadyHasPassword() => this.Create(nameof(this.UserAlreadyHasPassword));

        public override IdentityError UserLockoutNotEnabled() => this.Create(nameof(this.UserLockoutNotEnabled));

        public override IdentityError UserAlreadyInRole(string role) => this.Create(nameof(this.UserAlreadyInRole), role);

        public override IdentityError UserNotInRole(string role) => this.Create(nameof(this.UserNotInRole), role);

        public override IdentityError PasswordTooShort(int length) => this.Create(nameof(this.PasswordTooShort), length);

        public override IdentityError PasswordRequiresNonAlphanumeric() => this.Create(nameof(this.PasswordRequiresNonAlphanumeric));

        public override IdentityError PasswordRequiresDigit() => this.Create(nameof(this.PasswordRequiresDigit));

        public override IdentityError PasswordRequiresLower() => this.Create(nameof(this.PasswordRequiresLower));

        public override IdentityError PasswordRequiresUpper() => this.Create(nameof(this.PasswordRequiresUpper));

        public override IdentityError PasswordRequiresUniqueChars(int uniqueChars) => this.Create(nameof(this.PasswordRequiresUniqueChars), uniqueChars);

        public override IdentityError RecoveryCodeRedemptionFailed() => this.Create(nameof(this.RecoveryCodeRedemptionFailed));

        private IdentityError Create(string key, params object[] args)
        {
            return new IdentityError
            {
                Code = key,
                Description = this.localizer[key, args],
            };
        }
    }
}
