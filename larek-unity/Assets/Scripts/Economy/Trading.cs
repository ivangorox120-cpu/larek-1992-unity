using System;

namespace Larek.Economy
{
    public enum TradeResult { Success, UnknownGood, InvalidQuantity, NotEnoughStock, NotEnoughMoney }

    public sealed class KioskTrading
    {
        private readonly KioskEconomy economy;

        public KioskTrading(KioskEconomy economy)
        {
            this.economy = economy ?? throw new ArgumentNullException(nameof(economy));
        }

        public int CustomerPayout(string id, int quantity)
        {
            RequireValid(id, quantity);
            return economy.RetailPrice(id) * quantity;
        }

        public int WholesaleCost(string id, int quantity, bool station = false)
        {
            RequireValid(id, quantity);
            return checked(economy.WholesalePrice(id, station) * quantity);
        }

        public TradeResult SellToCustomer(string id, int quantity)
        {
            TradeResult validation = Validate(id, quantity);
            if (validation != TradeResult.Success) return validation;
            if (economy.Quantity(id) < quantity) return TradeResult.NotEnoughStock;
            economy.TakeStock(id, quantity);
            economy.Earn(CustomerPayout(id, quantity));
            return TradeResult.Success;
        }

        public TradeResult Restock(string id, int quantity, bool station = false)
        {
            TradeResult validation = Validate(id, quantity);
            if (validation != TradeResult.Success) return validation;
            int cost = WholesaleCost(id, quantity, station);
            if (!economy.Spend(cost)) return TradeResult.NotEnoughMoney;
            economy.AddStock(id, quantity, cost / (double)quantity);
            return TradeResult.Success;
        }

        private static TradeResult Validate(string id, int quantity)
        {
            if (!Goods.Exists(id)) return TradeResult.UnknownGood;
            return quantity <= 0 ? TradeResult.InvalidQuantity : TradeResult.Success;
        }

        private static void RequireValid(string id, int quantity)
        {
            TradeResult result = Validate(id, quantity);
            if (result == TradeResult.UnknownGood) throw new ArgumentException("Unknown good: " + id, nameof(id));
            if (result == TradeResult.InvalidQuantity) throw new ArgumentOutOfRangeException(nameof(quantity));
        }
    }
}
