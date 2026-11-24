using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;
using Larek.Economy;
using Larek.Save;

namespace Larek.Gameplay
{
    /// <summary>Полный снимок: базовый LarekSave + дополнительные данные переноса.</summary>
    public sealed class GameSessionSnapshot
    {
        public LarekSave Save;
        public string Extras;
    }

    /// <summary>
    /// Корневой объект игровой логики. Не содержит ни одного UnityEngine-типа:
    /// экономика берётся из Larek.Economy, базовое сохранение — из Larek.Save.
    /// </summary>
    public sealed class GameSession
    {
        private const string ExtrasVersion = "1";

        private bool apartmentOpen;
        private bool apartmentUnlocked;

        /// <summary>Текущая сессия. Устанавливается NewGame/Restore, но может быть задана вручную.</summary>
        public static GameSession Current { get; set; }

        public KioskEconomy Economy { get; private set; }
        public Inventory Inventory { get; private set; }
        public PlayerState Player { get; private set; }
        public NotificationCenter Notifications { get; private set; }
        public DialogueSystem Dialogues { get; private set; }
        public DayCycle Days { get; private set; }
        public AdminPanel Admin { get; private set; }
        public Progression Progression { get; private set; }

        public float EntranceUnlockSeconds { get; set; }
        public bool ApartmentOpen
        {
            get { return apartmentOpen; }
            set { apartmentOpen = value; }
        }

        /// <summary>
        /// M11: состояние квартиры берётся только из сохранения. Никогда не выставляется
        /// принудительно при загрузке или создании сессии.
        /// </summary>
        public bool ApartmentUnlocked
        {
            get { return apartmentUnlocked || Progression.HasFlag(Progression.ApartmentUnlocked); }
            set
            {
                apartmentUnlocked = value;
                Progression.SetFlag(Progression.ApartmentUnlocked, value);
            }
        }

        public GameSession() : this(CreateDefaultRandom())
        {
        }

        private GameSession(Func<double> random)
        {
            if (random == null) random = CreateDefaultRandom();
            Economy = KioskEconomy.NewGame(random);
            Inventory = new Inventory();
            Player = new PlayerState();
            Notifications = new NotificationCenter();
            Dialogues = new DialogueSystem();
            Days = new DayCycle(Economy.Day, 7.5, random);
            Admin = new AdminPanel();
            Progression = new Progression();

            Admin.CodeRejected += delegate(string message) { Notifications.Show(message, "bad"); };
            Days.DayChanged += OnDayChanged;

            // Наследство дяди: ключ от квартиры и ключ от подъезда всегда есть в кармане.
            Inventory.Add(Inventory.KeyApartment, 1);
            Inventory.Add(Inventory.KeyEntrance, 1);
        }

        public static GameSession NewGame(Func<double> random = null)
        {
            var session = new GameSession(random);
            Current = session;
            return session;
        }

        public static GameSession Create(Func<double> random = null)
        {
            return NewGame(random);
        }

        private static Func<double> CreateDefaultRandom()
        {
            long state = 1992;
            return delegate
            {
                state = (state * 48271 + 11) & 0x7fffffff;
                return state / 2147483648.0;
            };
        }

        private void OnDayChanged(int day)
        {
            while (Economy.Day < day) Economy.AdvanceDay();
        }

        public void Update(float deltaSeconds)
        {
            float dt = float.IsNaN(deltaSeconds) || deltaSeconds < 0 ? 0 : deltaSeconds;
            Notifications.Update(dt);
            Dialogues.Update(dt);
            Days.Update(dt);
            if (EntranceUnlockSeconds > 0)
            {
                EntranceUnlockSeconds -= dt;
                if (EntranceUnlockSeconds < 0) EntranceUnlockSeconds = 0;
            }
        }

        public void Update(double deltaSeconds)
        {
            Update((float)Math.Max(0, double.IsNaN(deltaSeconds) ? 0 : deltaSeconds));
        }

        public LarekSave Capture()
        {
            return new LarekSave
            {
                Economy = Economy.Capture(),
                Player = new SavePosition
                {
                    X = Player.Position.X,
                    Y = Player.Position.Y,
                    Z = Player.Position.Z
                },
                EntranceUnlockSeconds = EntranceUnlockSeconds,
                ApartmentOpen = apartmentOpen,
                ApartmentUnlocked = ApartmentUnlocked
            };
        }

        public GameSessionSnapshot CaptureFull()
        {
            return new GameSessionSnapshot { Save = Capture(), Extras = SerializeExtras() };
        }

        public void Restore(LarekSave save)
        {
            if (save == null) throw new ArgumentNullException(nameof(save));
            if (save.Economy == null) throw new ArgumentException("Economy data is missing.", nameof(save));

            Economy.Restore(save.Economy);
            Player.SetPosition(new PlayerPosition(save.Player.X, save.Player.Y, save.Player.Z));
            EntranceUnlockSeconds = float.IsNaN(save.EntranceUnlockSeconds) || save.EntranceUnlockSeconds < 0
                ? 0 : save.EntranceUnlockSeconds;

            apartmentOpen = save.ApartmentOpen;
            apartmentUnlocked = save.ApartmentUnlocked;
            // M11: если в сохранении дверь заперта — флаг снимается, а не выставляется.
            Progression.SetFlag(Progression.ApartmentUnlocked, apartmentUnlocked);
            Days.Restore(save.Economy.Day, Days.Hour);
            Current = this;
        }

        public void TryRestore(LarekSave save)
        {
            if (save == null) return;
            Restore(save);
        }

        public void Restore(LarekSave save, string extras)
        {
            Restore(save);
            DeserializeExtras(extras);
        }

        public void Restore(GameSessionSnapshot snapshot)
        {
            if (snapshot == null) throw new ArgumentNullException(nameof(snapshot));
            Restore(snapshot.Save);
            DeserializeExtras(snapshot.Extras);
        }

        public bool TryAdminCode(string code)
        {
            return Admin.TryUnlock(code);
        }

        public void Notify(string message, string category = "")
        {
            Notifications.Show(message, category);
        }

        public Dialogue ShowDialog(string name, string text, IList<DialogueOption> options)
        {
            return Dialogues.Show(name, text, options);
        }

        public void UnlockApartment()
        {
            ApartmentUnlocked = true;
            Progression.Mark("aptUnlocked");
        }

        /// <summary>
        /// Дополнительные данные в формате key=value (одна пара на строку). Значения
        /// экранируются, поэтому в тексте safely хранятся русские сообщения и адреса.
        /// </summary>
        public string SerializeExtras()
        {
            var text = new StringBuilder();
            text.Append("version=").Append(ExtrasVersion).Append('\n');
            text.Append("day=").Append(Days.Day.ToString(CultureInfo.InvariantCulture)).Append('\n');
            text.Append("hour=").Append(Number(Days.Hour)).Append('\n');
            text.Append("weather=").Append(Escape(Days.Weather)).Append('\n');
            text.Append("snow=").Append(Number(Days.Snow)).Append('\n');
            text.Append("wind=").Append(Number(Days.Wind)).Append('\n');
            text.Append("fog=").Append(Number(Days.Fog)).Append('\n');
            text.Append("rain=").Append(Number(Days.Rain)).Append('\n');
            text.Append("admin=").Append(Bool(Admin.IsUnlocked)).Append('\n');
            text.Append("entrance=").Append(Number(EntranceUnlockSeconds)).Append('\n');
            text.Append("apartment=").Append(Bool(ApartmentUnlocked)).Append('\n');
            text.Append("apartmentopen=").Append(Bool(ApartmentOpen)).Append('\n');
            text.Append("held=").Append(Escape(Inventory.Hand)).Append('\n');

            foreach (InventoryEntry item in Inventory.Items)
                text.Append("item=").Append(Escape(item.Id)).Append(':').Append(item.Count.ToString(CultureInfo.InvariantCulture)).Append('\n');

            foreach (string flag in Progression.Flags)
                text.Append("flag=").Append(Escape(flag)).Append('\n');
            foreach (string place in Progression.Visited)
                text.Append("visited=").Append(Escape(place)).Append('\n');
            foreach (string mark in Progression.Marks)
                text.Append("mark=").Append(Escape(mark)).Append('\n');

            foreach (Notification notification in Notifications.Active)
                text.Append("toast=").Append(Escape(notification.Message)).Append(':')
                    .Append(Escape(notification.Category)).Append(':')
                    .Append(Number(notification.RemainingSeconds)).Append('\n');

            if (Dialogues.IsOpen)
                text.Append("dialog=").Append(Escape(Dialogues.Name)).Append(':').Append(Escape(Dialogues.Text)).Append('\n');

            return text.ToString();
        }

        /// <summary>
        /// Восстанавливает дополнительные данные. Неизвестные ключи и отсутствующие
        /// поля игнорируются, поэтому формат можно расширять без ломки старых сохранений.
        /// </summary>
        public void DeserializeExtras(string text)
        {
            if (string.IsNullOrEmpty(text)) return;

            var items = new Dictionary<string, int>(StringComparer.Ordinal);
            var flags = new List<string>();
            var visited = new List<string>();
            var marks = new List<string>();
            var toasts = new List<string[]>();

            bool itemsSeen = false, flagsSeen = false, visitedSeen = false, marksSeen = false;
            bool toastsSeen = false, handSeen = false;
            string hand = null;
            string dialogName = null, dialogText = null;
            int? day = null;
            double? hour = null;
            string weather = null;
            bool? admin = null, apartmentOpenValue = null, apartmentUnlockedValue = null;
            float? entrance = null;

            string[] lines = text.Split('\n');
            for (int i = 0; i < lines.Length; i++)
            {
                string line = lines[i].Trim();
                if (line.Length == 0 || line[0] == '#') continue;
                int separator = line.IndexOf('=');
                if (separator < 0) continue;
                string key = line.Substring(0, separator).Trim().ToLowerInvariant();
                string value = line.Substring(separator + 1).Trim();

                switch (key)
                {
                    case "version":
                        break;
                    case "day":
                    {
                        int parsed;
                        if (TryInt(value, out parsed)) day = parsed;
                        break;
                    }
                    case "hour":
                    {
                        double parsed;
                        if (TryReal(value, out parsed)) hour = parsed;
                        break;
                    }
                    case "weather":
                        weather = Unescape(value);
                        break;
                    case "snow":
                    case "wind":
                    case "fog":
                    case "rain":
                        break;
                    case "admin":
                    {
                        bool parsed;
                        if (TryBool(value, out parsed)) admin = parsed;
                        break;
                    }
                    case "entrance":
                    {
                        double parsed;
                        if (TryReal(value, out parsed)) entrance = (float)Math.Max(0, parsed);
                        break;
                    }
                    case "apartment":
                    case "apartmentunlocked":
                    {
                        bool parsed;
                        if (TryBool(value, out parsed)) apartmentUnlockedValue = parsed;
                        break;
                    }
                    case "apartmentopen":
                    {
                        bool parsed;
                        if (TryBool(value, out parsed)) apartmentOpenValue = parsed;
                        break;
                    }
                    case "held":
                    case "hand":
                    case "helditem":
                        handSeen = true;
                        hand = Unescape(value);
                        break;
                    case "item":
                    case "inv":
                    case "inventory":
                    {
                        itemsSeen = true;
                        ParseItems(value, items);
                        break;
                    }
                    case "flag":
                    case "flags":
                        flagsSeen = true;
                        AddTokens(value, flags);
                        break;
                    case "unflag":
                        flagsSeen = true;
                        break;
                    case "visited":
                        visitedSeen = true;
                        AddTokens(value, visited);
                        break;
                    case "mark":
                    case "marks":
                        marksSeen = true;
                        AddTokens(value, marks);
                        break;
                    case "toast":
                    case "notification":
                    case "notify":
                    {
                        toastsSeen = true;
                        string[] fields = value.Split(':');
                        string message = Unescape(fields[0]);
                        string category = fields.Length > 1 ? Unescape(fields[1]) : string.Empty;
                        float remaining = NotificationCenter.DefaultLifetimeSeconds;
                        if (fields.Length > 2)
                        {
                            double parsed;
                            if (TryReal(fields[2], out parsed)) remaining = (float)Math.Max(0, parsed);
                        }
                        toasts.Add(new string[] { message, category, Number(remaining) });
                        break;
                    }
                    case "dialog":
                    case "dialogue":
                    {
                        string[] fields = value.Split(':');
                        dialogName = Unescape(fields[0]);
                        dialogText = fields.Length > 1 ? Unescape(fields[1]) : string.Empty;
                        break;
                    }
                    default:
                    {
                        // Старый формат мог содержать просто money=10, guitar=1 и т. п.
                        int parsed;
                        if (TryInt(value, out parsed))
                        {
                            itemsSeen = true;
                            items[Inventory.Canonical(Unescape(key))] = parsed;
                        }
                        break;
                    }
                }
            }

            if (itemsSeen)
            {
                Inventory.Clear();
                foreach (KeyValuePair<string, int> pair in items)
                    if (pair.Value > 0) Inventory.SetCount(pair.Key, pair.Value);
            }
            if (handSeen)
            {
                if (string.IsNullOrEmpty(hand)) Inventory.ClearHand();
                else Inventory.Equip(hand);
            }
            if (flagsSeen)
            {
                Progression.Clear();
                foreach (string flag in flags) Progression.Mark(flag);
            }
            if (visitedSeen)
            {
                Progression.Visited.Clear();
                foreach (string place in visited) Progression.MarkVisited(place);
            }
            if (marksSeen)
            {
                Progression.Marks.Clear();
                foreach (string mark in marks) Progression.AddMark(mark);
            }
            if (toastsSeen)
            {
                Notifications.Clear();
                foreach (string[] fields in toasts)
                {
                    double remaining;
                    TryReal(fields[2], out remaining);
                    Notifications.Show(fields[0], fields[1], (float)Math.Max(0.0001, remaining));
                }
            }
            if (dialogName != null) Dialogues.Show(dialogName, dialogText, new List<DialogueOption>());
            if (day.HasValue) Days.Restore(day.Value, hour ?? Days.Hour);
            else if (hour.HasValue) Days.SetHour(hour.Value);
            if (weather != null) Days.SetWeather(weather);
            if (admin.HasValue)
            {
                if (admin.Value) Admin.Open();
                else Admin.Close();
            }
            if (entrance.HasValue) EntranceUnlockSeconds = entrance.Value;
            if (apartmentOpenValue.HasValue) apartmentOpen = apartmentOpenValue.Value;
            // Порядок важен: флаги прогресса уже восстановлены, а состояние двери из extras
            // должно остаться согласованным с ними.
            if (apartmentUnlockedValue.HasValue) ApartmentUnlocked = apartmentUnlockedValue.Value;
        }

        private static void ParseItems(string value, Dictionary<string, int> result)
        {
            string[] chunks = value.Split(';');
            foreach (string chunk in chunks)
            {
                if (chunk.Length == 0) continue;
                string[] fields = chunk.Split(',');
                foreach (string field in fields)
                {
                    int colon = field.IndexOf(':');
                    if (colon < 0) continue;
                    int count;
                    if (!TryInt(field.Substring(colon + 1), out count)) continue;
                    string id = Inventory.Canonical(Unescape(field.Substring(0, colon)));
                    if (id.Length > 0) result[id] = count;
                }
            }
        }

        private static void AddTokens(string value, List<string> result)
        {
            string[] chunks = value.Split(';', ',');
            foreach (string chunk in chunks)
            {
                string token = Unescape(chunk.Trim());
                if (token.Length > 0) result.Add(token);
            }
        }

        private static string Number(double value)
        {
            return value.ToString("R", CultureInfo.InvariantCulture);
        }

        private static bool TryInt(string value, out int result)
        {
            return int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out result);
        }

        private static bool TryReal(string value, out double result)
        {
            return double.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out result);
        }

        private static bool TryBool(string value, out bool result)
        {
            switch ((value ?? string.Empty).ToLowerInvariant())
            {
                case "1": case "true": case "yes": case "on": result = true; return true;
                case "0": case "false": case "no": case "off": result = false; return true;
                default: result = false; return false;
            }
        }

        private static string Bool(bool value)
        {
            return value ? "1" : "0";
        }

        private static string Escape(string value)
        {
            if (value == null) return string.Empty;
            var text = new StringBuilder(value.Length);
            foreach (char c in value)
            {
                switch (c)
                {
                    case '%': text.Append("%25"); break;
                    case '\\': text.Append("%5C"); break;
                    case '\n': text.Append("%0A"); break;
                    case '\r': text.Append("%0D"); break;
                    case ':': text.Append("%3A"); break;
                    case '=': text.Append("%3D"); break;
                    case ';': text.Append("%3B"); break;
                    case ',': text.Append("%2C"); break;
                    case '|': text.Append("%7C"); break;
                    default: text.Append(c); break;
                }
            }
            return text.ToString();
        }

        private static string Unescape(string value)
        {
            if (value == null) return string.Empty;
            if (value.IndexOf('%') < 0) return value;
            var text = new StringBuilder(value.Length);
            for (int i = 0; i < value.Length; i++)
            {
                if (value[i] != '%' || i + 2 >= value.Length)
                {
                    text.Append(value[i]);
                    continue;
                }
                int high = Hex(value[i + 1]);
                int low = Hex(value[i + 2]);
                if (high < 0 || low < 0)
                {
                    text.Append(value[i]);
                    continue;
                }
                text.Append((char)((high << 4) | low));
                i += 2;
            }
            return text.ToString();
        }

        private static int Hex(char c)
        {
            if (c >= '0' && c <= '9') return c - '0';
            if (c >= 'a' && c <= 'f') return c - 'a' + 10;
            if (c >= 'A' && c <= 'F') return c - 'A' + 10;
            return -1;
        }
    }
}
