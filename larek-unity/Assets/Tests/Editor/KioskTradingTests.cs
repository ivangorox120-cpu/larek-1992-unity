using Larek.Economy;
using NUnit.Framework;

public class KioskTradingTests
{
    private static KioskEconomy Game() => KioskEconomy.NewGame(() => 0.0);

    [Test]
    public void SellingToCustomerRemovesStockAndPaysRetailPrice()
    {
        var game = Game();
        var trading = new KioskTrading(game);
        Assert.AreEqual(TradeResult.Success, trading.SellToCustomer("gum", 2));
        Assert.AreEqual(4, game.Quantity("gum"));
        Assert.AreEqual(5028, game.Money);
    }

    [Test]
    public void RestockingSpendsWholesaleMoneyAndUpdatesAverageCost()
    {
        var game = Game();
        var trading = new KioskTrading(game);
        Assert.AreEqual(TradeResult.Success, trading.Restock("gum", 3));
        Assert.AreEqual(4970, game.Money);
        Assert.AreEqual(9, game.Quantity("gum"));
        Assert.AreEqual(10, game.AverageCost("gum"), 0.0001);
    }

    [Test]
    public void StationWholesaleIsCheaperForSelectedGoods()
    {
        var game = Game();
        var trading = new KioskTrading(game);
        Assert.AreEqual(24, trading.WholesaleCost("cig", 3, true));
        Assert.AreEqual(36, trading.WholesaleCost("cig", 3));
        Assert.AreEqual(TradeResult.Success, trading.Restock("cig", 3, true));
        Assert.AreEqual(4976, game.Money);
    }

    [Test]
    public void TradeFailsWithoutChangingStateWhenChecksFail()
    {
        var game = Game();
        var trading = new KioskTrading(game);
        Assert.AreEqual(TradeResult.NotEnoughStock, trading.SellToCustomer("toy", 1));
        Assert.AreEqual(TradeResult.NotEnoughMoney, trading.Restock("toy", 10));
        Assert.AreEqual(TradeResult.UnknownGood, trading.SellToCustomer("nothing", 1));
        Assert.AreEqual(TradeResult.InvalidQuantity, trading.Restock("gum", 0));
        Assert.AreEqual(5000, game.Money);
        Assert.AreEqual(6, game.Quantity("gum"));
    }

    [Test]
    public void SellingMoreThanInStockIsRejected()
    {
        var game = Game();
        var trading = new KioskTrading(game);
        Assert.AreEqual(TradeResult.NotEnoughStock, trading.SellToCustomer("gum", 7));
        Assert.AreEqual(6, game.Quantity("gum"));
        Assert.AreEqual(5000, game.Money);
    }
}
