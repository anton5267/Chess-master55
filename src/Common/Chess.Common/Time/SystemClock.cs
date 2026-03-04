namespace Chess.Common.Time
{
    using System;

    public class SystemClock : IClock
    {
        public DateTime UtcNow => DateTime.UtcNow;
    }
}
