FROM node:22-bookworm-slim AS assets
WORKDIR /src/Web/Chess.Web
COPY ["Web/Chess.Web/package.json", "Web/Chess.Web/package-lock.json", "./"]
RUN npm ci
COPY ["Web/Chess.Web/wwwroot/js/src/", "wwwroot/js/src/"]
RUN npm run build:assets

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app
EXPOSE 5000
ENV ASPNETCORE_ENVIRONMENT=Production
ENV ASPNETCORE_URLS=http://0.0.0.0:5000

# You can also specify the connection string as env variable
# ENV CONNECTION_STRING= 

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ["Chess.sln", "./"]
COPY ["Rules.ruleset", "./"]
COPY ["stylecop.json", "./"]
COPY ["Common/Chess.Common/Chess.Common.csproj", "Common/Chess.Common/"]
COPY ["Data/Chess.Data.Common/Chess.Data.Common.csproj", "Data/Chess.Data.Common/"]
COPY ["Data/Chess.Data.Models/Chess.Data.Models.csproj", "Data/Chess.Data.Models/"]
COPY ["Data/Chess.Data/Chess.Data.csproj", "Data/Chess.Data/"]
COPY ["Services/Chess.Services.Data/Chess.Services.Data.csproj", "Services/Chess.Services.Data/"]
COPY ["Services/Chess.Services.Mapping/Chess.Services.Mapping.csproj", "Services/Chess.Services.Mapping/"]
COPY ["Services/Chess.Services.Messaging/Chess.Services.Messaging.csproj", "Services/Chess.Services.Messaging/"]
COPY ["Web/Chess.Web.ViewModels/Chess.Web.ViewModels.csproj", "Web/Chess.Web.ViewModels/"]
COPY ["Web/Chess.Web/Chess.Web.csproj", "Web/Chess.Web/"]
RUN dotnet restore "Web/Chess.Web/Chess.Web.csproj"
RUN dotnet tool install --global Microsoft.Web.LibraryManager.Cli
COPY . .
WORKDIR /src/Web/Chess.Web
RUN for attempt in 1 2 3; do /root/.dotnet/tools/libman restore && break; if [ "$attempt" = "3" ]; then exit 1; fi; sleep 3; done
COPY --from=assets /src/Web/Chess.Web/wwwroot/js/ ./wwwroot/js/
RUN dotnet publish "Chess.Web.csproj" --no-restore -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "Chess.Web.dll"]
