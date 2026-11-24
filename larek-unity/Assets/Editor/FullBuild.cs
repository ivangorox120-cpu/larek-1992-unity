#if UNITY_EDITOR
using System;
using System.IO;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEngine;

public static class FullBuild
{
    [MenuItem("Larek/Build Full Game")]
    public static void Build()
    {
        Directory.CreateDirectory("Assets/Scenes");
        var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
        var root = new GameObject("Larek Game");
        AddByTypeName(root, "Larek.Gameplay.GameBootstrap, Larek.Gameplay");
        AddByTypeName(root, "Larek.World.WorldBuilder, Larek.World");
        AddByTypeName(root, "Larek.World.WorldInteractions, Larek.World");
        AddByTypeName(root, "Larek.World.WorldAudio, Larek.World");
        AddByTypeName(root, "Larek.Systems.Audio3DPlayer, Larek.Systems");
        EditorSceneManager.SaveScene(scene, "Assets/Scenes/Larek1992.unity");

        PlayerSettings.companyName = "Larek";
        PlayerSettings.productName = "Ларёк 1992";
        PlayerSettings.bundleVersion = "232";
        PlayerSettings.SetApplicationIdentifier(BuildTargetGroup.Android, "com.larek.game");
        PlayerSettings.Android.minSdkVersion = AndroidSdkVersions.AndroidApiLevel23;
        PlayerSettings.SetScriptingBackend(BuildTargetGroup.Android, ScriptingImplementation.IL2CPP);
        PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARM64;

        Directory.CreateDirectory("Builds");
        var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions
        {
            scenes = new[] { "Assets/Scenes/Larek1992.unity" },
            locationPathName = "Builds/Larek1992.apk",
            target = BuildTarget.Android,
            options = BuildOptions.None
        });
        if (report.summary.result != BuildResult.Succeeded)
            throw new Exception("Android build failed: " + report.summary.result);
        Debug.Log("Built full game: " + report.summary.outputPath);
    }

    private static void AddByTypeName(GameObject target, string assemblyQualifiedName)
    {
        Type type = Type.GetType(assemblyQualifiedName);
        if (type == null)
        {
            string shortName = assemblyQualifiedName.Split(',')[0];
            foreach (var assembly in AppDomain.CurrentDomain.GetAssemblies())
            {
                type = assembly.GetType(shortName);
                if (type != null) break;
            }
        }
        if (type == null || !typeof(Component).IsAssignableFrom(type))
        {
            Debug.LogWarning("Skipping missing component: " + assemblyQualifiedName);
            return;
        }
        target.AddComponent(type);
    }
}
#endif
