using System;
using System.Collections.Generic;

namespace Larek.Gameplay
{
    /// <summary>Одна строка инвентаря для сериализации и UI.</summary>
    public sealed class InventoryEntry
    {
        public string Id;
        public int Count;

        public InventoryEntry(string id, int count)
        {
            Id = id;
            Count = count;
        }
    }

    /// <summary>
    /// Чистая модель инвентаря. Идентификаторы предметов сохраняются такими же, как в оригинале;
    /// популярные названия из порта (key_apartment, cigarettes и т. д.) являются псевдонимами.
    /// </summary>
    public sealed class Inventory
    {
        public const string KeyApartment = "key_apartment";
        public const string KeyEntrance = "key_entrance";
        public const string Money = "money";
        public const string Cigarettes = "cigarettes";
        public const string Guitar = "guitar";
        public const string Gun = "gun";
        public const string Phone = "phone";
        public const string Flashlight = "flashlight";

        private readonly Dictionary<string, int> counts = new Dictionary<string, int>(StringComparer.Ordinal);
        private static readonly Dictionary<string, string> aliases = BuildAliases();

        /// <summary>Предмет в руке. Пусто, если руки свободны.</summary>
        public string Hand { get; private set; }

        public string HeldItem { get { return Hand; } }
        public string HandItem { get { return Hand; } }
        public bool IsHandEmpty { get { return string.IsNullOrEmpty(Hand); } }

        public int CountAll
        {
            get
            {
                int total = 0;
                foreach (KeyValuePair<string, int> pair in counts) total += pair.Value;
                return total;
            }
        }

        public IList<InventoryEntry> Items
        {
            get
            {
                var result = new List<InventoryEntry>(counts.Count);
                foreach (KeyValuePair<string, int> pair in counts)
                    if (pair.Value > 0) result.Add(new InventoryEntry(pair.Key, pair.Value));
                result.Sort(delegate(InventoryEntry a, InventoryEntry b) { return string.CompareOrdinal(a.Id, b.Id); });
                return result;
            }
        }

        private static Dictionary<string, string> BuildAliases()
        {
            var map = new Dictionary<string, string>(StringComparer.Ordinal);
            map["aptkey"] = KeyApartment;
            map["apartmentkey"] = KeyApartment;
            map["key_apartment"] = KeyApartment;
            map["key_entrance"] = KeyEntrance;
            map["entrance_key"] = KeyEntrance;
            map["intercom_key"] = KeyEntrance;
            map["safekey"] = "safekey";
            map["matches"] = "matches";
            map["plug"] = "plug";
            map["money"] = Money;
            map["cash"] = Money;
            map["rubles"] = Money;
            map["cig"] = Cigarettes;
            map["cigarettes"] = Cigarettes;
            map["cigarette"] = Cigarettes;
            map["guitar"] = Guitar;
            map["guitar_item"] = Guitar;
            map["gun"] = Gun;
            map["weapon"] = Gun;
            map["gun_item"] = Gun;
            map["phone"] = Phone;
            map["telephone"] = Phone;
            map["flashlight"] = Flashlight;
            map["torch"] = Flashlight;
            map["flashlight_item"] = Flashlight;
            map["book"] = "books";
            map["books"] = "books";
            map["book_item"] = "books";
            map["chair_item"] = "chair";
            map["chair"] = "chair";
            map["desk_lamp"] = "lamp";
            map["lamp"] = "lamp";
            map["tv_rubin"] = "tv";
            map["tv"] = "tv";
            map["cassette_player"] = "cassette_player";
            map["stool"] = "stool";
            map["nightstand_item"] = "nightstand";
            map["armchair_item"] = "armchair";
            map["coffee_table"] = "coffee_table";
            map["alarm_vityaz"] = "alarm";
            map["milk"] = "milk";
            map["sausage"] = "sausage";
            map["butter"] = "butter";
            map["jam"] = "jam";
            map["bread"] = "bread";
            map["choc"] = "choc";
            map["tushonka"] = "tushonka";
            map["kilka"] = "kilka";
            map["soda"] = "soda";
            map["beer"] = "beer";
            map["vodka"] = "vodka";
            map["samogon"] = "samogon";
            map["kontra"] = "kontra";
            map["royal"] = "royal";
            map["anabol"] = "anabol";
            map["vhs"] = "vhs";
            map["gum"] = "gum";
            map["paper"] = "paper";
            map["tape"] = "tape";
            map["batt"] = "batt";
            map["toy"] = "toy";
            return map;
        }

        /// <summary>Приводит псевдоним к каноническому id. Неизвестные id остаются как есть.</summary>
        public static string Canonical(string id)
        {
            if (string.IsNullOrEmpty(id)) return string.Empty;
            string trimmed = id.Trim();
            string result;
            return aliases.TryGetValue(trimmed, out result) ? result : trimmed;
        }

        public void Add(string id, int count = 1)
        {
            string key = Canonical(id);
            if (key.Length == 0) return;
            if (count < 0) throw new ArgumentOutOfRangeException(nameof(count));
            if (count == 0) return;
            int current;
            counts.TryGetValue(key, out current);
            counts[key] = checked(current + count);
        }

        public void AddItem(string id, int count = 1)
        {
            Add(id, count);
        }

        /// <summary>Атомарно удаляет предметы. Возвращает false, если их меньше, чем нужно.</summary>
        public bool Remove(string id, int count = 1)
        {
            string key = Canonical(id);
            if (key.Length == 0 || count < 0) return false;
            int current;
            if (!counts.TryGetValue(key, out current) || current < count) return false;
            if (count == current) counts.Remove(key);
            else counts[key] = current - count;
            if (current == count && string.Equals(Hand, key, StringComparison.Ordinal)) ClearHand();
            return true;
        }

        public bool RemoveItem(string id, int count = 1)
        {
            return Remove(id, count);
        }

        public int Count(string id)
        {
            string key = Canonical(id);
            int result;
            return key.Length != 0 && counts.TryGetValue(key, out result) ? result : 0;
        }

        public int Quantity(string id)
        {
            return Count(id);
        }

        public int ItemCount(string id)
        {
            return Count(id);
        }

        public bool Has(string id)
        {
            return Count(id) > 0;
        }

        public bool HasItem(string id)
        {
            return Has(id);
        }

        public void SetCount(string id, int count)
        {
            string key = Canonical(id);
            if (key.Length == 0) return;
            if (count < 0) throw new ArgumentOutOfRangeException(nameof(count));
            if (count == 0)
            {
                counts.Remove(key);
                if (string.Equals(Hand, key, StringComparison.Ordinal)) ClearHand();
            }
            else counts[key] = count;
        }

        public bool Equip(string id)
        {
            string key = Canonical(id);
            if (key.Length == 0) return false;
            Hand = key;
            return true;
        }

        public bool EquipHand(string id)
        {
            return Equip(id);
        }

        public bool SetHand(string id)
        {
            return Equip(id);
        }

        public bool TakeInHand(string id)
        {
            return Equip(id);
        }

        /// <summary>Строгая версия: предмет должен присутствовать в инвентаре.</summary>
        public bool TryEquip(string id)
        {
            if (!Has(id)) return false;
            return Equip(id);
        }

        public void Unequip()
        {
            ClearHand();
        }

        public void Unequip(string id)
        {
            if (string.IsNullOrEmpty(id) || string.Equals(Canonical(id), Hand, StringComparison.Ordinal)) ClearHand();
        }

        public void ClearHand()
        {
            Hand = null;
        }

        public void DropHand()
        {
            ClearHand();
        }

        public bool IsHand(string id)
        {
            return string.Equals(Hand, Canonical(id), StringComparison.Ordinal);
        }

        public void Clear()
        {
            counts.Clear();
            ClearHand();
        }
    }
}
