namespace Chess.Web.Hubs.Sessions
{
    using System;

    public static class BotDifficultyExtensions
    {
        public const string EasyValue = "easy";
        public const string NormalValue = "normal";
        public const string HardValue = "hard";

        public static string ToClientValue(this BotDifficulty difficulty)
        {
            return difficulty switch
            {
                BotDifficulty.Easy => EasyValue,
                BotDifficulty.Hard => HardValue,
                _ => NormalValue,
            };
        }

        public static bool TryParseClientValue(string value, out BotDifficulty difficulty)
        {
            if (string.Equals(value, EasyValue, StringComparison.OrdinalIgnoreCase))
            {
                difficulty = BotDifficulty.Easy;
                return true;
            }

            if (string.Equals(value, NormalValue, StringComparison.OrdinalIgnoreCase))
            {
                difficulty = BotDifficulty.Normal;
                return true;
            }

            if (string.Equals(value, HardValue, StringComparison.OrdinalIgnoreCase))
            {
                difficulty = BotDifficulty.Hard;
                return true;
            }

            difficulty = BotDifficulty.Normal;
            return false;
        }
    }
}
