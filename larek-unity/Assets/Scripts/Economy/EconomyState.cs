using System;

namespace Larek.Economy
{
    [Serializable]
    public sealed class GoodPriceSnapshot
    {
        public string Id;
        public int Wholesale;
        public int Station;
    }

    [Serializable]
    public sealed class StockSnapshot
    {
        public string Id;
        public int Quantity;
        public double AverageCost;
    }

    [Serializable]
    public sealed class EconomySnapshot
    {
        public int Day;
        public int Money;
        public int Dollars;
        public int Debt;
        public int ExchangeRate;
        public double PriceIndex;
        public double Markup;
        public GoodPriceSnapshot[] Prices;
        public StockSnapshot[] Stock;
    }
}
