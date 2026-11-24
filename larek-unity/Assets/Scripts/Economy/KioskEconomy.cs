using System;
using System.Collections.Generic;

namespace Larek.Economy
{
    public sealed class StockEntry
    {
        public int Quantity { get; internal set; }
        public double AverageCost { get; internal set; }
    }

    public sealed class KioskEconomy
    {
        private readonly Dictionary<string, int> prices = new Dictionary<string, int>();
        private readonly Dictionary<string, int> stationPrices = new Dictionary<string, int>();
        private readonly Dictionary<string, StockEntry> stock = new Dictionary<string, StockEntry>();

        public int Day { get; private set; } = 1;
        public int Money { get; private set; } = 5000;
        public int Dollars { get; private set; }
        public int Debt { get; private set; } = 2500;
        public int ExchangeRate { get; private set; } = 110;
        public double PriceIndex { get; private set; } = 1;
        public double Markup { get; private set; } = 0.4;

        private static int RoundPrice(double value) => Math.Max(1, (int)Math.Floor(value + 0.5));

        public static KioskEconomy NewGame(Func<double> random)
        {
            if (random == null) throw new ArgumentNullException(nameof(random));
            var result = new KioskEconomy();
            result.GeneratePrices(random);
            result.AddStock("gum", 6, result.prices["gum"]);
            result.AddStock("soda", 5, result.prices["soda"]);
            result.AddStock("paper", 5, result.prices["paper"]);
            result.AddStock("cig", 5, result.prices["cig"]);
            return result;
        }

        private static double Range(Func<double> random, double min, double max)
        {
            double value = random();
            if (double.IsNaN(value) || value < 0 || value >= 1)
                throw new ArgumentOutOfRangeException(nameof(random), "Random value must be in [0, 1).");
            return min + value * (max - min);
        }

        private void GeneratePrices(Func<double> random)
        {
            foreach (Good good in Goods.All)
            {
                int price = RoundPrice(good.BasePrice * PriceIndex * Range(random, 0.85, 1.2));
                prices[good.Id] = price;
                bool cheap = good.Id == "cig" || good.Id == "vodka" || good.Id == "beer" || good.Id == "tape";
                stationPrices[good.Id] = RoundPrice(price * (cheap ? Range(random, 0.65, 0.8) : Range(random, 1, 1.1)));
            }
        }

        public int WholesalePrice(string id, bool station = false)
        {
            Goods.Find(id);
            return station ? stationPrices[id] : prices[id];
        }

        public int RetailPrice(string id) => RoundPrice(WholesalePrice(id) * (1 + Markup));

        public int Quantity(string id)
        {
            Goods.Find(id);
            return stock.TryGetValue(id, out StockEntry entry) ? entry.Quantity : 0;
        }

        public double AverageCost(string id)
        {
            Goods.Find(id);
            return stock.TryGetValue(id, out StockEntry entry) ? entry.AverageCost : 0;
        }

        public void AddStock(string id, int quantity, double unitCost)
        {
            Goods.Find(id);
            if (quantity <= 0) throw new ArgumentOutOfRangeException(nameof(quantity));
            if (double.IsNaN(unitCost) || double.IsInfinity(unitCost) || unitCost < 0) throw new ArgumentOutOfRangeException(nameof(unitCost));
            if (!stock.TryGetValue(id, out StockEntry entry)) stock[id] = entry = new StockEntry();
            int total = checked(entry.Quantity + quantity);
            entry.AverageCost = (entry.AverageCost * entry.Quantity + unitCost * quantity) / total;
            entry.Quantity = total;
        }

        public double TakeStock(string id, int quantity)
        {
            Goods.Find(id);
            if (quantity < 0) throw new ArgumentOutOfRangeException(nameof(quantity));
            if (!stock.TryGetValue(id, out StockEntry entry)) return 0;
            int taken = Math.Min(quantity, entry.Quantity);
            entry.Quantity -= taken;
            return taken * entry.AverageCost;
        }

        public void Earn(int amount)
        {
            if (amount < 0) throw new ArgumentOutOfRangeException(nameof(amount));
            Money = checked(Money + amount);
        }

        public bool Spend(int amount)
        {
            if (amount < 0) throw new ArgumentOutOfRangeException(nameof(amount));
            if (Money < amount) return false;
            Money -= amount;
            return true;
        }

        public void AdvanceDay()
        {
            Day = checked(Day + 1);
        }

        public EconomySnapshot Capture()
        {
            var pricesSnapshot = new GoodPriceSnapshot[prices.Count];
            int index = 0;
            foreach (Good good in Goods.All)
            {
                pricesSnapshot[index++] = new GoodPriceSnapshot
                {
                    Id = good.Id,
                    Wholesale = prices[good.Id],
                    Station = stationPrices[good.Id]
                };
            }

            var stockSnapshot = new StockSnapshot[stock.Count];
            index = 0;
            foreach (KeyValuePair<string, StockEntry> pair in stock)
            {
                stockSnapshot[index++] = new StockSnapshot
                {
                    Id = pair.Key,
                    Quantity = pair.Value.Quantity,
                    AverageCost = pair.Value.AverageCost
                };
            }

            return new EconomySnapshot
            {
                Day = Day,
                Money = Money,
                Dollars = Dollars,
                Debt = Debt,
                ExchangeRate = ExchangeRate,
                PriceIndex = PriceIndex,
                Markup = Markup,
                Prices = pricesSnapshot,
                Stock = stockSnapshot
            };
        }

        public void Restore(EconomySnapshot snapshot)
        {
            if (snapshot == null) throw new ArgumentNullException(nameof(snapshot));
            if (snapshot.Day < 1 || snapshot.Money < 0 || snapshot.Dollars < 0 || snapshot.Debt < 0 ||
                snapshot.ExchangeRate < 1 || snapshot.PriceIndex <= 0 || snapshot.Markup < 0 ||
                double.IsNaN(snapshot.PriceIndex) || double.IsInfinity(snapshot.PriceIndex) ||
                double.IsNaN(snapshot.Markup) || double.IsInfinity(snapshot.Markup))
                throw new ArgumentException("Invalid economy snapshot.", nameof(snapshot));
            if (snapshot.Prices == null || snapshot.Stock == null)
                throw new ArgumentException("Economy snapshot is missing price or stock data.", nameof(snapshot));

            var restoredPrices = new Dictionary<string, int>();
            var restoredStationPrices = new Dictionary<string, int>();
            if (snapshot.Prices.Length != Goods.All.Count)
                throw new ArgumentException("Price count does not match the goods catalogue.", nameof(snapshot));
            foreach (GoodPriceSnapshot price in snapshot.Prices)
            {
                if (price == null || price.Wholesale < 1 || price.Station < 1 ||
                    (!Goods.Exists(price.Id)) || restoredPrices.ContainsKey(price.Id))
                    throw new ArgumentException("Invalid price entry in snapshot.", nameof(snapshot));
                restoredPrices[price.Id] = price.Wholesale;
                restoredStationPrices[price.Id] = price.Station;
            }

            var restoredStock = new Dictionary<string, StockEntry>();
            foreach (StockSnapshot item in snapshot.Stock)
            {
                if (item == null || !Goods.Exists(item.Id) || restoredStock.ContainsKey(item.Id) ||
                    item.Quantity < 0 || double.IsNaN(item.AverageCost) || double.IsInfinity(item.AverageCost) || item.AverageCost < 0)
                    throw new ArgumentException("Invalid stock entry in snapshot.", nameof(snapshot));
                restoredStock[item.Id] = new StockEntry { Quantity = item.Quantity, AverageCost = item.AverageCost };
            }

            prices.Clear();
            stationPrices.Clear();
            stock.Clear();
            foreach (KeyValuePair<string, int> pair in restoredPrices) prices[pair.Key] = pair.Value;
            foreach (KeyValuePair<string, int> pair in restoredStationPrices) stationPrices[pair.Key] = pair.Value;
            foreach (KeyValuePair<string, StockEntry> pair in restoredStock) stock[pair.Key] = pair.Value;

            Day = snapshot.Day;
            Money = snapshot.Money;
            Dollars = snapshot.Dollars;
            Debt = snapshot.Debt;
            ExchangeRate = snapshot.ExchangeRate;
            PriceIndex = snapshot.PriceIndex;
            Markup = snapshot.Markup;
        }
    }
}
