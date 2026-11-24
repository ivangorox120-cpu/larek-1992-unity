using System;
using System.Collections.Generic;

namespace Larek.Economy
{
    public sealed class Good
    {
        public readonly string Id;
        public readonly string Name;
        public readonly int BasePrice;
        public readonly int AvailableFromDay;
        public readonly bool Cold;
        public readonly bool Imported;

        public Good(string id, string name, int basePrice, int availableFromDay = 1, bool cold = false, bool imported = false)
        {
            Id = id;
            Name = name;
            BasePrice = basePrice;
            AvailableFromDay = availableFromDay;
            Cold = cold;
            Imported = imported;
        }
    }

    public static class Goods
    {
        public static readonly IReadOnlyList<Good> All = Array.AsReadOnly(new[]
        {
            new Good("gum", "Жвачка «Турбина»", 12),
            new Good("paper", "Газета «Правда» / «Известия»", 3),
            new Good("soda", "Лимонад «Буратинка»", 8, cold: true),
            new Good("choc", "Батончик «Сникерсон»", 45),
            new Good("cig", "Сигареты «Космонавт»", 14),
            new Good("beer", "Пиво «Заводское»", 16, cold: true),
            new Good("batt", "Батарейки «Энерджи»", 28),
            new Good("vodka", "Спирт «Король»", 190),
            new Good("tape", "Кассета «Хиты-92»", 130),
            new Good("toy", "Электронная игра «Тетрис»", 900, availableFromDay: 13),
            new Good("tushonka", "Тушёнка «Говядина»", 42),
            new Good("kilka", "Килька в томате", 9),
            new Good("bread", "Хлеб «Дарницкий»", 4),
            new Good("mag", "Журнал «Mode International»", 140, imported: true),
            new Good("mag2", "Журнал «Auto Welt»", 160, imported: true)
        });

        public static Good Find(string id)
        {
            foreach (Good good in All)
                if (good.Id == id) return good;
            throw new ArgumentException("Unknown good: " + id, nameof(id));
        }

        public static bool Exists(string id)
        {
            if (id == null) return false;
            foreach (Good good in All)
                if (good.Id == id) return true;
            return false;
        }
    }
}
