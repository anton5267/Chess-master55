namespace Chess.Web.Hubs.Sessions
{
    using System;

    public static class BotDifficultyExtensions
    {
        public const string EasyValue = "easy";
        public const string NormalValue = "normal";

        public static string ToClientValue(this BotDifficulty difficulty)
        {
            return difficulty == BotDifficulty.Easy
                ? EasyValue
                : NormalValue;
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

            difficulty = BotDifficulty.Normal;
            return false;
        }
    }
}
