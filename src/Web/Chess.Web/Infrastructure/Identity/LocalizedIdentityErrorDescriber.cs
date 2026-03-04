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

        public override IdentityError DefaultError() => this.Create(nameof(DefaultError));

        public override IdentityError ConcurrencyFailure() => this.Create(nameof(ConcurrencyFailure));

        public override IdentityError PasswordMismatch() => this.Create(nameof(PasswordMismatch));

        public override IdentityError InvalidToken() => this.Create(nameof(InvalidToken));

        public override IdentityError LoginAlreadyAssociated() => this.Create(nameof(LoginAlreadyAssociated));

        public override IdentityError InvalidUserName(string userName) => this.Create(nameof(InvalidUserName), userName);

        public override IdentityError InvalidEmail(string email) => this.Create(nameof(InvalidEmail), email);

        public override IdentityError DuplicateUserName(string userName) => this.Create(nameof(DuplicateUserName), userName);

        public override IdentityError DuplicateEmail(string email) => this.Create(nameof(DuplicateEmail), email);

        public override IdentityError InvalidRoleName(string role) => this.Create(nameof(InvalidRoleName), role);

        public override IdentityError DuplicateRoleName(string role) => this.Create(nameof(DuplicateRoleName), role);

        public override IdentityError UserAlreadyHasPassword() => this.Create(nameof(UserAlreadyHasPassword));

        public override IdentityError UserLockoutNotEnabled() => this.Create(nameof(UserLockoutNotEnabled));

        public override IdentityError UserAlreadyInRole(string role) => this.Create(nameof(UserAlreadyInRole), role);

        public override IdentityError UserNotInRole(string role) => this.Create(nameof(UserNotInRole), role);

        public override IdentityError PasswordTooShort(int length) => this.Create(nameof(PasswordTooShort), length);

        public override IdentityError PasswordRequiresNonAlphanumeric() => this.Create(nameof(PasswordRequiresNonAlphanumeric));

        public override IdentityError PasswordRequiresDigit() => this.Create(nameof(PasswordRequiresDigit));

        public override IdentityError PasswordRequiresLower() => this.Create(nameof(PasswordRequiresLower));

        public override IdentityError PasswordRequiresUpper() => this.Create(nameof(PasswordRequiresUpper));

        public override IdentityError PasswordRequiresUniqueChars(int uniqueChars) => this.Create(nameof(PasswordRequiresUniqueChars), uniqueChars);

        public override IdentityError RecoveryCodeRedemptionFailed() => this.Create(nameof(RecoveryCodeRedemptionFailed));

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
