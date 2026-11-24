using System;
using System.Collections.Generic;
using Larek.Interactions;

namespace Larek.Systems
{
    /// <summary>Запись в журнале набранных номеров (домофон/телефон).</summary>
    public sealed class PhoneCall
    {
        public readonly string Digits;
        public readonly bool Accepted;
        public readonly string Prompt;
        public readonly double Time;

        public PhoneCall(string digits, bool accepted, string prompt, double time)
        {
            Digits = digits;
            Accepted = accepted;
            Prompt = prompt;
            Time = time;
        }
    }

    /// <summary>
    /// Дисковый телефон / домофон подъезда. Код набирается при каждом входе (M21–M23),
    /// код 1992 отпускает замок EntranceDoor ровно на 6 секунд. Все подсказки — по-русски.
    /// </summary>
    public sealed class PhoneSystem
    {
        public const string AccessCode = "1992";
        public const float UnlockSeconds = 6f;

        public const string PromptIdle = "Введите код домофона";
        public const string PromptDigits = "Набрано цифр: ";
        public const string PromptAccepted = "Код принят. Дверь открыта на 6 секунд.";
        public const string PromptRejected = "Неверный код. Попробуйте ещё раз.";
        public const string PromptCleared = "Набор сброшен. Введите код домофона";

        private readonly List<PhoneCall> history = new List<PhoneCall>();
        private EntranceDoor intercom;
        private string digits = string.Empty;
        private string prompt = PromptIdle;
        private double elapsed;

        public PhoneSystem() : this(null)
        {
        }

        public PhoneSystem(EntranceDoor door)
        {
            intercom = door ?? new EntranceDoor();
        }

        public EntranceDoor Intercom { get { return intercom; } }
        public string Digits { get { return digits; } }
        public int DigitCount { get { return digits.Length; } }
        public string Prompt { get { return prompt; } }
        public string LastPrompt { get { return prompt; } }
        public double Elapsed { get { return elapsed; } }
        public IReadOnlyList<PhoneCall> History { get { return history.AsReadOnly(); } }
        public int HistoryCount { get { return history.Count; } }
        public PhoneCall LastCall { get { return history.Count == 0 ? null : history[history.Count - 1]; } }
        public float UnlockSecondsRemaining { get { return intercom.UnlockSecondsRemaining; } }
        public bool IsUnlocked { get { return intercom.UnlockSecondsRemaining > 0f; } }
        public bool RequireCodeEveryEntry { get; set; } = true;

        /// <summary>Набор одной цифры (0..9). Возвращает false для некорректного ввода.</summary>
        public bool EnterDigit(int digit)
        {
            if (digit < 0 || digit > 9) return false;
            if (digits.Length >= 12) return false;
            digits += digit.ToString(System.Globalization.CultureInfo.InvariantCulture);
            prompt = PromptDigits + digits.Length;
            return true;
        }

        public bool EnterDigit(char digit)
        {
            if (digit < '0' || digit > '9') return false;
            return EnterDigit(digit - '0');
        }

        /// <summary>Набор всей строки цифр (удобно для тестов и автозаполнения).</summary>
        public bool Dial(string number)
        {
            if (number == null) return false;
            bool ok = true;
            foreach (char c in number)
            {
                if (c < '0' || c > '9') { ok = false; continue; }
                if (!EnterDigit(c)) ok = false;
            }
            return ok;
        }

        public void Clear()
        {
            digits = string.Empty;
            prompt = PromptCleared;
        }

        public void ClearHistory()
        {
            history.Clear();
        }

        /// <summary>Подтверждение набора: 1992 открывает домофон на 6 секунд.</summary>
        public bool Submit()
        {
            string entered = digits;
            bool accepted = intercom.EnterCode(entered) && entered == AccessCode;
            prompt = accepted ? PromptAccepted : PromptRejected;
            history.Add(new PhoneCall(entered, accepted, prompt, elapsed));
            digits = string.Empty;
            return accepted;
        }

        public bool Submit(string code)
        {
            Clear();
            Dial(code);
            return Submit();
        }

        /// <summary>Тик замка домофона: после 6 секунд ручка снова заперта (M23).</summary>
        public void Tick(float seconds)
        {
            if (!SystemMath.IsFinite(seconds) || seconds < 0)
                throw new ArgumentOutOfRangeException(nameof(seconds));
            elapsed += seconds;
            intercom.Tick(seconds);
        }

        public void AttachIntercom(EntranceDoor door)
        {
            if (door == null) throw new ArgumentNullException(nameof(door));
            intercom = door;
        }

        public void Reset()
        {
            digits = string.Empty;
            prompt = PromptIdle;
            elapsed = 0;
        }
    }
}
