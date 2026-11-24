using System;
using System.Globalization;

namespace Larek.Gameplay
{
    /// <summary>Типы погоды из world.js (weather.state).</summary>
    public enum WeatherKind
    {
        Clear,
        Overcast,
        Drizzle,
        Rain,
        LightSnow,
        Snow,
        Blizzard
    }

    /// <summary>Снимок цикла дня для полного сохранения.</summary>
    public sealed class DayCycleState
    {
        public int Day;
        public double Hour;
        public WeatherKind Weather;
        public double Snow;
        public double Wind;
        public double Fog;
        public double Rain;
    }

    /// <summary>
    /// Детерминированный цикл суток: 24 часа, погода меняется_once per day.
    /// Никаких UnityEngine и системных случайных чисел без явно переданного генератора.
    /// </summary>
    public sealed class DayCycle
    {
        public int Day = 1;
        public double Hour = 7.5;
        public double SecondsPerHour = 60.0;
        public Func<double> Random;

        private double accumulatedSeconds;
        private int seed = 1992;

        public string Weather { get; private set; }
        public WeatherKind Kind { get; private set; }
        public WeatherKind WeatherState { get { return Kind; } }
        public double Snow { get; private set; }
        public double Wind { get; private set; }
        public double Fog { get; private set; }
        public double Rain { get; private set; }
        public bool IsNight { get { return Hour < 7 || Hour >= 21; } }

        public event Action<int> DayChanged;

        public DayCycle()
        {
            ApplyWeather(true);
        }

        public DayCycle(int day) : this()
        {
            Restore(day, Hour);
        }

        public DayCycle(int day, double hour) : this()
        {
            Restore(day, hour);
        }

        public DayCycle(int day, Func<double> random) : this()
        {
            Random = random;
            ApplyWeather(true);
        }

        public DayCycle(int day, double hour, Func<double> random) : this()
        {
            Random = random;
            Restore(day, hour);
        }

        public string WeatherName
        {
            get
            {
                switch (Kind)
                {
                    case WeatherKind.Clear: return "ясно";
                    case WeatherKind.Overcast: return "пасмурно";
                    case WeatherKind.Drizzle: return "морось";
                    case WeatherKind.Rain: return "дождь";
                    case WeatherKind.LightSnow: return "небольшой снег";
                    case WeatherKind.Snow: return "снег";
                    default: return "буран";
                }
            }
        }

        public void Update(float deltaSeconds)
        {
            float dt = float.IsNaN(deltaSeconds) || deltaSeconds < 0 ? 0 : deltaSeconds;
            accumulatedSeconds += dt;
            double hours = accumulatedSeconds / SecondsPerHour;
            if (hours > 0)
            {
                accumulatedSeconds -= hours * SecondsPerHour;
                AdvanceHours(hours);
            }
        }

        public void Advance(float deltaSeconds)
        {
            Update(deltaSeconds);
        }

        public void AdvanceHours(double hours)
        {
            if (double.IsNaN(hours) || hours <= 0) return;
            double target = Hour + hours;
            while (target >= 24)
            {
                target -= 24;
                NextDay();
            }
            Hour = target;
        }

        public void NextDay()
        {
            Day = checked(Day + 1);
            ApplyWeather(false);
            if (DayChanged != null) DayChanged(Day);
        }

        public void SetHour(double hour)
        {
            if (double.IsNaN(hour)) return;
            while (hour >= 24)
            {
                hour -= 24;
                NextDay();
            }
            while (hour < 0) hour += 24;
            Hour = hour;
        }

        public void SetWeather(WeatherKind kind)
        {
            ApplyKind(kind, NextValue());
        }

        public void SetWeather(string state)
        {
            WeatherKind kind;
            if (TryParseWeather(state, out kind)) SetWeather(kind);
        }

        public void Restore(int day, double hour)
        {
            Day = day < 1 ? 1 : day;
            Hour = double.IsNaN(hour) ? 7.5 : WrapHour(hour);
            accumulatedSeconds = 0;
            ApplyWeather(false);
        }

        public void Restore(DayCycleState state)
        {
            if (state == null) throw new ArgumentNullException(nameof(state));
            Day = state.Day < 1 ? 1 : state.Day;
            Hour = double.IsNaN(state.Hour) ? 7.5 : WrapHour(state.Hour);
            ApplyKind(state.Weather, NextValue());
            Snow = Clamp01(state.Snow);
            Wind = Clamp01(state.Wind);
            Fog = Clamp01(state.Fog);
            Rain = Clamp01(state.Rain);
            accumulatedSeconds = 0;
        }

        public DayCycleState Capture()
        {
            return new DayCycleState
            {
                Day = Day,
                Hour = Hour,
                Weather = Kind,
                Snow = Snow,
                Wind = Wind,
                Fog = Fog,
                Rain = Rain
            };
        }

        private static double WrapHour(double hour)
        {
            while (hour >= 24) hour -= 24;
            while (hour < 0) hour += 24;
            return hour;
        }

        private static double Clamp01(double value)
        {
            if (double.IsNaN(value)) return 0;
            return value < 0 ? 0 : value > 1 ? 1 : value;
        }

        private void ApplyWeather(bool initial)
        {
            double value = NextValue();
            WeatherKind kind;
            if (initial && Day == 1) kind = WeatherKind.Snow;
            else if (value < 0.15) kind = WeatherKind.Clear;
            else if (value < 0.35) kind = WeatherKind.Overcast;
            else if (value < 0.50) kind = WeatherKind.Drizzle;
            else if (value < 0.62) kind = WeatherKind.Rain;
            else if (value < 0.78) kind = WeatherKind.LightSnow;
            else if (value < 0.92) kind = WeatherKind.Snow;
            else kind = WeatherKind.Blizzard;
            ApplyKind(kind, value);
        }

        private void ApplyKind(WeatherKind kind, double value)
        {
            Kind = kind;
            Weather = StateName(kind);
            double jitter = Math.Abs(value - 0.5) * 0.4;
            Snow = Clamp01((kind == WeatherKind.LightSnow ? 0.28 : kind == WeatherKind.Snow ? 0.65 : kind == WeatherKind.Blizzard ? 1.0 : 0.0) + jitter * 0.2);
            Wind = Clamp01((kind == WeatherKind.Blizzard ? 1.0 : kind == WeatherKind.Rain ? 0.55 : 0.3) + jitter);
            Fog = Clamp01((kind == WeatherKind.Blizzard ? 0.8 : kind == WeatherKind.Rain || kind == WeatherKind.Drizzle ? 0.35 : kind == WeatherKind.Overcast ? 0.15 : 0.0) + jitter * 0.2);
            Rain = Clamp01((kind == WeatherKind.Rain ? 1.0 : kind == WeatherKind.Drizzle ? 0.35 : 0.0) + jitter * 0.1);
        }

        private double NextValue()
        {
            double value;
            if (Random != null)
            {
                try { value = Random(); }
                catch { value = Hash01(Day, seed); }
            }
            else value = Hash01(Day, seed);
            if (double.IsNaN(value) || double.IsInfinity(value)) return 0.5;
            return Clamp01(value);
        }

        private static double Hash01(int day, int seed)
        {
            unchecked
            {
                uint x = (uint)(day * 92837111 ^ seed * 689287499);
                x ^= x >> 16;
                x *= 0x7feb352d;
                x ^= x >> 15;
                x *= 0x846ca68b;
                x ^= x >> 16;
                return (x & 0xffffff) / (double)0x1000000;
            }
        }

        public static string StateName(WeatherKind kind)
        {
            switch (kind)
            {
                case WeatherKind.Clear: return "clear";
                case WeatherKind.Overcast: return "overcast";
                case WeatherKind.Drizzle: return "drizzle";
                case WeatherKind.Rain: return "rain";
                case WeatherKind.LightSnow: return "light";
                case WeatherKind.Snow: return "normal";
                default: return "blizzard";
            }
        }

        public static bool TryParseWeather(string state, out WeatherKind kind)
        {
            switch ((state ?? string.Empty).Trim().ToLowerInvariant())
            {
                case "clear": case "ясно": kind = WeatherKind.Clear; return true;
                case "overcast": case "пасмурно": kind = WeatherKind.Overcast; return true;
                case "drizzle": case "морось": kind = WeatherKind.Drizzle; return true;
                case "rain": case "дождь": kind = WeatherKind.Rain; return true;
                case "light": case "lightsnow": case "небольшой снег": kind = WeatherKind.LightSnow; return true;
                case "normal": case "snow": case "снег": kind = WeatherKind.Snow; return true;
                case "blizzard": case "буран": kind = WeatherKind.Blizzard; return true;
                default:
                    return Enum.TryParse(state, true, out kind);
            }
        }

        public override string ToString()
        {
            return "day " + Day.ToString(CultureInfo.InvariantCulture) + ", " +
                   Hour.ToString("F2", CultureInfo.InvariantCulture) + ", " + Weather;
        }
    }
}
