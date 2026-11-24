using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;
using Larek.Economy;

namespace Larek.Save
{
    [Serializable]
    public struct SavePosition
    {
        public double X;
        public double Y;
        public double Z;
    }

    public sealed class LarekSave
    {
        public const int Version = 1;
        private const string Header = "LAREK_SAVE ";

        public EconomySnapshot Economy;
        public SavePosition Player;
        public float EntranceUnlockSeconds;
        public bool ApartmentOpen;
        public bool ApartmentUnlocked;

        public string ToText()
        {
            if (Economy == null || Economy.Prices == null || Economy.Stock == null)
                throw new InvalidOperationException("Economy data is missing.");

            var text = new StringBuilder();
            text.Append(Header).Append(Version).Append('\n');
            text.Append("day=").Append(Economy.Day).Append('\n');
            text.Append("money=").Append(Economy.Money).Append('\n');
            text.Append("dollars=").Append(Economy.Dollars).Append('\n');
            text.Append("debt=").Append(Economy.Debt).Append('\n');
            text.Append("rate=").Append(Economy.ExchangeRate).Append('\n');
            text.Append("priceindex=").Append(Number(Economy.PriceIndex)).Append('\n');
            text.Append("markup=").Append(Number(Economy.Markup)).Append('\n');
            foreach (GoodPriceSnapshot price in Economy.Prices)
                text.Append("price=").Append(price.Id).Append(':').Append(price.Wholesale).Append(':').Append(price.Station).Append('\n');
            foreach (StockSnapshot item in Economy.Stock)
                text.Append("stock=").Append(item.Id).Append(':').Append(item.Quantity).Append(':').Append(Number(item.AverageCost)).Append('\n');
            text.Append("player=").Append(Number(Player.X)).Append(':').Append(Number(Player.Y)).Append(':').Append(Number(Player.Z)).Append('\n');
            text.Append("entrance=").Append(Number(EntranceUnlockSeconds)).Append('\n');
            text.Append("apartment=").Append(Bool(ApartmentOpen)).Append(':').Append(Bool(ApartmentUnlocked)).Append('\n');
            return text.ToString();
        }

        public static bool TryParse(string text, out LarekSave save)
        {
            save = null;
            if (string.IsNullOrEmpty(text)) return false;

            string[] lines = text.Split('\n');
            string header = lines[0].Trim();
            if (!header.StartsWith(Header, StringComparison.Ordinal)) return false;
            if (!int.TryParse(header.Substring(Header.Length), NumberStyles.Integer, CultureInfo.InvariantCulture, out int version) || version != Version)
                return false;

            var values = new Dictionary<string, string>(StringComparer.Ordinal);
            var prices = new List<string>();
            var stocks = new List<string>();
            for (int i = 1; i < lines.Length; i++)
            {
                string line = lines[i].Trim();
                if (line.Length == 0) continue;
                int separator = line.IndexOf('=');
                if (separator <= 0) return false;
                string key = line.Substring(0, separator);
                string value = line.Substring(separator + 1);
                if (key == "price") prices.Add(value);
                else if (key == "stock") stocks.Add(value);
                else if (values.ContainsKey(key)) return false;
                else values[key] = value;
            }

            string[] required = { "day", "money", "dollars", "debt", "rate", "priceindex", "markup", "player", "entrance", "apartment" };
            foreach (string key in required)
                if (!values.ContainsKey(key)) return false;

            try
            {
                var economy = new EconomySnapshot
                {
                    Day = Int(values["day"]),
                    Money = Int(values["money"]),
                    Dollars = Int(values["dollars"]),
                    Debt = Int(values["debt"]),
                    ExchangeRate = Int(values["rate"]),
                    PriceIndex = Real(values["priceindex"]),
                    Markup = Real(values["markup"]),
                    Prices = new GoodPriceSnapshot[prices.Count],
                    Stock = new StockSnapshot[stocks.Count]
                };

                var seen = new HashSet<string>(StringComparer.Ordinal);
                if (prices.Count != Goods.All.Count) return false;
                for (int i = 0; i < prices.Count; i++)
                {
                    string[] fields = prices[i].Split(':');
                    if (fields.Length != 3 || !Goods.Exists(fields[0]) || !seen.Add(fields[0])) return false;
                    economy.Prices[i] = new GoodPriceSnapshot { Id = fields[0], Wholesale = Int(fields[1]), Station = Int(fields[2]) };
                }

                seen.Clear();
                for (int i = 0; i < stocks.Count; i++)
                {
                    string[] fields = stocks[i].Split(':');
                    if (fields.Length != 3 || !Goods.Exists(fields[0]) || !seen.Add(fields[0])) return false;
                    economy.Stock[i] = new StockSnapshot { Id = fields[0], Quantity = Int(fields[1]), AverageCost = Real(fields[2]) };
                }

                string[] player = values["player"].Split(':');
                if (player.Length != 3) return false;
                string[] apartment = values["apartment"].Split(':');
                if (apartment.Length != 2) return false;

                double x = Real(player[0]);
                double y = Real(player[1]);
                double z = Real(player[2]);
                double seconds = Real(values["entrance"]);
                if (double.IsNaN(x) || double.IsInfinity(x) || double.IsNaN(y) || double.IsInfinity(y) ||
                    double.IsNaN(z) || double.IsInfinity(z) ||
                    double.IsNaN(seconds) || double.IsInfinity(seconds) || seconds < 0 || seconds > float.MaxValue)
                    return false;

                save = new LarekSave
                {
                    Economy = economy,
                    Player = new SavePosition { X = x, Y = y, Z = z },
                    EntranceUnlockSeconds = (float)seconds,
                    ApartmentOpen = Boolean(apartment[0]),
                    ApartmentUnlocked = Boolean(apartment[1])
                };
                return true;
            }
            catch (FormatException) { return false; }
            catch (OverflowException) { return false; }
        }

        private static string Number(double value) => value.ToString("R", CultureInfo.InvariantCulture);
        private static string Bool(bool value) => value ? "1" : "0";
        private static int Int(string value) => int.Parse(value, NumberStyles.Integer, CultureInfo.InvariantCulture);
        private static double Real(string value) => double.Parse(value, NumberStyles.Float, CultureInfo.InvariantCulture);

        private static bool Boolean(string value)
        {
            if (value == "0") return false;
            if (value == "1") return true;
            throw new FormatException("Boolean value must be 0 or 1.");
        }
    }
}
