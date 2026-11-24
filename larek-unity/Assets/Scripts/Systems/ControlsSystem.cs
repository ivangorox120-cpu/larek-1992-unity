using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Globalization;
using System.Text;

namespace Larek.Systems
{
    /// <summary>Вкладки меню настроек в порядке из оригинальной игры.</summary>
    public enum SettingsTab
    {
        Graphics,
        Gameplay,
        Sound,
        System
    }

    /// <summary>Тип экранного элемента управления из js/controls.js.</summary>
    public enum ControlKind
    {
        Tap,
        Hold,
        Toggle,
        Stick
    }

    /// <summary>Клавиатурная/джойстиковая привязка действия.</summary>
    public sealed class ControlBinding
    {
        public readonly string Action;
        public readonly string Label;
        public string Key;
        public ControlKind Kind;

        public ControlBinding(string action, string label, string key, ControlKind kind = ControlKind.Tap)
        {
            Action = action;
            Label = label;
            Key = key;
            Kind = kind;
        }
    }

    /// <summary>Положение и внешний вид кнопки в редакторе раскладки.</summary>
    public sealed class ControlElement
    {
        public string Uid;
        public string Action;
        public string Label;
        public ControlKind Kind;
        public double X;
        public double Y;
        public double Size;
        public double Opacity;
        public double Hit;
        public double Sensitivity;

        public ControlElement(string uid, string action, string label, ControlKind kind,
            double x, double y, double size, double opacity = 0.8, double hit = 1.2, double sensitivity = 1)
        {
            Uid = uid;
            Action = action;
            Label = label;
            Kind = kind;
            X = x;
            Y = y;
            Size = size;
            Opacity = opacity;
            Hit = hit;
            Sensitivity = sensitivity;
        }
    }

    /// <summary>
    /// Чистая модель раскладки управления и настроек. Нет вызовов UnityEngine: система хранит
    /// привязки, русские подписи кнопок, вкладки настроек и состояние джойстика лестницы (M33).
    /// </summary>
    public sealed class ControlsSystem
    {
        public const string DefaultProfile = "Стандарт";
        public const string StorageKey = "larek-controls-v4";
        public const string LadderUpAction = "ladder_up";
        public const string LadderDownAction = "ladder_down";
        public const double StickDeadZone = 0.12;
        private const int FormatVersion = 1;

        private static readonly string[] TabsInternal =
        {
            "Графика", "Геймплей", "Звук", "Система"
        };

        private static readonly ControlBinding[] DefaultBindingsInternal =
        {
            new ControlBinding("move", "Движение", "Joystick", ControlKind.Stick),
            new ControlBinding("interact", "Действие", "KeyE"),
            new ControlBinding("use", "Ещё", "KeyF"),
            new ControlBinding("tvch", "Канал", "KeyZ"),
            new ControlBinding("punch", "Ударить", "KeyV"),
            new ControlBinding("block", "Блок", "KeyB", ControlKind.Hold),
            new ControlBinding("kick", "Ногой", "KeyG"),
            new ControlBinding("hook", "Боковой", "KeyH"),
            new ControlBinding("upper", "Апперкот", "KeyJ"),
            new ControlBinding("map", "Карта", "KeyM"),
            new ControlBinding("fire", "Огонь", "Mouse0"),
            new ControlBinding("aim", "Прицел", "Mouse1", ControlKind.Hold),
            new ControlBinding("reload", "Перезарядка", "KeyR"),
            new ControlBinding("weapon", "Ружьё", "KeyQ"),
            new ControlBinding("gunput", "Положить ружьё", "KeyX"),
            new ControlBinding("sprint", "Бег", "ShiftLeft", ControlKind.Hold),
            new ControlBinding("crouch", "Присесть", "KeyC", ControlKind.Toggle),
            new ControlBinding("pocket", "В карман", "KeyP"),
            new ControlBinding("smoke", "Закурить", "KeyT"),
            new ControlBinding("drink", "Выпить", "KeyY"),
            new ControlBinding("readpaper", "Читать газету", "KeyO"),
            new ControlBinding("inventory", "Инвентарь", "Tab"),
            new ControlBinding("door", "Дверь", "KeyU"),
            new ControlBinding(LadderUpAction, "Подъём по лестнице", "JoystickUp", ControlKind.Hold),
            new ControlBinding(LadderDownAction, "Спуск по лестнице", "JoystickDown", ControlKind.Hold)
        };

        private static readonly ControlElement[] DefaultElementsInternal =
        {
            new ControlElement("mv", "move", "Движение", ControlKind.Stick, .13, .76, 150, .6, 1.5, 1),
            new ControlElement("in", "interact", "Действие", ControlKind.Tap, .66, .84, 78),
            new ControlElement("us", "use", "Ещё", ControlKind.Tap, .53, .86, 60, .8),
            new ControlElement("tv", "tvch", "Канал", ControlKind.Tap, .66, .66, 60),
            new ControlElement("pn", "punch", "Ударить", ControlKind.Tap, .89, .78, 76, .78),
            new ControlElement("bl", "block", "Блок", ControlKind.Hold, .77, .84, 68, .78),
            new ControlElement("fi", "fire", "Огонь", ControlKind.Tap, .9, .8, 84, .75),
            new ControlElement("ai", "aim", "Прицел", ControlKind.Hold, .78, .88, 62, .7),
            new ControlElement("re", "reload", "Перезарядка", ControlKind.Tap, .79, .7, 52, .7),
            new ControlElement("we", "weapon", "Ружьё", ControlKind.Tap, .91, .42, 54, .7),
            new ControlElement("gp", "gunput", "Положить ружьё", ControlKind.Tap, .80, .36, 48, .65),
            new ControlElement("sp", "sprint", "Бег", ControlKind.Hold, .3, .88, 56, .65),
            new ControlElement("cr", "crouch", "Присесть", ControlKind.Toggle, .3, .73, 50, .6),
            new ControlElement("pk", "pocket", "В карман", ControlKind.Tap, .54, .70, 52, .72),
            new ControlElement("sm", "smoke", "Закурить", ControlKind.Tap, .66, .66, 52, .75),
            new ControlElement("dk", "drink", "Выпить", ControlKind.Tap, .66, .66, 50, .65),
            new ControlElement("rp", "readpaper", "Читать газету", ControlKind.Tap, .66, .66, 58),
            new ControlElement("iv", "inventory", "Инвентарь", ControlKind.Tap, .06, .42, 52, .6),
            new ControlElement("mp", "map", "Карта", ControlKind.Tap, .06, .58, 46, .55),
            new ControlElement("kk", "kick", "Ногой", ControlKind.Tap, .79, .50, 54, .76),
            new ControlElement("hk", "hook", "Боковой", ControlKind.Tap, .79, .66, 54, .76),
            new ControlElement("up", "upper", "Апперкот", ControlKind.Tap, .90, .59, 54, .76),
            new ControlElement("lu", LadderUpAction, "Подъём по лестнице", ControlKind.Hold, .08, .24, 58, .75),
            new ControlElement("ld", LadderDownAction, "Спуск по лестнице", ControlKind.Hold, .08, .36, 58, .75)
        };

        private readonly Dictionary<string, ControlBinding> bindings =
            new Dictionary<string, ControlBinding>(StringComparer.OrdinalIgnoreCase);
        private readonly List<ControlElement> elements = new List<ControlElement>();

        private string profile = DefaultProfile;
        private SettingsTab selectedTab = SettingsTab.Graphics;
        private double lookSensitivity = 1;
        private bool invertY;
        private double ladderVertical;

        public ControlsSystem()
        {
            ResetDefaults();
        }

        public static IReadOnlyList<string> SettingsTabs { get { return Array.AsReadOnly(TabsInternal); } }
        public static IReadOnlyList<ControlBinding> DefaultBindings { get { return Array.AsReadOnly(DefaultBindingsInternal); } }
        public static IReadOnlyList<ControlElement> DefaultElements { get { return Array.AsReadOnly(DefaultElementsInternal); } }

        public IReadOnlyDictionary<string, ControlBinding> Bindings
        {
            get { return new ReadOnlyDictionary<string, ControlBinding>(bindings); }
        }

        public IReadOnlyList<ControlElement> Elements { get { return elements.AsReadOnly(); } }
        public int ElementCount { get { return elements.Count; } }
        public string Profile { get { return profile; } set { profile = string.IsNullOrEmpty(value) ? DefaultProfile : value; } }
        public SettingsTab SelectedTab { get { return selectedTab; } set { selectedTab = value; } }
        public string SelectedTabName { get { return SettingsTabs[(int)selectedTab]; } }
        public double LookSensitivity { get { return lookSensitivity; } set { lookSensitivity = SystemMath.Clamp(value, 0.3, 3); } }
        public bool InvertY { get { return invertY; } set { invertY = value; } }

        /// <summary>Вертикальный ввод лестницы: +1 вверх, -1 вниз.</summary>
        public double LadderVertical { get { return ladderVertical; } }
        public int LadderDirection { get { return ladderVertical > StickDeadZone ? 1 : ladderVertical < -StickDeadZone ? -1 : 0; } }
        public bool LadderUpPressed { get { return LadderDirection > 0; } }
        public bool LadderDownPressed { get { return LadderDirection < 0; } }
        public string LadderUpBinding { get { return GetBinding(LadderUpAction); } }
        public string LadderDownBinding { get { return GetBinding(LadderDownAction); } }

        public bool SetSettingsTab(string name)
        {
            if (string.IsNullOrEmpty(name)) return false;
            if (string.Equals(name, "gfx", StringComparison.OrdinalIgnoreCase)) name = TabsInternal[0];
            else if (string.Equals(name, "play", StringComparison.OrdinalIgnoreCase)) name = TabsInternal[1];
            else if (string.Equals(name, "snd", StringComparison.OrdinalIgnoreCase)) name = TabsInternal[2];
            else if (string.Equals(name, "ctl", StringComparison.OrdinalIgnoreCase)
                     || string.Equals(name, "system", StringComparison.OrdinalIgnoreCase)) name = TabsInternal[3];

            for (int i = 0; i < TabsInternal.Length; i++)
            {
                if (!string.Equals(name, TabsInternal[i], StringComparison.OrdinalIgnoreCase)) continue;
                selectedTab = (SettingsTab)i;
                return true;
            }
            return false;
        }

        /// <summary>Назначить клавишу действию. Пустая клавиша удаляет привязку.</summary>
        public bool Bind(string action, string key)
        {
            if (string.IsNullOrEmpty(action)) return false;
            if (string.IsNullOrEmpty(key))
            {
                return bindings.Remove(action);
            }
            ControlBinding binding;
            if (!bindings.TryGetValue(action, out binding))
            {
                binding = new ControlBinding(action, action, key);
                bindings[action] = binding;
            }
            binding.Key = key;
            return true;
        }

        public string GetBinding(string action)
        {
            if (string.IsNullOrEmpty(action)) return null;
            ControlBinding binding;
            return bindings.TryGetValue(action, out binding) ? binding.Key : null;
        }

        public ControlBinding GetBindingInfo(string action)
        {
            if (string.IsNullOrEmpty(action)) return null;
            ControlBinding binding;
            return bindings.TryGetValue(action, out binding) ? binding : null;
        }

        public void ResetDefaults()
        {
            bindings.Clear();
            foreach (ControlBinding binding in DefaultBindingsInternal)
                bindings[binding.Action] = new ControlBinding(binding.Action, binding.Label, binding.Key, binding.Kind);

            elements.Clear();
            foreach (ControlElement element in DefaultElementsInternal)
                elements.Add(Clone(element));

            profile = DefaultProfile;
            selectedTab = SettingsTab.Graphics;
            lookSensitivity = 1;
            invertY = false;
            ladderVertical = 0;
        }

        /// <summary>Прямой ввод лестницы: положительное значение — подъём.</summary>
        public void SetLadderVertical(double vertical)
        {
            ladderVertical = SystemMath.IsFinite(vertical) ? SystemMath.Clamp(vertical, -1, 1) : 0;
        }

        /// <summary>Экранный джойстик из controls.js: положительное Y означает движение вниз.</summary>
        public void SetScreenJoystick(double horizontal, double vertical)
        {
            if (!SystemMath.IsFinite(vertical)) { ladderVertical = 0; return; }
            double v = Math.Abs(vertical) < StickDeadZone ? 0 : vertical;
            ladderVertical = SystemMath.Clamp(-v, -1, 1);
        }

        /// <summary>Старый ввод world.js: input.my &lt; 0 означает подъём.</summary>
        public void SetOriginalLadderInput(double moveY)
        {
            SetLadderVertical(-moveY);
        }

        /// <summary>Изменить положение/размер кнопки в редакторе раскладки.</summary>
        public bool MoveElement(string uid, double x, double y)
        {
            ControlElement element = FindElement(uid);
            if (element == null) return false;
            element.X = SystemMath.Clamp(x, 0.02, 0.98);
            element.Y = SystemMath.Clamp(y, 0.03, 0.97);
            return true;
        }

        public ControlElement FindElement(string uid)
        {
            if (string.IsNullOrEmpty(uid)) return null;
            foreach (ControlElement element in elements)
                if (string.Equals(element.Uid, uid, StringComparison.OrdinalIgnoreCase)) return element;
            return null;
        }

        /// <summary>Простой устойчивый текстовый формат; подходит для PlayerPrefs и save-файлов.</summary>
        public string Serialize()
        {
            StringBuilder result = new StringBuilder();
            result.Append("version=").Append(FormatVersion).Append('\n');
            result.Append("profile=").Append(Escape(profile)).Append('\n');
            result.Append("tab=").Append(Escape(SelectedTabName)).Append('\n');
            result.Append("lookSens=").Append(lookSensitivity.ToString("R", CultureInfo.InvariantCulture)).Append('\n');
            result.Append("invertY=").Append(invertY ? 1 : 0).Append('\n');
            result.Append("ladder=").Append(ladderVertical.ToString("R", CultureInfo.InvariantCulture)).Append('\n');

            foreach (KeyValuePair<string, ControlBinding> pair in bindings)
            {
                ControlBinding binding = pair.Value;
                result.Append("bind=").Append(Escape(binding.Action)).Append('|')
                      .Append(Escape(binding.Label)).Append('|')
                      .Append(Escape(binding.Key)).Append('|')
                      .Append((int)binding.Kind).Append('\n');
            }

            foreach (ControlElement element in elements)
            {
                result.Append("element=").Append(Escape(element.Uid)).Append('|')
                      .Append(Escape(element.Action)).Append('|')
                      .Append(Escape(element.Label)).Append('|')
                      .Append((int)element.Kind).Append('|')
                      .Append(Number(element.X)).Append('|')
                      .Append(Number(element.Y)).Append('|')
                      .Append(Number(element.Size)).Append('|')
                      .Append(Number(element.Opacity)).Append('|')
                      .Append(Number(element.Hit)).Append('|')
                      .Append(Number(element.Sensitivity)).Append('\n');
            }
            return result.ToString();
        }

        public bool Deserialize(string data)
        {
            if (string.IsNullOrEmpty(data)) return false;

            Dictionary<string, ControlBinding> loadedBindings = new Dictionary<string, ControlBinding>(StringComparer.OrdinalIgnoreCase);
            List<ControlElement> loadedElements = new List<ControlElement>();
            string loadedProfile = DefaultProfile;
            SettingsTab loadedTab = SettingsTab.Graphics;
            double loadedSensitivity = 1;
            bool loadedInvert = false;
            double loadedLadder = 0;
            int version = 0;

            string[] lines = data.Replace("\r\n", "\n").Replace('\r', '\n').Split('\n');
            foreach (string rawLine in lines)
            {
                string line = rawLine.Trim();
                if (line.Length == 0 || line[0] == '#') continue;
                int equals = line.IndexOf('=');
                if (equals <= 0) continue;
                string key = line.Substring(0, equals);
                string value = line.Substring(equals + 1);

                switch (key)
                {
                    case "version":
                        version = ParseInt(value, 0);
                        break;
                    case "profile":
                        loadedProfile = Unescape(value);
                        break;
                    case "tab":
                        if (!TryParseTab(Unescape(value), out loadedTab)) loadedTab = SettingsTab.Graphics;
                        break;
                    case "lookSens":
                        loadedSensitivity = ParseDouble(value, 1);
                        break;
                    case "invertY":
                        loadedInvert = ParseInt(value, 0) != 0;
                        break;
                    case "ladder":
                        loadedLadder = ParseDouble(value, 0);
                        break;
                    case "bind":
                    {
                        string[] parts = SplitFields(value);
                        if (parts.Length < 3 || string.IsNullOrEmpty(parts[0])) break;
                        ControlKind kind = ParseKind(parts.Length > 3 ? parts[3] : "Tap");
                        loadedBindings[parts[0]] = new ControlBinding(parts[0], parts[1], parts[2], kind);
                        break;
                    }
                    case "element":
                    {
                        string[] parts = SplitFields(value);
                        if (parts.Length < 10 || string.IsNullOrEmpty(parts[0])) break;
                        loadedElements.Add(new ControlElement(
                            parts[0], parts[1], parts[2], ParseKind(parts[3]),
                            ParseDouble(parts[4], 0.5), ParseDouble(parts[5], 0.5),
                            ParseDouble(parts[6], 60), ParseDouble(parts[7], 0.8),
                            ParseDouble(parts[8], 1.2), ParseDouble(parts[9], 1)));
                        break;
                    }
                }
            }

            if (version != FormatVersion) return false;

            bindings.Clear();
            if (loadedBindings.Count == 0)
            {
                foreach (ControlBinding binding in DefaultBindingsInternal)
                    bindings[binding.Action] = new ControlBinding(binding.Action, binding.Label, binding.Key, binding.Kind);
            }
            else
            {
                foreach (KeyValuePair<string, ControlBinding> pair in loadedBindings) bindings[pair.Key] = pair.Value;
            }

            elements.Clear();
            if (loadedElements.Count == 0)
            {
                foreach (ControlElement element in DefaultElementsInternal) elements.Add(Clone(element));
            }
            else
            {
                elements.AddRange(loadedElements);
            }

            profile = string.IsNullOrEmpty(loadedProfile) ? DefaultProfile : loadedProfile;
            selectedTab = loadedTab;
            lookSensitivity = SystemMath.Clamp(loadedSensitivity, 0.3, 3);
            invertY = loadedInvert;
            ladderVertical = SystemMath.Clamp(loadedLadder, -1, 1);
            return true;
        }

        private static ControlElement Clone(ControlElement source)
        {
            return new ControlElement(source.Uid, source.Action, source.Label, source.Kind,
                source.X, source.Y, source.Size, source.Opacity, source.Hit, source.Sensitivity);
        }

        private static bool TryParseTab(string name, out SettingsTab tab)
        {
            for (int i = 0; i < TabsInternal.Length; i++)
            {
                if (!string.Equals(name, TabsInternal[i], StringComparison.OrdinalIgnoreCase)) continue;
                tab = (SettingsTab)i;
                return true;
            }
            tab = SettingsTab.Graphics;
            return false;
        }

        private static ControlKind ParseKind(string value)
        {
            ControlKind kind;
            return Enum.TryParse(value, true, out kind) ? kind : ControlKind.Tap;
        }

        private static string[] SplitFields(string value)
        {
            if (value == null) return new string[0];
            List<string> fields = new List<string>();
            StringBuilder current = new StringBuilder(value.Length);
            bool escaped = false;
            foreach (char c in value)
            {
                if (escaped)
                {
                    current.Append('\\').Append(c);
                    escaped = false;
                }
                else if (c == '\\')
                {
                    escaped = true;
                }
                else if (c == '|')
                {
                    fields.Add(Unescape(current.ToString()));
                    current.Length = 0;
                }
                else
                {
                    current.Append(c);
                }
            }
            if (escaped) current.Append('\\');
            fields.Add(Unescape(current.ToString()));
            return fields.ToArray();
        }

        private static string Number(double value)
        {
            return (SystemMath.IsFinite(value) ? value : 0).ToString("R", CultureInfo.InvariantCulture);
        }

        private static double ParseDouble(string value, double fallback)
        {
            double result;
            return double.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out result) ? result : fallback;
        }

        private static int ParseInt(string value, int fallback)
        {
            int result;
            return int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out result) ? result : fallback;
        }

        private static string Escape(string value)
        {
            if (value == null) return string.Empty;
            StringBuilder result = new StringBuilder(value.Length);
            foreach (char c in value)
            {
                if (c == '\\' || c == '|' || c == '\n' || c == '\r' || c == '=')
                    result.Append('\\');
                result.Append(c);
            }
            return result.ToString();
        }

        private static string Unescape(string value)
        {
            if (value == null) return string.Empty;
            StringBuilder result = new StringBuilder(value.Length);
            for (int i = 0; i < value.Length; i++)
            {
                if (value[i] == '\\' && i + 1 < value.Length)
                {
                    i++;
                    result.Append(value[i] == 'n' ? '\n' : value[i] == 'r' ? '\r' : value[i]);
                }
                else
                {
                    result.Append(value[i]);
                }
            }
            return result.ToString();
        }
    }
}
