using System;
using System.Collections.Generic;

namespace Larek.Gameplay
{
    /// <summary>Прогресс героя: флаги сюжета, посещённые места и отметки на карте.</summary>
    public sealed class Progression
    {
        public const string KeyGiven = "aptKeyGiven";
        public const string ApartmentUnlocked = "aptUnlocked";
        public const string KioskVisited = "visited.kiosk";
        public const string HomeVisited = "visited.home";

        private readonly HashSet<string> flags = new HashSet<string>(StringComparer.Ordinal);
        private readonly HashSet<string> visited = new HashSet<string>(StringComparer.Ordinal);
        private readonly HashSet<string> marks = new HashSet<string>(StringComparer.Ordinal);

        public ISet<string> Flags { get { return flags; } }
        public ISet<string> Visited { get { return visited; } }
        public ISet<string> Marks { get { return marks; } }

        public event Action<string> FlagChanged;

        public Progression()
        {
            ResetToNewGame();
        }

        public bool HasFlag(string flag)
        {
            return !string.IsNullOrEmpty(flag) && flags.Contains(Normalize(flag));
        }

        public bool Has(string flag)
        {
            return HasFlag(flag);
        }

        public bool Mark(string flag)
        {
            string key = Normalize(flag);
            if (key.Length == 0) return false;
            bool added = flags.Add(key);
            if (added && FlagChanged != null) FlagChanged(key);
            return added;
        }

        public bool SetFlag(string flag, bool value)
        {
            return value ? Mark(flag) : ClearFlag(flag);
        }

        public bool ClearFlag(string flag)
        {
            string key = Normalize(flag);
            if (key.Length == 0) return false;
            bool removed = flags.Remove(key);
            if (removed && FlagChanged != null) FlagChanged(key);
            return removed;
        }

        public bool Unmark(string flag)
        {
            return ClearFlag(flag);
        }

        public bool HasVisited(string key)
        {
            return !string.IsNullOrEmpty(key) && visited.Contains(Normalize(key));
        }

        public bool IsVisited(string key)
        {
            return HasVisited(key);
        }

        public bool MarkVisited(string key)
        {
            string normalized = Normalize(key);
            if (normalized.Length == 0) return false;
            return visited.Add(normalized);
        }

        public bool Visit(string key)
        {
            return MarkVisited(key);
        }

        public bool HasMark(string key)
        {
            return !string.IsNullOrEmpty(key) && marks.Contains(Normalize(key));
        }

        public bool AddMark(string key)
        {
            string normalized = Normalize(key);
            if (normalized.Length == 0) return false;
            return marks.Add(normalized);
        }

        public bool RemoveMark(string key)
        {
            string normalized = Normalize(key);
            if (normalized.Length == 0) return false;
            return marks.Remove(normalized);
        }

        public void Clear()
        {
            flags.Clear();
            visited.Clear();
            marks.Clear();
        }

        public void ResetToNewGame()
        {
            Clear();
            Mark(KeyGiven);
            Mark(HasMapFlag);
            MarkVisited("kiosk");
            MarkVisited("home");
        }

        public const string HasMapFlag = "hasMap";

        private static string Normalize(string value)
        {
            return value == null ? string.Empty : value.Trim();
        }
    }
}
