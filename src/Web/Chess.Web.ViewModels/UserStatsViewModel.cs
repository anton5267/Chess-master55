namespace Chess.Web.ViewModels
{
    using AutoMapper;

    using Chess.Data.Models;
    using Chess.Services.Mapping;

    public class UserStatsViewModel : IMapFrom<StatisticEntity>, IHaveCustomMappings
    {
        public int Games { get; set; }

        public int Wins { get; set; }

        public int Draws { get; set; }

        public int Losses { get; set; }

        public int Rating { get; set; }

        public void CreateMappings(IProfileExpression configuration)
        {
            configuration.CreateMap<StatisticEntity, UserStatsViewModel>()
                .ForMember(destination => destination.Games, options => options.MapFrom(source => source.Played))
                .ForMember(destination => destination.Wins, options => options.MapFrom(source => source.Won))
                .ForMember(destination => destination.Draws, options => options.MapFrom(source => source.Drawn))
                .ForMember(destination => destination.Losses, options => options.MapFrom(source => source.Lost))
                .ForMember(destination => destination.Rating, options => options.MapFrom(source => source.EloRating));
        }
    }
}
