using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Chess.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddStatsDeduplicationAndIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_stats_user_id",
                table: "stats");

            migrationBuilder.DropIndex(
                name: "IX_moves_game_id",
                table: "moves");

            migrationBuilder.AlterColumn<string>(
                name: "player_two_user_id",
                table: "games",
                type: "nvarchar(450)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AlterColumn<string>(
                name: "player_one_user_id",
                table: "games",
                type: "nvarchar(450)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.Sql(
                @"
                WITH DuplicateStats AS
                (
                    SELECT
                        id,
                        ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY id) AS row_num
                    FROM stats
                )
                DELETE FROM stats
                WHERE id IN (SELECT id FROM DuplicateStats WHERE row_num > 1);
                ");

            migrationBuilder.CreateIndex(
                name: "IX_stats_user_id",
                table: "stats",
                column: "user_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_moves_game_id_created_on",
                table: "moves",
                columns: new[] { "game_id", "created_on" });

            migrationBuilder.CreateIndex(
                name: "IX_games_player_one_user_id",
                table: "games",
                column: "player_one_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_games_player_two_user_id",
                table: "games",
                column: "player_two_user_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_stats_user_id",
                table: "stats");

            migrationBuilder.DropIndex(
                name: "IX_moves_game_id_created_on",
                table: "moves");

            migrationBuilder.DropIndex(
                name: "IX_games_player_one_user_id",
                table: "games");

            migrationBuilder.DropIndex(
                name: "IX_games_player_two_user_id",
                table: "games");

            migrationBuilder.AlterColumn<string>(
                name: "player_two_user_id",
                table: "games",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(450)");

            migrationBuilder.AlterColumn<string>(
                name: "player_one_user_id",
                table: "games",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(450)");

            migrationBuilder.CreateIndex(
                name: "IX_stats_user_id",
                table: "stats",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "IX_moves_game_id",
                table: "moves",
                column: "game_id");
        }
    }
}
