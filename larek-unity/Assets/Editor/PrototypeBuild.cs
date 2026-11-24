#if UNITY_EDITOR
using System.IO;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEngine;

public static class PrototypeBuild
{
    [MenuItem("Larek/Build Android Prototype")]
    public static void Build()
    {
        Directory.CreateDirectory("Assets/Scenes");
        var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
        EditorSceneManager.SaveScene(scene, "Assets/Scenes/Prototype.unity");
        PlayerSettings.companyName = "Larek";
        PlayerSettings.productName = "Larek Prototype";
        PlayerSettings.SetApplicationIdentifier(BuildTargetGroup.Android, "com.larek.prototype");
        PlayerSettings.Android.minSdkVersion = AndroidSdkVersions.AndroidApiLevel23;
        PlayerSettings.SetScriptingBackend(BuildTargetGroup.Android, ScriptingImplementation.IL2CPP);
        PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARM64;
        Directory.CreateDirectory("Builds");
        var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions {
            scenes = new[] { "Assets/Scenes/Prototype.unity" },
            locationPathName = "Builds/LarekPrototype.apk",
            target = BuildTarget.Android,
            options = BuildOptions.None
        });
        if (report.summary.result != BuildResult.Succeeded)
            throw new System.Exception("Android build failed: " + report.summary.result);
        Debug.Log("Built prototype: " + report.summary.outputPath);
    }
}
#endif
