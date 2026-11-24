using System;
using System.Collections.Generic;

namespace Larek.Systems
{
    /// <summary>Одна запись каталога звуков из Assets/StreamingAssets/Game/audio.</summary>
    public sealed class AudioClipInfo
    {
        public readonly string Id;
        public readonly string FileName;
        public readonly string Category;
        public readonly bool Loop;

        public AudioClipInfo(string id, string fileName, string category, bool loop = false)
        {
            Id = id;
            FileName = fileName;
            Category = category;
            Loop = loop;
        }

        /// <summary>Путь внутри StreamingAssets (разделитель '/').</summary>
        public string StreamingPath { get { return "Game/audio/" + FileName; } }
        public string FileWithoutExtension
        {
            get { return FileName.EndsWith(".mp3", StringComparison.OrdinalIgnoreCase) ? FileName.Substring(0, FileName.Length - 4) : FileName; }
        }
    }

    /// <summary>
    /// Каталог всех 27 аудиофайлов оригинальной игры и преобразование имен файлов
    /// в логические события. Полностью свободен от Unity API — можно тестировать в NUnit.
    /// </summary>
    public static class AudioSystem
    {
        public const string StreamingFolder = "Game/audio";

        private static readonly AudioClipInfo[] ClipsInternal =
        {
            new AudioClipInfo("walk", "walk.mp3", "footsteps"),
            new AudioClipInfo("walk_snow", "walk_snow.mp3", "footsteps"),
            new AudioClipInfo("city", "city.mp3", "ambience", true),
            new AudioClipInfo("bus_engine", "bus_engine.mp3", "engine", true),
            new AudioClipInfo("car_engine", "car_engine.mp3", "engine", true),
            new AudioClipInfo("horn", "horn.mp3", "transport"),
            new AudioClipInfo("tv_ch1", "tv_ch1.mp3", "tv", true),
            new AudioClipInfo("tv_ch2", "tv_ch2.mp3", "tv", true),
            new AudioClipInfo("tv_ch3", "tv_ch3.mp3", "tv", true),
            new AudioClipInfo("tv_ch4", "tv_ch4.mp3", "tv", true),
            new AudioClipInfo("tv_ch5", "tv_ch5.mp3", "tv", true),
            new AudioClipInfo("tv_ch6", "tv_ch6.mp3", "tv", true),
            new AudioClipInfo("tv_ch7", "tv_ch7.mp3", "tv", true),
            new AudioClipInfo("tv_ch8", "tv_ch8.mp3", "tv", true),
            new AudioClipInfo("tv_ch9", "tv_ch9.mp3", "tv", true),
            new AudioClipInfo("tv_ch10", "tv_ch10.mp3", "tv", true),
            new AudioClipInfo("radio", "radio.mp3", "radio", true),
            new AudioClipInfo("shot", "shot.mp3", "weapon"),
            new AudioClipInfo("gun_open", "gun_open.mp3", "weapon"),
            new AudioClipInfo("gun_close", "gun_close.mp3", "weapon"),
            new AudioClipInfo("gun_shell", "gun_shell.mp3", "weapon"),
            new AudioClipInfo("gun_shell2", "gun_shell2.mp3", "weapon"),
            new AudioClipInfo("shell_drop", "shell_drop.mp3", "weapon"),
            new AudioClipInfo("gun_move", "gun_move.mp3", "weapon"),
            new AudioClipInfo("anthem", "anthem1992.mp3", "menu", true),
            new AudioClipInfo("dostavka", "dostavka.mp3", "voice"),
            new AudioClipInfo("stuk", "stuk.mp3", "door")
        };

        private static readonly Dictionary<string, string> Aliases =
            new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                { "footsteps_walk", "walk" },
                { "footsteps_snow", "walk_snow" },
                { "snow", "walk_snow" },
                { "city_ambience", "city" },
                { "ambience", "city" },
                { "engine_bus", "bus_engine" },
                { "engine_car", "car_engine" },
                { "bus", "bus_engine" },
                { "car", "car_engine" },
                { "gunshot", "shot" },
                { "gun_shot", "shot" },
                { "anthem1992", "anthem" },
                { "menu_anthem", "anthem" },
                { "magnet_click", "stuk" },
                { "magnet", "stuk" },
                { "beep", "stuk" },
                { "exit_beep", "stuk" },
                { "button_beep", "stuk" },
                { "knock", "stuk" },
                { "tv", "tv_ch1" },
                { "tv1", "tv_ch1" },
                { "tv2", "tv_ch2" },
                { "tv3", "tv_ch3" },
                { "tv4", "tv_ch4" },
                { "tv5", "tv_ch5" },
                { "tv6", "tv_ch6" },
                { "tv7", "tv_ch7" },
                { "tv8", "tv_ch8" },
                { "tv9", "tv_ch9" },
                { "tv10", "tv_ch10" },
                { "tv_1", "tv_ch1" },
                { "tv_2", "tv_ch2" },
                { "tv_3", "tv_ch3" },
                { "tv_4", "tv_ch4" },
                { "tv_5", "tv_ch5" },
                { "tv_6", "tv_ch6" },
                { "tv_7", "tv_ch7" },
                { "tv_8", "tv_ch8" },
                { "tv_9", "tv_ch9" },
                { "tv_10", "tv_ch10" }
            };

        private static readonly Dictionary<string, AudioClipInfo> ById = BuildIndex();

        /// <summary>Каталог всех клипов (27 штук).</summary>
        public static IReadOnlyList<AudioClipInfo> Clips
        {
            get { return Array.AsReadOnly(ClipsInternal); }
        }

        public static IReadOnlyDictionary<string, AudioClipInfo> ClipsById
        {
            get { return ById; }
        }

        public static int Count { get { return ClipsInternal.Length; } }

        /// <summary>Имя логического события по имени файла, id или псевдониму. null — неизвестный звук.</summary>
        public static string EventFor(string id)
        {
            if (string.IsNullOrEmpty(id)) return null;
            string key = Normalize(id);
            if (key.Length == 0) return null;

            string alias;
            if (Aliases.TryGetValue(key, out alias)) return alias;

            AudioClipInfo info;
            if (ById.TryGetValue(key, out info)) return info.Id;
            return null;
        }

        public static AudioClipInfo Find(string id)
        {
            string eventId = EventFor(id);
            if (eventId == null) return null;
            AudioClipInfo info;
            return ById.TryGetValue(eventId, out info) ? info : null;
        }

        public static string FileFor(string id)
        {
            AudioClipInfo info = Find(id);
            return info == null ? null : info.FileName;
        }

        public static bool IsKnown(string id)
        {
            return EventFor(id) != null;
        }

        private static Dictionary<string, AudioClipInfo> BuildIndex()
        {
            Dictionary<string, AudioClipInfo> result =
                new Dictionary<string, AudioClipInfo>(StringComparer.OrdinalIgnoreCase);
            foreach (AudioClipInfo info in ClipsInternal)
            {
                result[info.Id] = info;
                result[info.FileName] = info;
                result[info.FileWithoutExtension] = info;
            }
            return result;
        }

        private static string Normalize(string id)
        {
            string value = id.Trim();
            int slash = value.LastIndexOfAny(new[] { '/', '\\' });
            if (slash >= 0) value = value.Substring(slash + 1);
            if (value.EndsWith(".mp3", StringComparison.OrdinalIgnoreCase))
                value = value.Substring(0, value.Length - 4);
            value = value.Replace(' ', '_').Replace('-', '_');
            return value.ToLowerInvariant();
        }
    }
}
