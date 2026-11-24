using System;
using Larek.Economy;
using NUnit.Framework;

public class EconomyStateTests
{
    [Test]
    public void CapturedEconomyRestoresExactly()
    {
        var game = KioskEconomy.NewGame(() => 0.2);
        var trading = new KioskTrading(game);
        trading.Restock("soda", 4);
        trading.SellToCustomer("gum", 2);
        game.AdvanceDay();
        var snapshot = game.Capture();

        var restored = new KioskEconomy();
        restored.Restore(snapshot);

        Assert.AreEqual(game.Day, restored.Day);
        Assert.AreEqual(game.Money, restored.Money);
        Assert.AreEqual(game.Debt, restored.Debt);
        Assert.AreEqual(game.ExchangeRate, restored.ExchangeRate);
        Assert.AreEqual(game.PriceIndex, restored.PriceIndex);
        Assert.AreEqual(game.Markup, restored.Markup);
        foreach (Good good in Goods.All)
        {
            Assert.AreEqual(game.WholesalePrice(good.Id), restored.WholesalePrice(good.Id));
            Assert.AreEqual(game.WholesalePrice(good.Id, true), restored.WholesalePrice(good.Id, true));
            Assert.AreEqual(game.Quantity(good.Id), restored.Quantity(good.Id));
            Assert.AreEqual(game.AverageCost(good.Id), restored.AverageCost(good.Id), 0.0001);
        }
    }

    [Test]
    public void RestoreRejectsCorruptedSnapshots()
    {
        var game = KioskEconomy.NewGame(() => 0.0);
        var snapshot = game.Capture();
        Assert.Throws<ArgumentNullException>(() => game.Restore(null));

        snapshot.Money = -1;
        Assert.Throws<ArgumentException>(() => game.Restore(snapshot));

        snapshot = game.Capture();
        snapshot.Prices[0] = new GoodPriceSnapshot { Id = "missing", Wholesale = 1, Station = 1 };
        Assert.Throws<ArgumentException>(() => game.Restore(snapshot));

        snapshot = game.Capture();
        snapshot.Stock[0].Quantity = -2;
        Assert.Throws<ArgumentException>(() => game.Restore(snapshot));
    }
}
