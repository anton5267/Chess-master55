namespace Chess.Web.Infrastructure
{
    using System.Collections.Generic;
    using System.Collections.ObjectModel;

    public static class LocalizationConstants
    {
        public const string DefaultCulture = "en";

        public static readonly IReadOnlyCollection<string> SupportedCultures = new[]
        {
            "en",
            "uk",
            "de",
            "pl",
            "es",
        };

        public static readonly IReadOnlyDictionary<string, string> CultureDisplayNames =
            new ReadOnlyDictionary<string, string>(new Dictionary<string, string>
            {
                ["en"] = "English",
                ["uk"] = "Українська",
                ["de"] = "Deutsch",
                ["pl"] = "Polski",
                ["es"] = "Español",
            });
    }
}
