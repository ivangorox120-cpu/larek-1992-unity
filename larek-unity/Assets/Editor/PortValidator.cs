#if UNITY_EDITOR
using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using Larek.Porting;
using UnityEditor;
using UnityEngine;

public static class PortValidator
{
    private static readonly string[] RequiredTypes =
    {
        "Larek.Gameplay.GameSession",
        "Larek.Gameplay.Inventory",
        "Larek.Gameplay.DialogueSystem",
        "Larek.Systems.TransportSystem",
        "Larek.Systems.NpcSystem",
        "Larek.Systems.PhoneSystem",
        "Larek.Systems.WeaponSystem",
        "Larek.Systems.HandSystem",
        "Larek.Systems.AudioSystem",
        "Larek.World.WorldBuilder",
        "Larek.World.WorldInteractions",
        "Larek.UI.UiBootstrap"
    };

    [MenuItem("Larek/Validate Full Port")]
    public static void Validate()
    {
        var report = new StringBuilder();
        report.Append("Ларёк 1992 — проверка полноты переноса\n");
        report.Append("Механик в реестре: ").Append(MechanicsCoverage.All.Count).Append('\n');

        bool ok = true;
        var assemblies = AppDomain.CurrentDomain.GetAssemblies();
        foreach (string typeName in RequiredTypes)
        {
            bool found = false;
            foreach (var assembly in assemblies)
                if (assembly.GetType(typeName) != null) { found = true; break; }
            report.Append(found ? "[OK] " : "[MISSING] ").Append(typeName).Append('\n');
            ok &= found;
        }

        string root = Path.Combine(Application.streamingAssetsPath, "Game");
        var expected = new Dictionary<string, int>
        {
            { "models", 81 }, { "tex", 62 }, { "audio", 27 }, { "video", 10 }, { "icons", 25 }, { "fonts", 5 }
        };
        foreach (KeyValuePair<string, int> pair in expected)
        {
            string folder = Path.Combine(root, pair.Key);
            int count = Directory.Exists(folder) ? Directory.GetFiles(folder).Length : 0;
            bool found = pair.Key == "video" ? count >= pair.Value : count == pair.Value;
            report.Append(found ? "[OK] " : "[MISSING] ")
                  .Append(pair.Key).Append(": ").Append(count).Append(" (ожидалось ").Append(pair.Value).Append(")\n");
            ok &= found;
        }

        report.Append(ok ? "РЕЗУЛЬТАТ: перенос полный\n" : "РЕЗУЛЬТАТ: есть пропуски\n");
        string directory = "Builds";
        Directory.CreateDirectory(directory);
        string path = Path.Combine(directory, "port-validation.txt");
        File.WriteAllText(path, report.ToString());
        Debug.Log(report.ToString());
    }
}
#endif
