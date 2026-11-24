using System;
using System.Collections.Generic;
using UnityEngine;

namespace Larek.UI
{
    public sealed class QualityPreset
    {
        public readonly string Key;
        public readonly string Label;
        public readonly int Shadows;
        public readonly int Draw;
        public readonly int NpcCount;
        public readonly int Snow;
        public readonly int Aniso;
        public readonly bool PostFx;

        public QualityPreset(string key, string label, int shadows, int draw, int npcCount, int snow, int aniso, bool postFx)
        {
            Key = key;
            Label = label;
            Shadows = shadows;
            Draw = draw;
            NpcCount = npcCount;
            Snow = snow;
            Aniso = aniso;
            PostFx = postFx;
        }
    }

    // Настройки «Ларька» хранятся в PlayerPrefs; paneль настроек и HUD читают одно и то же состояние.
    internal sealed class UiSettings
    {
        private const string Prefix = "Larek.UI.";
        private static UiSettings instance;

        public static UiSettings Instance
        {
            get
            {
                if (instance == null) instance = new UiSettings();
                return instance;
            }
        }

        public static readonly string[] PresetKeys = { "ultra_perf", "balanced", "high" };

        public static readonly Dictionary<string, QualityPreset> Presets = new Dictionary<string, QualityPreset>
        {
            { "ultra_perf", new QualityPreset("ultra_perf", "Ультра-производительность", 0, 65, 6, 150, 1, false) },
            { "balanced", new QualityPreset("balanced", "Баланс", 1024, 120, 14, 850, 4, true) },
            { "high", new QualityPreset("high", "Высокое качество", 1536, 155, 18, 1500, 8, true) }
        };

        public string Quality = "balanced";
        public float Bob = 1f;
        public float Master = 0.9f;
        public float Radio = 0.7f;
        public float Ambience = 0.6f;
        public int Toasts = 2;
        public int ShowFps = 1;
        public int ShowDiag;
        public int FpsCap = 60;
        public int Vsync = 1;
        public bool ChangeGame = true;
        public bool Retro;
        public bool Litter = true;
        public bool Drs = true;
        public bool Mute;
        public bool RadioOn = true;
        public float LookSensitivity = 1f;
        public bool InvertY;
        public int Shadows = 1024;
        public int Draw = 120;
        public int NpcCount = 14;
        public int MaxLights = 3;

        private readonly Dictionary<string, string> custom = new Dictionary<string, string>();

        public event Action Changed;

        private UiSettings()
        {
            Quality = Resolve(PlayerPrefs.GetString(Prefix + "quality", Quality));
            Bob = PlayerPrefs.GetFloat(Prefix + "bob", Bob);
            Master = PlayerPrefs.GetFloat(Prefix + "master", Master);
            Radio = PlayerPrefs.GetFloat(Prefix + "radio", Radio);
            Ambience = PlayerPrefs.GetFloat(Prefix + "ambience", Ambience);
            Toasts = PlayerPrefs.GetInt(Prefix + "toasts", Toasts);
            ShowFps = PlayerPrefs.GetInt(Prefix + "showFps", ShowFps);
            ShowDiag = PlayerPrefs.GetInt(Prefix + "showDiag", ShowDiag);
            FpsCap = PlayerPrefs.GetInt(Prefix + "fpsCap", FpsCap);
            Vsync = PlayerPrefs.GetInt(Prefix + "vsync", Vsync);
            ChangeGame = PlayerPrefs.GetInt(Prefix + "changeGame", 1) != 0;
            Retro = PlayerPrefs.GetInt(Prefix + "retro", 0) != 0;
            Litter = PlayerPrefs.GetInt(Prefix + "litter", 1) != 0;
            Drs = PlayerPrefs.GetInt(Prefix + "drs", 1) != 0;
            Mute = PlayerPrefs.GetInt(Prefix + "mute", 0) != 0;
            RadioOn = PlayerPrefs.GetInt(Prefix + "radioOn", 1) != 0;
            LookSensitivity = PlayerPrefs.GetFloat(Prefix + "sens", LookSensitivity);
            InvertY = PlayerPrefs.GetInt(Prefix + "invertY", 0) != 0;

            string storedCustom = PlayerPrefs.GetString(Prefix + "custom", string.Empty);
            string[] lines = storedCustom.Split('\n');
            foreach (string line in lines)
            {
                int separator = line.IndexOf('=');
                if (separator <= 0) continue;
                custom[line.Substring(0, separator)] = line.Substring(separator + 1);
            }

            QualityPreset preset = GetPreset(Quality);
            Shadows = PlayerPrefs.GetInt(Prefix + "shadows", preset.Shadows);
            Draw = PlayerPrefs.GetInt(Prefix + "draw", preset.Draw);
            NpcCount = PlayerPrefs.GetInt(Prefix + "npc", preset.NpcCount);
            MaxLights = PlayerPrefs.GetInt(Prefix + "maxLights", MaxLights);
        }

        public static string Resolve(string key)
        {
            if (string.IsNullOrEmpty(key)) return "balanced";
            if (key == "low" || key == "perf") return "ultra_perf";
            if (key == "medium") return "balanced";
            if (key == "max" || key == "high_quality") return "high";
            return Presets.ContainsKey(key) ? key : "balanced";
        }

        public static QualityPreset GetPreset(string key)
        {
            string resolved = Resolve(key);
            return Presets.TryGetValue(resolved, out QualityPreset preset) ? preset : Presets["balanced"];
        }

        public string AutoPreset()
        {
            int memory = SystemInfo.graphicsMemorySize;
            if (memory > 0 && memory < 1536) return "ultra_perf";
            if (memory >= 4096) return "high";
            return "balanced";
        }

        public string GetCustom(string key, string fallback)
        {
            return custom.TryGetValue(key, out string value) ? value : fallback;
        }

        public int GetCustomInt(string key, int fallback)
        {
            return int.TryParse(GetCustom(key, fallback.ToString()), out int value) ? value : fallback;
        }

        public void SetCustom(string key, string value)
        {
            custom[key] = value ?? string.Empty;
            Save();
        }

        public void ApplyPreset(string key)
        {
            Quality = Resolve(key);
            QualityPreset preset = GetPreset(Quality);
            Shadows = preset.Shadows;
            Draw = preset.Draw;
            NpcCount = preset.NpcCount;
            MaxLights = Quality == "ultra_perf" ? 2 : Quality == "high" ? 4 : 3;
            custom.Clear();
            Save();
        }

        public void Reset()
        {
            Quality = "balanced";
            Bob = 1f;
            Master = 0.9f;
            Radio = 0.7f;
            Ambience = 0.6f;
            Toasts = 2;
            ShowFps = 1;
            ShowDiag = 0;
            FpsCap = 60;
            Vsync = 1;
            ChangeGame = true;
            Retro = false;
            Litter = true;
            Drs = true;
            Mute = false;
            RadioOn = true;
            LookSensitivity = 1f;
            InvertY = false;
            ApplyPreset("balanced");
        }

        public void Save()
        {
            PlayerPrefs.SetString(Prefix + "quality", Quality);
            PlayerPrefs.SetFloat(Prefix + "bob", Bob);
            PlayerPrefs.SetFloat(Prefix + "master", Master);
            PlayerPrefs.SetFloat(Prefix + "radio", Radio);
            PlayerPrefs.SetFloat(Prefix + "ambience", Ambience);
            PlayerPrefs.SetInt(Prefix + "toasts", Toasts);
            PlayerPrefs.SetInt(Prefix + "showFps", ShowFps);
            PlayerPrefs.SetInt(Prefix + "showDiag", ShowDiag);
            PlayerPrefs.SetInt(Prefix + "fpsCap", FpsCap);
            PlayerPrefs.SetInt(Prefix + "vsync", Vsync);
            PlayerPrefs.SetInt(Prefix + "changeGame", ChangeGame ? 1 : 0);
            PlayerPrefs.SetInt(Prefix + "retro", Retro ? 1 : 0);
            PlayerPrefs.SetInt(Prefix + "litter", Litter ? 1 : 0);
            PlayerPrefs.SetInt(Prefix + "drs", Drs ? 1 : 0);
            PlayerPrefs.SetInt(Prefix + "mute", Mute ? 1 : 0);
            PlayerPrefs.SetInt(Prefix + "radioOn", RadioOn ? 1 : 0);
            PlayerPrefs.SetFloat(Prefix + "sens", LookSensitivity);
            PlayerPrefs.SetInt(Prefix + "invertY", InvertY ? 1 : 0);
            PlayerPrefs.SetInt(Prefix + "shadows", Shadows);
            PlayerPrefs.SetInt(Prefix + "draw", Draw);
            PlayerPrefs.SetInt(Prefix + "npc", NpcCount);
            PlayerPrefs.SetInt(Prefix + "maxLights", MaxLights);

            var lines = new List<string>();
            foreach (KeyValuePair<string, string> pair in custom) lines.Add(pair.Key + "=" + pair.Value);
            PlayerPrefs.SetString(Prefix + "custom", string.Join("\n", lines.ToArray()));
            PlayerPrefs.Save();

            Apply();
            Changed?.Invoke();
        }

        public void Apply()
        {
            try
            {
                QualitySettings.vSyncCount = Vsync != 0 ? 1 : 0;
                Application.targetFrameRate = FpsCap > 0 ? FpsCap : -1;
                QualitySettings.shadowResolution = Shadows >= 1536 ? ShadowResolution.VeryHigh
                    : Shadows >= 1024 ? ShadowResolution.High
                    : Shadows >= 512 ? ShadowResolution.Medium
                    : ShadowResolution.Low;
                AudioListener.volume = Mathf.Clamp01(Master);
                AudioListener.pause = Mute;
            }
            catch (Exception) { /* на 일부 целевых платформах настройки недоступны */ }
        }
    }
}
