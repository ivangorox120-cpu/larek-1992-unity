using System;
using Larek.Economy;
using NUnit.Framework;

public class KioskEconomyTests
{
    [Test]
    public void NewGameHasOriginalStartingValues()
    {
        var game = KioskEconomy.NewGame(() => 0.0);
        Assert.AreEqual(5000, game.Money);
        Assert.AreEqual(2500, game.Debt);
        Assert.AreEqual(110, game.ExchangeRate);
        Assert.AreEqual(6, game.Quantity("gum"));
        Assert.AreEqual(5, game.Quantity("soda"));
        Assert.AreEqual(5, game.Quantity("paper"));
        Assert.AreEqual(5, game.Quantity("cig"));
    }

    [Test]
    public void PricesAndRoundingFollowJavaScript()
    {
        var game = KioskEconomy.NewGame(() => 0.0);
        Assert.AreEqual(10, game.WholesalePrice("gum"));
        Assert.AreEqual(14, game.RetailPrice("gum"));
        Assert.AreEqual(12, game.WholesalePrice("cig"));
        Assert.AreEqual(8, game.WholesalePrice("cig", true));
    }

    [Test]
    public void StockUsesWeightedAverageCost()
    {
        var game = KioskEconomy.NewGame(() => 0.0);
        game.AddStock("gum", 4, 20);
        Assert.AreEqual(10, game.Quantity("gum"));
        Assert.AreEqual(14, game.AverageCost("gum"), 0.0001);
        Assert.AreEqual(42, game.TakeStock("gum", 3), 0.0001);
        Assert.AreEqual(7, game.Quantity("gum"));
        Assert.AreEqual(98, game.TakeStock("gum", 100), 0.0001);
    }

    [Test]
    public void RejectsInvalidInput()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => KioskEconomy.NewGame(() => 1));
        var game = KioskEconomy.NewGame(() => 0);
        Assert.Throws<ArgumentException>(() => game.Quantity("missing"));
        Assert.Throws<ArgumentOutOfRangeException>(() => game.TakeStock("gum", -1));
    }
}
