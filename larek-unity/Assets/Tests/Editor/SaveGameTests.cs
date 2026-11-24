using System;
using System.IO;
using Larek.Economy;
using Larek.Save;
using NUnit.Framework;

public class SaveGameTests
{
    private static LarekSave Sample()
    {
        var game = KioskEconomy.NewGame(() => 0.35);
        var trading = new KioskTrading(game);
        trading.Restock("bread", 5);
        game.AdvanceDay();
        return new LarekSave
        {
            Economy = game.Capture(),
            Player = new SavePosition { X = 45.25, Y = 2.654, Z = 82.85 },
            EntranceUnlockSeconds = 3.5f,
            ApartmentOpen = true,
            ApartmentUnlocked = false
        };
    }

    [Test]
    public void SaveTextRoundTripsAllState()
    {
        var original = Sample();
        Assert.IsTrue(LarekSave.TryParse(original.ToText(), out LarekSave loaded));
        Assert.AreEqual(LarekSave.Version, 1);
        Assert.AreEqual(original.Economy.Money, loaded.Economy.Money);
        Assert.AreEqual(original.Economy.Day, loaded.Economy.Day);
        Assert.AreEqual(original.Economy.PriceIndex, loaded.Economy.PriceIndex, 0.0001);
        Assert.AreEqual(original.Economy.Prices.Length, loaded.Economy.Prices.Length);
        Assert.AreEqual(original.Economy.Stock.Length, loaded.Economy.Stock.Length);
        Assert.AreEqual(original.Player.X, loaded.Player.X, 0.0001);
        Assert.AreEqual(original.Player.Y, loaded.Player.Y, 0.0001);
        Assert.AreEqual(original.Player.Z, loaded.Player.Z, 0.0001);
        Assert.AreEqual(original.EntranceUnlockSeconds, loaded.EntranceUnlockSeconds, 0.0001);
        Assert.AreEqual(original.ApartmentOpen, loaded.ApartmentOpen);
        Assert.AreEqual(original.ApartmentUnlocked, loaded.ApartmentUnlocked);

        var economy = new KioskEconomy();
        economy.Restore(loaded.Economy);
        Assert.AreEqual(5, economy.Quantity("bread"));
    }

    [Test]
    public void UnknownVersionAndBrokenTextAreRejected()
    {
        string text = Sample().ToText();
        Assert.IsFalse(LarekSave.TryParse(null, out _));
        Assert.IsFalse(LarekSave.TryParse("not a save", out _));
        Assert.IsFalse(LarekSave.TryParse(text.Replace("LAREK_SAVE 1", "LAREK_SAVE 2"), out _));
        Assert.IsFalse(LarekSave.TryParse(text.Replace("money=", "coins="), out _));
        Assert.IsFalse(LarekSave.TryParse(text.Replace("price=gum:", "price=unknown:"), out _));
    }

    [Test]
    public void RepositoryWritesAndReadsSaveFile()
    {
        string path = Path.Combine(Path.GetTempPath(), "larek_save_test_" + Guid.NewGuid().ToString("N") + ".txt");
        try
        {
            var original = Sample();
            SaveRepository.Write(path, original);
            Assert.IsTrue(SaveRepository.TryRead(path, out LarekSave loaded));
            Assert.AreEqual(original.Economy.Money, loaded.Economy.Money);
            Assert.AreEqual(original.Player.Z, loaded.Player.Z, 0.0001);
        }
        finally
        {
            if (File.Exists(path)) File.Delete(path);
        }
    }

    [Test]
    public void RepositoryReturnsFalseForMissingFile()
    {
        string path = Path.Combine(Path.GetTempPath(), "larek_missing_" + Guid.NewGuid().ToString("N") + ".txt");
        Assert.IsFalse(SaveRepository.TryRead(path, out _));
    }
}
