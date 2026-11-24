using System;

namespace Larek.Gameplay
{
    /// <summary>
    /// Админ-панель из M01: открывается только по коду larek1992 и никогда не удаляется.
    /// Код нормализуется так же, как в game.js: trim + lower + удаление всех пробелов.
    /// </summary>
    public sealed class AdminPanel
    {
        public const string AdminCode = "larek1992";
        public const string Code = AdminCode;
        public const string WrongCodeMessage = "Неверный код";

        private bool unlocked;

        public bool IsUnlocked { get { return unlocked; } }
        public bool IsOpen { get { return unlocked; } }
        public bool Unlocked { get { return unlocked; } }
        public string LastError { get; private set; }

        public event Action Opened;
        public event Action<string> CodeRejected;

        public static string Normalize(string code)
        {
            if (code == null) return string.Empty;
            var text = new System.Text.StringBuilder(code.Trim().Length);
            foreach (char c in code.Trim().ToLowerInvariant())
                if (!char.IsWhiteSpace(c)) text.Append(c);
            return text.ToString();
        }

        public bool TryUnlock(string code)
        {
            if (string.Equals(Normalize(code), AdminCode, StringComparison.Ordinal))
            {
                unlocked = true;
                LastError = string.Empty;
                if (Opened != null) Opened();
                return true;
            }
            LastError = WrongCodeMessage;
            if (CodeRejected != null) CodeRejected(WrongCodeMessage);
            return false;
        }

        public bool Submit(string code)
        {
            return TryUnlock(code);
        }

        public bool TryOpen(string code)
        {
            return TryUnlock(code);
        }

        public void Open()
        {
            unlocked = true;
            LastError = string.Empty;
            if (Opened != null) Opened();
        }

        public void Unlock()
        {
            Open();
        }

        public void Close()
        {
            unlocked = false;
        }

        public void Lock()
        {
            unlocked = false;
        }

        public void Reset()
        {
            unlocked = false;
            LastError = string.Empty;
        }
    }
}
