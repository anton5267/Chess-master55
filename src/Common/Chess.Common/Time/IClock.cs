namespace Chess.Common.Time
{
    using System;

    public interface IClock
    {
        DateTime UtcNow { get; }
    }
}
