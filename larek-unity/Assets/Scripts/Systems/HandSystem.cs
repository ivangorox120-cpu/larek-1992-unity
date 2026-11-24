using System;
using System.Collections.Generic;

namespace Larek.Systems
{
    /// <summary>Позы кисти из HAND_POSES/hand.js в виде компактного перечисления.</summary>
    public enum HandPose
    {
        None = 0,
        Hand = 1,
        Flashlight = 2,
        Cigarette = 3,
        Guitar = 4,
        Gun = 5,
        Key = 6,
        Phone = 7,
        Drink = 8,
        Box = 9,

        // Псевдонимы в стиле оригинальных ключей HAND_POSES / item id.
        hand = Hand,
        flashlight = Flashlight,
        cigarette = Cigarette,
        guitar = Guitar,
        gun = Gun,
        key = Key,
        phone = Phone,
        drink = Drink,
        box = Box
    }

    /// <summary>
    /// Состояние удерживаемого предмета. Пока играет гитара, кнопка инвентаря скрыта (M07),
    /// а подсказка «играть можно» видна ровно 3 секунды с начала игры (M08).
    /// </summary>
    public sealed class HandSystem
    {
        public const float GuitarHintSeconds = 3f;

        private static readonly Dictionary<string, HandPose> PoseById =
            new Dictionary<string, HandPose>(StringComparer.OrdinalIgnoreCase)
            {
                { "hand", HandPose.Hand },
                { "fist", HandPose.Hand },
                { "none", HandPose.None },
                { "flashlight", HandPose.Flashlight },
                { "cigarette", HandPose.Cigarette },
                { "cig", HandPose.Cigarette },
                { "guitar", HandPose.Guitar },
                { "gun", HandPose.Gun },
                { "weapon", HandPose.Gun },
                { "rifle", HandPose.Gun },
                { "key", HandPose.Key },
                { "apartment_key", HandPose.Key },
                { "phone", HandPose.Phone },
                { "domofon", HandPose.Phone },
                { "drink", HandPose.Drink },
                { "vodka", HandPose.Drink },
                { "beer", HandPose.Drink },
                { "bottle", HandPose.Drink },
                { "box", HandPose.Box },
                { "crate", HandPose.Box }
            };

        private HandPose pose = HandPose.Hand;
        private string itemId = "hand";
        private float guitarHintRemaining;

        public HandPose CurrentPose { get { return pose; } }
        public HandPose Pose { get { return pose; } }
        public string CurrentItemId { get { return itemId; } }
        public string ItemId { get { return itemId; } }
        public bool PlayingGuitar { get { return pose == HandPose.Guitar; } }
        public bool InventoryButtonVisible { get { return !PlayingGuitar; } }
        public float GuitarHintRemaining { get { return guitarHintRemaining; } }
        public bool GuitarHintVisible { get { return PlayingGuitar && guitarHintRemaining > 0f; } }

        /// <summary>Экипировка предмета по id. Неизвестный id не меняет позу.</summary>
        public bool Equip(string id)
        {
            if (string.IsNullOrEmpty(id)) return false;
            HandPose target;
            if (!PoseById.TryGetValue(id, out target)) return false;

            pose = target;
            itemId = id.ToLowerInvariant();
            if (pose == HandPose.Guitar)
            {
                guitarHintRemaining = GuitarHintSeconds;
            }
            else
            {
                guitarHintRemaining = 0f;
            }
            return true;
        }

        public bool Equip(HandPose target)
        {
            switch (target)
            {
                case HandPose.None: return Equip("none");
                case HandPose.Hand: return Equip("hand");
                case HandPose.Flashlight: return Equip("flashlight");
                case HandPose.Cigarette: return Equip("cigarette");
                case HandPose.Guitar: return Equip("guitar");
                case HandPose.Gun: return Equip("gun");
                case HandPose.Key: return Equip("key");
                case HandPose.Phone: return Equip("phone");
                case HandPose.Drink: return Equip("drink");
                case HandPose.Box: return Equip("box");
                default: return false;
            }
        }

        public void Unequip()
        {
            pose = HandPose.Hand;
            itemId = "hand";
            guitarHintRemaining = 0f;
        }

        public void Clear() { Unequip(); }

        public void StartGuitar() { Equip("guitar"); }
        public void StopGuitar() { if (PlayingGuitar) Unequip(); }

        public void Tick(float seconds)
        {
            if (!SystemMath.IsFinite(seconds) || seconds < 0)
                throw new ArgumentOutOfRangeException(nameof(seconds));
            if (guitarHintRemaining > 0f)
                guitarHintRemaining = Math.Max(0f, guitarHintRemaining - seconds);
        }

        public static HandPose PoseFor(string itemId)
        {
            HandPose result;
            return !string.IsNullOrEmpty(itemId) && PoseById.TryGetValue(itemId, out result) ? result : HandPose.None;
        }
    }
}
