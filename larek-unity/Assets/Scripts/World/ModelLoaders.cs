using System;
using System.Collections.Generic;
using System.Reflection;
using System.Threading.Tasks;
using UnityEngine;

namespace Larek.World
{
    /// <summary>Загрузчик GLB-моделей из StreamingAssets.</summary>
    public interface IModelLoader
    {
        GameObject Load(string modelFileName);
    }

    /// <summary>
    /// Загружает GLB через UnityGLTF, не ссылаясь на его типы на этапе компиляции.
    /// Если пакет отсутствует или модель испорчена — возвращает примитивную подстановку.
    /// </summary>
    public sealed class GltfModelLoader : IModelLoader
    {
        private const BindingFlags Flags = BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance;

        private static readonly HashSet<string> Warned = new HashSet<string>();
        private static Type importerType;
        private static bool importerTypeResolved;

        private readonly FallbackModelLoader fallback = new FallbackModelLoader();

        [Tooltip("Использовать примитивную модель, если GLB недоступен")]
        public bool UseFallback = true;

        [Tooltip("Максимум ожидания асинхронного импортера, сек")]
        public float AsyncTimeoutSeconds = 10f;

        private GameObject capturedScene;

        private static Type ImporterType
        {
            get
            {
                if (importerTypeResolved) return importerType;
                importerTypeResolved = true;
                Assembly[] assemblies;
                try { assemblies = AppDomain.CurrentDomain.GetAssemblies(); }
                catch { return importerType; }

                foreach (Assembly assembly in assemblies)
                {
                    Type type = SafeGetType(assembly, "UnityGLTF.GLTFSceneImporter");
                    if (type != null) { importerType = type; return type; }
                }
                foreach (Assembly assembly in assemblies)
                {
                    Type type = SafeGetType(assembly, "GLTFSceneImporter");
                    if (type != null) { importerType = type; return type; }
                }
                foreach (Assembly assembly in assemblies)
                {
                    Type[] types;
                    try { types = assembly.GetTypes(); }
                    catch (ReflectionTypeLoadException e) { types = e.Types; }
                    catch { continue; }
                    if (types == null) continue;
                    foreach (Type type in types)
                    {
                        if (type == null || !type.Name.Contains("GLTFSceneImporter")) continue;
                        importerType = type;
                        return type;
                    }
                }
                return null;
            }
        }

        private static Type SafeGetType(Assembly assembly, string fullName)
        {
            try { return assembly.GetType(fullName, false, false); }
            catch { return null; }
        }

        public GameObject Load(string modelFileName)
        {
            if (string.IsNullOrEmpty(modelFileName)) return null;

            GameObject loaded = null;
            string path = GameAssetPaths.Model(modelFileName);
            Type type = ImporterType;
            if (type == null)
            {
                Warn(modelFileName, "UnityGLTF.GLTFSceneImporter не найден — используется структурная подстановка");
            }
            else
            {
                try
                {
                    object importer = CreateImporter(type, path);
                    if (importer == null) throw new InvalidOperationException("Не удалось создать GLTFSceneImporter");
                    capturedScene = null;
                    object result = InvokeImport(importer, "LoadScene", path);
                    if (result == null) result = InvokeImport(importer, "LoadSceneAsync", path);
                    loaded = ExtractScene(result, importer);
                }
                catch (Exception e)
                {
                    Warn(modelFileName, "GLTF-импорт не удался: " + e.GetType().Name + " — " + e.Message);
                }
            }

            if (loaded == null && UseFallback) loaded = fallback.Create(modelFileName);
            if (loaded != null)
            {
                loaded.name = modelFileName.Replace(".glb", string.Empty);
                foreach (Renderer renderer in loaded.GetComponentsInChildren<Renderer>(true))
                    renderer.frustumCulled = true;
            }
            return loaded;
        }

        private object CreateImporter(Type type, string path)
        {
            ConstructorInfo[] constructors = type.GetConstructors(Flags);
            Array.Sort(constructors, (a, b) => a.GetParameters().Length.CompareTo(b.GetParameters().Length));
            foreach (ConstructorInfo constructor in constructors)
            {
                ParameterInfo[] parameters = constructor.GetParameters();
                object[] args = new object[parameters.Length];
                bool usable = true;
                bool pathProvided = false;
                for (int i = 0; i < parameters.Length; i++)
                {
                    Type parameterType = parameters[i].ParameterType;
                    if (!pathProvided && parameterType == typeof(string))
                    {
                        args[i] = path;
                        pathProvided = true;
                    }
                    else if (parameters[i].IsOptional) args[i] = Type.Missing;
                    else if (parameterType.IsValueType) args[i] = Activator.CreateInstance(parameterType);
                    else args[i] = null;
                }
                if (!pathProvided && parameters.Length > 0) usable = false;
                if (!usable) continue;
                try { return constructor.Invoke(args); }
                catch { /* пробуем следующую сигнатуру */ }
            }
            return null;
        }

        private object InvokeImport(object importer, string methodName, string path)
        {
            MethodInfo[] methods = importer.GetType().GetMethods(Flags);
            var candidates = new List<MethodInfo>();
            foreach (MethodInfo method in methods)
                if (method.Name == methodName && !method.IsGenericMethodDefinition) candidates.Add(method);
            candidates.Sort((a, b) => a.GetParameters().Length.CompareTo(b.GetParameters().Length));

            foreach (MethodInfo method in candidates)
            {
                ParameterInfo[] parameters = method.GetParameters();
                object[] args = new object[parameters.Length];
                bool usable = true;
                bool pathProvided = false;
                for (int i = 0; i < parameters.Length; i++)
                {
                    Type parameterType = parameters[i].ParameterType;
                    if (parameterType.IsByRef || parameterType.IsPointer) { usable = false; break; }
                    if (!pathProvided && parameterType == typeof(string))
                    {
                        args[i] = path;
                        pathProvided = true;
                    }
                    else if (parameterType.IsGenericType &&
                             parameterType.GetGenericTypeDefinition() == typeof(Action<>) &&
                             parameterType.GetGenericArguments()[0] == typeof(GameObject))
                    {
                        MethodInfo handler = typeof(GltfModelLoader).GetMethod("CaptureScene", BindingFlags.NonPublic | BindingFlags.Instance);
                        args[i] = Delegate.CreateDelegate(parameterType, this, handler);
                    }
                    else if (parameters[i].IsOptional) args[i] = Type.Missing;
                    else if (parameterType == typeof(int)) args[i] = -1;
                    else if (parameterType == typeof(bool)) args[i] = false;
                    else if (parameterType.IsValueType) args[i] = Activator.CreateInstance(parameterType);
                    else args[i] = null;
                }
                if (!usable) continue;

                try
                {
                    object result = method.Invoke(importer, args);
                    result = AwaitIfNeeded(result);
                    if (result != null) return result;
                    if (capturedScene != null) return capturedScene;
                }
                catch (TargetInvocationException e)
                {
                    throw e.InnerException ?? e;
                }
                catch { /* пробуем другую перегрузку */ }
            }
            return capturedScene;
        }

        private void CaptureScene(GameObject scene)
        {
            if (scene != null) capturedScene = scene;
        }

        private object AwaitIfNeeded(object result)
        {
            Task task = result as Task;
            if (task == null) return result;
            try
            {
                if (!task.Wait(TimeSpan.FromSeconds(Mathf.Max(1f, AsyncTimeoutSeconds)))) return null;
                Type taskType = task.GetType();
                if (taskType.IsGenericType && taskType.GetGenericTypeDefinition() == typeof(Task<>))
                {
                    PropertyInfo property = taskType.GetProperty("Result");
                    return property != null ? property.GetValue(task, null) : null;
                }
            }
            catch { return null; }
            return task;
        }

        private static GameObject ExtractScene(object result, object importer)
        {
            GameObject fromResult = AsGameObject(result);
            if (fromResult != null) return fromResult;
            if (importer == null) return null;

            string[] propertyNames = { "LastLoadedScene", "Scene", "LoadedScene", "Root", "RootObject" };
            foreach (string name in propertyNames)
            {
                object value = ReadMember(importer, name);
                GameObject candidate = AsGameObject(value);
                if (candidate != null) return candidate;
            }
            foreach (string name in propertyNames)
            {
                object value = ReadMember(result, name);
                GameObject candidate = AsGameObject(value);
                if (candidate != null) return candidate;
            }
            return null;
        }

        private static GameObject AsGameObject(object value)
        {
            GameObject go = value as GameObject;
            if (go != null) return go;
            Component component = value as Component;
            if (component != null) return component.gameObject;

            if (value == null) return null;
            Type type = value.GetType();
            // UnityEngine.SceneManagement.Scene: тип сцены не упоминаем в коде, чтобы не создавать лишнюю зависимость.
            if (type.FullName == "UnityEngine.SceneManagement.Scene")
            {
                MethodInfo method = type.GetMethod("GetRootGameObjects");
                if (method != null)
                {
                    object[] roots = method.Invoke(value, null) as object[];
                    if (roots != null && roots.Length > 0) return AsGameObject(roots[0]);
                }
            }
            return null;
        }

        private static object ReadMember(object target, string name)
        {
            if (target == null) return null;
            Type type = target.GetType();
            PropertyInfo property = type.GetProperty(name, Flags);
            if (property != null && property.CanRead)
            {
                try { return property.GetValue(target, null); }
                catch { /* ignore */ }
            }
            FieldInfo field = type.GetField(name, Flags);
            if (field != null)
            {
                try { return field.GetValue(target); }
                catch { /* ignore */ }
            }
            return null;
        }

        private static void Warn(string modelFileName, string message)
        {
            if (!Warned.Add(modelFileName)) return;
            Debug.LogWarning("[Larek.World] " + modelFileName + ": " + message);
        }
    }

    /// <summary>Простые геометрические подстановки, когда GLB недоступен.</summary>
    public sealed class FallbackModelLoader : IModelLoader
    {
        private static readonly Dictionary<string, Material> MaterialCache = new Dictionary<string, Material>();

        public GameObject Load(string modelFileName) => Create(modelFileName);

        public GameObject Create(string modelFileName)
        {
            if (string.IsNullOrEmpty(modelFileName)) return null;
            WorldModel model = WorldCatalogue.Get(modelFileName);
            ModelRole role = model != null ? model.Role : InferRole(modelFileName);
            GameObject root = new GameObject("fallback_" + modelFileName.Replace(".glb", string.Empty));

            if ((role & ModelRole.Bus) != 0) BuildBus(root.transform);
            else if ((role & ModelRole.BusStop) != 0) BuildBusStop(root.transform);
            else if ((role & ModelRole.Person) != 0) BuildPerson(root.transform, modelFileName);
            else if ((role & ModelRole.Vehicle) != 0) BuildVehicle(root.transform);
            else if ((role & ModelRole.Fridge) != 0) BuildFridge(root.transform);
            else if ((role & ModelRole.Tv) != 0) BuildTv(root.transform);
            else if ((role & ModelRole.Radio) != 0) BuildRadio(root.transform);
            else if ((role & ModelRole.Alarm) != 0) BuildAlarm(root.transform);
            else if ((role & ModelRole.Furniture) != 0) BuildChair(root.transform);
            else if ((role & ModelRole.Nature) != 0) BuildNature(root.transform);
            else if ((role & ModelRole.Kiosk) != 0) BuildBox(root.transform, new Vector3(0, 1.25f, 0), new Vector3(3f, 2.5f, 2.4f), new Color(0.16f, 0.29f, 0.45f));
            else if ((role & ModelRole.Apartment) != 0) BuildApartment(root.transform);
            else BuildBox(root.transform, new Vector3(0, 0.5f, 0), new Vector3(0.5f, 1f, 0.5f), new Color(0.55f, 0.46f, 0.34f));

            foreach (Renderer renderer in root.GetComponentsInChildren<Renderer>(true)) renderer.frustumCulled = true;
            return root;
        }

        private static ModelRole InferRole(string fileName)
        {
            string lower = fileName.ToLowerInvariant();
            if (lower.Contains("bus")) return ModelRole.Bus;
            if (lower.Contains("police")) return ModelRole.Person | ModelRole.Police;
            if (lower.Contains("npc_")) return ModelRole.Person | ModelRole.Pedestrian;
            if (lower.Contains("vaz") || lower.Contains("bmw")) return ModelRole.Vehicle;
            if (lower.Contains("tree") || lower.Contains("bush") || lower.Contains("forest")) return ModelRole.Nature;
            if (lower.Contains("chair") || lower.Contains("kreslo")) return ModelRole.Furniture;
            if (lower.Contains("radio")) return ModelRole.Radio;
            if (lower.Contains("rubin")) return ModelRole.Tv;
            if (lower.Contains("vityaz")) return ModelRole.Alarm;
            return ModelRole.Item;
        }

        private static Material Mat(Color color)
        {
            string key = ColorUtility.ToHtmlStringRGBA(color);
            Material material;
            if (!MaterialCache.TryGetValue(key, out material))
            {
                Shader shader = Shader.Find("Standard");
                if (shader == null) shader = Shader.Find("Universal Render Pipeline/Lit");
                if (shader == null) shader = Shader.Find("Diffuse");
                material = shader != null ? new Material(shader) : null;
                if (material != null) material.color = color;
                MaterialCache[key] = material;
            }
            return material;
        }

        private static GameObject Part(Transform parent, string name, PrimitiveType primitive, Vector3 position, Vector3 scale, Color color)
        {
            GameObject go = GameObject.CreatePrimitive(primitive);
            go.name = name;
            go.transform.SetParent(parent, false);
            go.transform.localPosition = position;
            go.transform.localScale = scale;
            Material material = Mat(color);
            if (material != null) go.GetComponent<Renderer>().sharedMaterial = material;
            Collider collider = go.GetComponent<Collider>();
            if (collider != null) collider.enabled = false;
            return go;
        }

        private static void BuildBox(Transform parent, Vector3 position, Vector3 scale, Color color) =>
            Part(parent, "body", PrimitiveType.Cube, position, scale, color);

        private static void BuildBus(Transform parent)
        {
            Part(parent, "body", PrimitiveType.Cube, new Vector3(0, 1.42f, 0), new Vector3(7.2f, 2.0f, 2.25f), new Color(0.82f, 0.65f, 0.34f));
            Part(parent, "roof", PrimitiveType.Cube, new Vector3(0, 2.52f, 0), new Vector3(7.15f, 0.22f, 2.3f), new Color(0.86f, 0.72f, 0.44f));
            Part(parent, "stripe", PrimitiveType.Cube, new Vector3(0, 0.95f, 1.14f), new Vector3(7.2f, 0.24f, 0.03f), new Color(0.56f, 0.12f, 0.10f));
            for (int i = 0; i < 5; i++)
                Part(parent, "window_" + i, PrimitiveType.Cube, new Vector3(-2.6f + i * 1.3f, 1.85f, 1.14f), new Vector3(1.05f, 0.65f, 0.02f), new Color(0.33f, 0.43f, 0.48f));
            for (int i = 0; i < 4; i++)
            {
                float x = i < 2 ? -2.35f : 2.35f;
                float z = i % 2 == 0 ? 1.05f : -1.05f;
                Part(parent, "wheel_" + i, PrimitiveType.Cylinder, new Vector3(x, 0.46f, z), new Vector3(0.92f, 0.28f, 0.92f), new Color(0.08f, 0.08f, 0.09f))
                    .transform.localRotation = Quaternion.Euler(0, 0, 90);
            }
        }

        private static void BuildBusStop(Transform parent)
        {
            Part(parent, "floor", PrimitiveType.Cube, new Vector3(0, 0.05f, 0), new Vector3(3.6f, 0.1f, 1.8f), new Color(0.48f, 0.51f, 0.53f));
            Part(parent, "roof", PrimitiveType.Cube, new Vector3(0, 2.35f, 0), new Vector3(3.8f, 0.12f, 2f), new Color(0.16f, 0.30f, 0.48f));
            for (int i = -1; i <= 1; i += 2)
                for (int j = -1; j <= 1; j += 2)
                    Part(parent, "post", PrimitiveType.Cylinder, new Vector3(i * 1.6f, 1.2f, j * 0.75f), new Vector3(0.09f, 1.2f, 0.09f), new Color(0.55f, 0.57f, 0.58f));
            Part(parent, "bench", PrimitiveType.Cube, new Vector3(0, 0.52f, 0.55f), new Vector3(2.6f, 0.10f, 0.42f), new Color(0.42f, 0.26f, 0.14f));
        }

        private static void BuildPerson(Transform parent, string fileName)
        {
            Color coat = fileName.Contains("police") ? new Color(0.12f, 0.20f, 0.34f)
                : fileName.Contains("_w") ? new Color(0.38f, 0.40f, 0.43f)
                : new Color(0.44f, 0.32f, 0.28f);
            Part(parent, "torso", PrimitiveType.Capsule, new Vector3(0, 1.05f, 0), new Vector3(0.48f, 0.62f, 0.32f), coat);
            Part(parent, "head", PrimitiveType.Sphere, new Vector3(0, 1.68f, 0), new Vector3(0.24f, 0.28f, 0.24f), new Color(0.78f, 0.62f, 0.52f));
            Part(parent, "left_leg", PrimitiveType.Cylinder, new Vector3(-0.13f, 0.40f, 0), new Vector3(0.13f, 0.42f, 0.13f), new Color(0.16f, 0.17f, 0.20f));
            Part(parent, "right_leg", PrimitiveType.Cylinder, new Vector3(0.13f, 0.40f, 0), new Vector3(0.13f, 0.42f, 0.13f), new Color(0.16f, 0.17f, 0.20f));
        }

        private static void BuildVehicle(Transform parent)
        {
            Part(parent, "body", PrimitiveType.Cube, new Vector3(0, 0.65f, 0), new Vector3(4.2f, 0.85f, 1.75f), new Color(0.52f, 0.56f, 0.58f));
            Part(parent, "cabin", PrimitiveType.Cube, new Vector3(-0.25f, 1.25f, 0), new Vector3(2.2f, 0.72f, 1.6f), new Color(0.43f, 0.47f, 0.50f));
            for (int i = 0; i < 4; i++)
            {
                float x = i < 2 ? -1.4f : 1.4f;
                float z = i % 2 == 0 ? 0.88f : -0.88f;
                Part(parent, "wheel_" + i, PrimitiveType.Cylinder, new Vector3(x, 0.34f, z), new Vector3(0.68f, 0.22f, 0.68f), new Color(0.08f, 0.08f, 0.09f))
                    .transform.localRotation = Quaternion.Euler(0, 0, 90);
            }
        }

        private static void BuildFridge(Transform parent)
        {
            Part(parent, "case", PrimitiveType.Cube, new Vector3(0, 0.85f, 0), new Vector3(0.62f, 1.7f, 0.62f), new Color(0.91f, 0.91f, 0.86f));
            Part(parent, "door", PrimitiveType.Cube, new Vector3(0, 0.98f, 0.32f), new Vector3(0.56f, 1.35f, 0.03f), new Color(0.83f, 0.85f, 0.82f));
            Part(parent, "handle", PrimitiveType.Cube, new Vector3(0.23f, 1.25f, 0.35f), new Vector3(0.03f, 0.24f, 0.03f), new Color(0.72f, 0.68f, 0.58f));
        }

        private static void BuildTv(Transform parent)
        {
            Part(parent, "case", PrimitiveType.Cube, new Vector3(0, 0.24f, 0), new Vector3(0.58f, 0.47f, 0.36f), new Color(0.36f, 0.20f, 0.12f));
            Part(parent, "screen", PrimitiveType.Cube, new Vector3(-0.05f, 0.25f, 0.19f), new Vector3(0.37f, 0.30f, 0.02f), new Color(0.19f, 0.25f, 0.28f));
        }

        private static void BuildRadio(Transform parent)
        {
            Part(parent, "case", PrimitiveType.Cube, new Vector3(0, 0.12f, 0), new Vector3(0.30f, 0.22f, 0.13f), new Color(0.18f, 0.19f, 0.20f));
            Part(parent, "dial", PrimitiveType.Cube, new Vector3(-0.04f, 0.14f, 0.07f), new Vector3(0.16f, 0.07f, 0.01f), new Color(0.74f, 0.62f, 0.35f));
        }

        private static void BuildAlarm(Transform parent)
        {
            Part(parent, "case", PrimitiveType.Cylinder, new Vector3(0, 0.08f, 0), new Vector3(0.16f, 0.07f, 0.16f), new Color(0.82f, 0.80f, 0.70f))
                .transform.localRotation = Quaternion.Euler(90, 0, 0);
        }

        private static void BuildChair(Transform parent)
        {
            Part(parent, "seat", PrimitiveType.Cube, new Vector3(0, 0.44f, 0), new Vector3(0.44f, 0.05f, 0.44f), new Color(0.54f, 0.20f, 0.16f));
            Part(parent, "back", PrimitiveType.Cube, new Vector3(0, 0.72f, -0.20f), new Vector3(0.42f, 0.52f, 0.04f), new Color(0.54f, 0.20f, 0.16f));
            for (int i = -1; i <= 1; i += 2)
                for (int j = -1; j <= 1; j += 2)
                    Part(parent, "leg", PrimitiveType.Cylinder, new Vector3(i * 0.18f, 0.22f, j * 0.18f), new Vector3(0.04f, 0.22f, 0.04f), new Color(0.35f, 0.22f, 0.12f));
        }

        private static void BuildNature(Transform parent)
        {
            Part(parent, "trunk", PrimitiveType.Cylinder, new Vector3(0, 1.25f, 0), new Vector3(0.18f, 1.25f, 0.18f), new Color(0.28f, 0.20f, 0.14f));
            Part(parent, "crown", PrimitiveType.Capsule, new Vector3(0, 3.0f, 0), new Vector3(1.6f, 1.2f, 1.6f), new Color(0.20f, 0.31f, 0.22f));
        }

        private static void BuildApartment(Transform parent)
        {
            Part(parent, "floor", PrimitiveType.Cube, new Vector3(0, -0.05f, 0), new Vector3(8f, 0.1f, 9f), new Color(0.50f, 0.35f, 0.22f));
            Part(parent, "wall", PrimitiveType.Cube, new Vector3(0, 1.5f, -4.5f), new Vector3(8f, 3f, 0.12f), new Color(0.74f, 0.70f, 0.62f));
        }
    }
}
