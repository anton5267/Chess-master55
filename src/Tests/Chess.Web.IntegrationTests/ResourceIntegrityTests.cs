namespace Chess.Web.IntegrationTests;

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using System.Xml.Linq;

using FluentAssertions;
using Xunit;

public class ResourceIntegrityTests
{
    private static readonly Regex PlaceholdersRegex = new(@"\{[^{}]+\}", RegexOptions.Compiled);

    private static readonly string[] ResourceFileNames =
    {
        "SharedResource.resx",
        "SharedResource.uk.resx",
        "SharedResource.de.resx",
        "SharedResource.pl.resx",
        "SharedResource.es.resx",
    };

    private static readonly string[] MojibakeMarkers =
    {
        "Ð",
        "Ñ",
        "Ã",
        "Р“",
        "Р’РЋ",
        "EspaГ",
    };

    [Fact]
    public void ResourceFiles_ShouldHaveSameKeySet()
    {
        var en = this.LoadResource("SharedResource.resx");

        foreach (var fileName in ResourceFileNames.Where(x => x != "SharedResource.resx"))
        {
            var localized = this.LoadResource(fileName);
            localized.Keys.Should().BeEquivalentTo(en.Keys, because: $"{fileName} must match EN keyset");
        }
    }

    [Fact]
    public void ResourceFiles_ShouldKeepPlaceholderParity()
    {
        var en = this.LoadResource("SharedResource.resx");

        foreach (var fileName in ResourceFileNames.Where(x => x != "SharedResource.resx"))
        {
            var localized = this.LoadResource(fileName);
            foreach (var (key, enValue) in en)
            {
                var enPlaceholders = GetPlaceholders(enValue);
                var localizedPlaceholders = GetPlaceholders(localized[key]);
                localizedPlaceholders.Should().BeEquivalentTo(
                    enPlaceholders,
                    because: $"placeholder set mismatch for key '{key}' in {fileName}");
            }
        }
    }

    [Fact]
    public void ResourceFiles_ShouldNotContainKnownMojibakeMarkers()
    {
        foreach (var fileName in ResourceFileNames)
        {
            var path = Path.Combine(GetResourcesDirectory(), fileName);
            var content = File.ReadAllText(path);
            foreach (var marker in MojibakeMarkers)
            {
                content.Should().NotContain(marker, because: $"{fileName} still contains mojibake marker '{marker}'");
            }
        }
    }

    [Fact]
    public void LanguageOptions_ShouldUseAutonymsInAllResourceFiles()
    {
        foreach (var fileName in ResourceFileNames)
        {
            var res = this.LoadResource(fileName);
            res["LanguageOption_en"].Should().Be("English");
            res["LanguageOption_uk"].Should().Be("Українська");
            res["LanguageOption_de"].Should().Be("Deutsch");
            res["LanguageOption_pl"].Should().Be("Polski");
            res["LanguageOption_es"].Should().Be("Español");
        }
    }

    [Fact]
    public void CriticalNonEnglishKeys_ShouldNotFallbackToEnglish()
    {
        var en = this.LoadResource("SharedResource.resx");
        var criticalKeys = new[]
        {
            "Nav_Home",
            "Id_RegisterExternalTitle",
            "Id_NoExternalLoginProviders",
            "PasswordToggle_Show",
        };

        foreach (var fileName in ResourceFileNames.Where(x => x != "SharedResource.resx"))
        {
            var localized = this.LoadResource(fileName);
            foreach (var key in criticalKeys)
            {
                localized[key].Should().NotBe(en[key], because: $"{fileName} key '{key}' must be localized");
            }
        }
    }

    private static string GetResourcesDirectory()
    {
        return Path.GetFullPath(
            Path.Combine(
                AppContext.BaseDirectory,
                "../../../../../..",
                "src",
                "Web",
                "Chess.Web",
                "Resources"));
    }

    private static HashSet<string> GetPlaceholders(string input)
    {
        return PlaceholdersRegex.Matches(input)
            .Select(match => match.Value)
            .ToHashSet();
    }

    private Dictionary<string, string> LoadResource(string fileName)
    {
        var path = Path.Combine(GetResourcesDirectory(), fileName);
        var document = XDocument.Load(path);

        return document.Root!
            .Elements("data")
            .ToDictionary(
                element => element.Attribute("name")!.Value,
                element => element.Element("value")?.Value ?? string.Empty);
    }
}
