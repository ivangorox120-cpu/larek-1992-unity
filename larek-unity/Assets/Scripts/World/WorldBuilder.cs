using System;
using System.Collections.Generic;
using System.Reflection;
using Larek.Interactions;
using UnityEngine;

namespace Larek.World
{
    public enum WorldWeather
    {
        WinterSnow,
        SpringRain,
        AutumnRain,
        Clear
    }

    /// <summary>
    /// Строит мир «Ларька 1992» в рантайме: ларёк, подъезд, квартиру, 8 остановок,
    /// автобус ПАЗ-652, свет, погоду, LOD, зеркало и точки взаимодействия.
    /// </summary>
    public sealed class WorldBuilder : MonoBehaviour
    {
        [Header("Настройки")]
        public bool BuildOnStart = true;
        public bool UseRuntimeModels = true;
        public WorldWeather DefaultWeather = WorldWeather.WinterSnow;

        [Header("Части мира")]
        public GameObject GroundRoot;
        public GameObject KioskRoot;
        public GameObject EntranceRoot;
        public GameObject ApartmentRoot;
        public GameObject StopsRoot;
        public GameObject BusRoot;
        public GameObject WeatherRoot;
        public GameObject LodRoot;

        [Header("Свет")]
        public Light Sun;
        public Light Hemisphere;
        public Light KioskLamp;
        public Light KioskBulb;
        public Light ApartmentLamp;

        [Header("Погода")]
        public ParticleSystem Snow;
        public ParticleSystem Rain;

        [Header("Зеркало")]
        public Camera MirrorCamera;
        public RenderTexture MirrorTexture;
        public GameObject MirrorSurface;

        [Header("Объекты")]
        public Transform KioskHatch;
        public Transform KioskDoorHandle;
        public Transform KioskCounter;
        public Transform EntranceDoorHandle;
        public Transform IntercomPanel;
        public Transform ExitButton;
        public Transform ApartmentDoorHandle;
        public Transform RoofHatch;
        public Transform RoofHatchPivot;
        public Transform BusWindowSeals;
        public WorldInteractions Interactions;
        public WorldAudio Audio;

        /// <summary>Реализация загрузки GLB. По умолчанию UnityGLTF через рефлексию + примитивный fallback.</summary>
        public IModelLoader ModelLoader;

        public EntranceDoor EntranceState { get; private set; }
        public ApartmentDoor ApartmentState { get; private set; }
        public bool Built { get; private set; }
        public bool KioskInFrustum { get; private set; }
        public float CurrentHour { get; private set; } = 9.5f;
        public WorldWeather Weather { get; private set; }
        public readonly Dictionary<string, Vector3> PlacedStops = new Dictionary<string, Vector3>(StringComparer.OrdinalIgnoreCase);
        public readonly List<Transform> LodObjects = new List<Transform>();

        private readonly Dictionary<string, Material> materials = new Dictionary<string, Material>(StringComparer.Ordinal);
        private readonly Dictionary<string, Texture2D> textures = new Dictionary<string, Texture2D>(StringComparer.Ordinal);
        private readonly List<Renderer> mirrorDependentRenderers = new List<Renderer>();
        private readonly HashSet<string> loadedModels = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        private Camera viewerCamera;
        private Font runtimeFont;
        private float hatchTarget;
        private float hatchCurrent;
        private float roofHatchTarget;
        private float roofHatchCurrent;
        private int weatherSeed = 1992;

        private static readonly Color SnowColor = new Color(0.79f, 0.84f, 0.88f);
        private static readonly Color AsphaltColor = new Color(0.19f, 0.21f, 0.23f);
        private static readonly Color ConcreteColor = new Color(0.49f, 0.52f, 0.53f);
        private static readonly Color KioskBlue = new Color(0.09f, 0.26f, 0.45f);
        private static readonly Color DarkRubber = new Color(0.055f, 0.055f, 0.06f);

        private void Awake()
        {
            if (ModelLoader == null) ModelLoader = new GltfModelLoader();
            EntranceState = new EntranceDoor();
            ApartmentState = new ApartmentDoor(false, false);
            Weather = DefaultWeather;
        }

        private void Start()
        {
            if (BuildOnStart) Build();
        }

        public void Build()
        {
            if (Built) return;
            Built = true;

            CreateRoots();
            BuildGroundAndRoads();
            BuildKiosk();
            BuildEntrance();
            BuildApartment();
            BuildStops();
            BuildBus();
            BuildLights();
            BuildLodObjects();
            BuildWeather();
            BuildMirror();
            SetupInteractions();
            SetupAudio();
            EnableFrustumCulling();
            ApplyHour(ReadHourFromSession(9.5f));
            DetectWeatherFromSession();
        }

        // ------------------------------------------------------------------
        //  Каркас_world
        // ------------------------------------------------------------------

        private void CreateRoots()
        {
            GroundRoot = Root("Город / земля и дороги", GroundRoot);
            KioskRoot = Root("Ларёк «Союзпечать»", KioskRoot);
            EntranceRoot = Root("Подъезд № 1 (магнитный замок)", EntranceRoot);
            ApartmentRoot = Root("Квартира № 4 (2-й этаж)", ApartmentRoot);
            StopsRoot = Root("8 остановок", StopsRoot);
            BusRoot = Root("ПАЗ-652 · маршрут № 7", BusRoot);
            WeatherRoot = Root("Погода", WeatherRoot);
            LodRoot = Root("LOD-объекты", LodRoot);
        }

        private static GameObject Root(string name, GameObject existing)
        {
            if (existing != null) return existing;
            GameObject go = new GameObject(name);
            return go;
        }

        private Material Mat(string key, Color color, float smoothness = 0.35f, bool emissive = false)
        {
            Material material;
            if (materials.TryGetValue(key, out material) && material != null) return material;
            Shader shader = Shader.Find("Standard");
            if (shader == null) shader = Shader.Find("Universal Render Pipeline/Lit");
            if (shader == null) shader = Shader.Find("Diffuse");
            material = shader != null ? new Material(shader) : null;
            if (material == null) return null;
            material.color = color;
            if (material.HasProperty("_Smoothness")) material.SetFloat("_Smoothness", smoothness);
            if (emissive && material.HasProperty("_EmissionColor"))
            {
                material.EnableKeyword("_EMISSION");
                material.SetColor("_EmissionColor", color * 0.8f);
            }
            materials[key] = material;
            return material;
        }

        private GameObject Box(Transform parent, string name, Vector3 position, Vector3 scale, Material material, bool collider = false)
        {
            GameObject go = GameObject.CreatePrimitive(PrimitiveType.Cube);
            go.name = name;
            go.transform.SetParent(parent, false);
            go.transform.localPosition = position;
            go.transform.localScale = scale;
            if (material != null) go.GetComponent<Renderer>().sharedMaterial = material;
            if (!collider)
            {
                Collider component = go.GetComponent<Collider>();
                if (component != null) component.enabled = false;
            }
            return go;
        }

        private GameObject Cylinder(Transform parent, string name, Vector3 position, Vector3 scale, Material material, Quaternion rotation = default)
        {
            GameObject go = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            go.name = name;
            go.transform.SetParent(parent, false);
            go.transform.localPosition = position;
            go.transform.localScale = scale;
            go.transform.localRotation = rotation == default ? Quaternion.identity : rotation;
            if (material != null) go.GetComponent<Renderer>().sharedMaterial = material;
            Collider collider = go.GetComponent<Collider>();
            if (collider != null) collider.enabled = false;
            return go;
        }

        private TextMesh Label(Transform parent, string text, Vector3 position, Vector3 euler, float size, Color color)
        {
            GameObject go = new GameObject("Надпись: " + text);
            go.transform.SetParent(parent, false);
            go.transform.localPosition = position;
            go.transform.localEulerAngles = euler;
            TextMesh label = go.AddComponent<TextMesh>();
            label.text = text;
            label.font = CachedFont();
            label.fontSize = 64;
            label.characterSize = size;
            label.anchor = TextAnchor.MiddleCenter;
            label.alignment = TextAlignment.Center;
            label.color = color;
            return label;
        }

        private Font CachedFont()
        {
            if (runtimeFont != null) return runtimeFont;
            try
            {
                runtimeFont = Font.CreateDynamicFontFromOSFont(new[] { "Arial", "Noto Sans", "Roboto", "DejaVu Sans" }, 32);
            }
            catch { runtimeFont = null; }
            if (runtimeFont == null)
            {
                try { runtimeFont = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf"); }
                catch { runtimeFont = null; }
            }
            return runtimeFont;
        }

        /// <summary>Текстура вывески с мип-картами: M10 (надписи не мерцают вдалеке).</summary>
        private Texture2D SignTexture(string key, Color background, Color accent)
        {
            Texture2D texture;
            if (textures.TryGetValue(key, out texture) && texture != null) return texture;
            const int width = 512;
            const int height = 128;
            texture = new Texture2D(width, height, TextureFormat.RGBA32, true);
            texture.name = "sign_mip_" + key;
            texture.wrapMode = TextureWrapMode.Clamp;
            texture.filterMode = FilterMode.Trilinear;
            texture.anisotropy = 4;
            Color[] pixels = new Color[width * height];
            for (int y = 0; y < height; y++)
            {
                for (int x = 0; x < width; x++)
                {
                    bool border = x < 7 || y < 7 || x >= width - 7 || y >= height - 7;
                    bool stripe = (x / 32) % 2 == 0 && y > 30 && y < height - 30;
                    pixels[y * width + x] = border ? accent : stripe ? Color.Lerp(background, accent, 0.14f) : background;
                }
            }
            texture.SetPixels(pixels);
            texture.Apply(true, false);
            textures[key] = texture;
            return texture;
        }

        private Material SignMaterial(string key, Color background, Color accent)
        {
            string materialKey = "sign_mat_" + key;
            Material material;
            if (materials.TryGetValue(materialKey, out material) && material != null) return material;
            material = Mat(materialKey + "_base", background, 0.4f);
            if (material != null)
            {
                material.mainTexture = SignTexture(key, background, accent);
                if (material.HasProperty("_EmissionColor")) material.SetColor("_EmissionColor", background * 0.6f);
            }
            return material;
        }

        private static void ForceMipmaps(GameObject root)
        {
            if (root == null) return;
            foreach (Renderer renderer in root.GetComponentsInChildren<Renderer>(true))
            {
                foreach (Material material in renderer.sharedMaterials)
                {
                    Texture texture = material != null ? material.mainTexture : null;
                    Texture2D texture2D = texture as Texture2D;
                    if (texture2D == null) continue;
                    texture2D.filterMode = FilterMode.Trilinear;
                    texture2D.anisotropy = 4;
                    try { if (texture2D.isReadable) texture2D.Apply(true, false); }
                    catch { /* уже загруженная GLB-текстура может быть недоступна для чтения */ }
                }
            }
        }

        private GameObject PlaceModel(string fileName, Transform parent, Vector3 localPosition, Quaternion localRotation, float scale = 1f)
        {
            if (ModelLoader == null || !UseRuntimeModels || string.IsNullOrEmpty(fileName)) return null;
            if (!loadedModels.Add(fileName)) return null;
            GameObject go = ModelLoader.Load(fileName);
            if (go == null) return null;
            go.transform.SetParent(parent, false);
            go.transform.localPosition = localPosition;
            go.transform.localRotation = localRotation;
            go.transform.localScale = Vector3.one * scale;
            ForceMipmaps(go);
            foreach (Renderer renderer in go.GetComponentsInChildren<Renderer>(true)) renderer.frustumCulled = true;
            return go;
        }

        // ------------------------------------------------------------------
        //  Земля, дороги, тротуары
        // ------------------------------------------------------------------

        private void BuildGroundAndRoads()
        {
            Material snow = Mat("ground_snow", SnowColor, 0.95f);
            Material road = Mat("road_asphalt", AsphaltColor, 0.85f);
            Material sidewalk = Mat("sidewalk", ConcreteColor, 0.9f);

            Box(GroundRoot.transform, "Снежная равнина", new Vector3(-70f, -0.18f, 45f), new Vector3(960f, 0.3f, 680f), snow);
            // Улица Советская (z ≈ 8.4), улица Ленина (z ≈ 61.6/89.5) и дорога к заводу.
            Box(GroundRoot.transform, "Ул. Советская", new Vector3(-50f, 0.005f, 8.4f), new Vector3(640f, 0.03f, 11f), road);
            Box(GroundRoot.transform, "Ул. Ленина", new Vector3(30f, 0.005f, 89.5f), new Vector3(340f, 0.03f, 11f), road);
            Box(GroundRoot.transform, "Центральная (к заводу)", new Vector3(90f, 0.005f, 61.6f), new Vector3(520f, 0.03f, 10f), road);
            Box(GroundRoot.transform, "Тротуар у ларька", new Vector3(0f, 0.02f, 3.4f), new Vector3(220f, 0.04f, 3.6f), sidewalk);
            Box(GroundRoot.transform, "Тротуар у дома № 14", new Vector3(42f, 0.02f, 66.2f), new Vector3(120f, 0.04f, 3.4f), sidewalk);

            // Дом № 14: фасад и крыша с люком (координаты из world.js).
            Material brick = Mat("house14_panel", new Color(0.49f, 0.51f, 0.52f), 0.85f);
            Material roof = Mat("house14_roof", new Color(0.27f, 0.28f, 0.30f), 0.9f);
            Box(GroundRoot.transform, "Дом № 14 · левое крыло", new Vector3(30.9f, 6.25f, 75.6f), new Vector3(7.8f, 12.5f, 16.8f), brick);
            Box(GroundRoot.transform, "Дом № 14 · правое крыло", new Vector3(53.3f, 6.25f, 75.6f), new Vector3(7.4f, 12.5f, 16.8f), brick);
            Box(GroundRoot.transform, "Дом № 14 · центральный корпус", new Vector3(45.4f, 6.25f, 78.9f), new Vector3(8.4f, 12.5f, 9.6f), brick);
            Box(GroundRoot.transform, "Дом № 14 · крыша", new Vector3(42f, 12.82f, 79f), new Vector3(13f, 0.14f, 10f), roof);
            Box(GroundRoot.transform, "Дом № 14 · снег на крыше", new Vector3(42f, 12.92f, 79f), new Vector3(13.1f, 0.06f, 10.1f), snow);
        }

        // ------------------------------------------------------------------
        //  Ларёк «Союзпечать»
        // ------------------------------------------------------------------

        private void BuildKiosk()
        {
            const float kw = 1.5f, kd = 1.2f, kh = 2.5f;
            Transform root = KioskRoot.transform;
            root.position = WorldAnchors.Kiosk;

            Material outer = Mat("kiosk_soyuz", KioskBlue, 0.45f);
            Material inner = Mat("kiosk_inner", new Color(0.72f, 0.68f, 0.58f), 0.9f);
            Material floor = Mat("kiosk_floor", new Color(0.40f, 0.31f, 0.21f), 0.8f);
            Material metal = Mat("kiosk_metal", new Color(0.53f, 0.55f, 0.56f), 0.35f);

            Box(root, "Ларёк · пол", new Vector3(0, 0.02f, 0), new Vector3(kw * 2f, 0.04f, kd * 2f), floor);
            Box(root, "Ларёк · задняя стена", new Vector3(-0.55f, kh / 2f, -kd), new Vector3(1.9f, kh, 0.06f), outer);
            Box(root, "Ларёк · задняя стена (дверь)", new Vector3(1.35f, kh / 2f, -kd), new Vector3(0.3f, kh, 0.06f), outer);
            Box(root, "Ларёк · левая стена", new Vector3(-kw, kh / 2f, 0), new Vector3(0.06f, kh, kd * 2f), outer);
            Box(root, "Ларёк · правая стена", new Vector3(kw, kh / 2f, 0), new Vector3(0.06f, kh, kd * 2f), outer);
            Box(root, "Ларёк · витрина (низ)", new Vector3(0, 0.5f, kd), new Vector3(kw * 2f, 1f, 0.06f), inner);
            Box(root, "Ларёк · витрина (верх)", new Vector3(0, kh - 0.18f, kd), new Vector3(kw * 2f, 0.36f, 0.06f), outer);
            Box(root, "Ларёк · крыша", new Vector3(0, kh + 0.05f, 0.08f), new Vector3(kw * 2f + 0.42f, 0.1f, kd * 2f + 0.45f), metal);
            Box(root, "Ларёк · снег на крыше", new Vector3(0, kh + 0.13f, 0.08f), new Vector3(kw * 2f + 0.44f, 0.06f, kd * 2f + 0.46f), Mat("snow_roof", SnowColor, 0.95f));

            // Полосатый «Союзпечать» фасад (чередующиеся синие/белые панели с мип-картами).
            Material stripeLight = SignMaterial("soyuz_light", new Color(0.94f, 0.93f, 0.88f), new Color(0.55f, 0.62f, 0.68f));
            for (int i = 0; i < 8; i++)
            {
                float x = -1.36f + i * 0.39f;
                Box(root, "Союзпечать · панель " + i, new Vector3(x, 1.58f, -kd - 0.035f), new Vector3(0.31f, 1.75f, 0.015f), i % 2 == 0 ? outer : stripeLight);
            }

            // Прилавок и окошко выдачи.
            Material wood = Mat("counter_wood", new Color(0.44f, 0.29f, 0.16f), 0.45f);
            KioskCounter = Box(root, "Прилавок", new Vector3(0, 1.0f, kd - 0.14f), new Vector3(2.9f, 0.10f, 0.52f), wood, true).transform;
            Material glass = Mat("hatch_glass", new Color(0.60f, 0.74f, 0.80f), 0.12f);
            GameObject hatchPivot = new GameObject("Окошко выдачи");
            hatchPivot.transform.SetParent(root, false);
            hatchPivot.transform.localPosition = new Vector3(0, 1.19f, kd + 0.02f);
            KioskHatch = hatchPivot.transform;
            Box(hatchPivot.transform, "Стекло окошка", new Vector3(0, 0, 0), new Vector3(0.92f, 0.33f, 0.012f), glass);
            Box(hatchPivot.transform, "Рамка верх", new Vector3(0, 0.17f, 0), new Vector3(0.95f, 0.022f, 0.03f), metal);
            Box(hatchPivot.transform, "Рамка низ", new Vector3(0, -0.17f, 0), new Vector3(0.95f, 0.022f, 0.03f), metal);
            Box(hatchPivot.transform, "Ручка окошка", new Vector3(0, -0.145f, 0.03f), new Vector3(0.18f, 0.02f, 0.03f), metal);
            SetKioskHatch(0f);

            // Дверь с ручкой (M06/M32 — до ручки не дальше 1 м).
            Material doorMat = Mat("kiosk_door", new Color(0.35f, 0.29f, 0.20f), 0.5f);
            Box(root, "Дверь ларька", new Vector3(0.8f, 1.02f, -kd - 0.01f), new Vector3(0.8f, 2.04f, 0.05f), doorMat);
            GameObject handle = Box(root, "Ручка двери ларька", WorldAnchors.KioskDoorHandle, new Vector3(0.04f, 0.16f, 0.04f), Mat("handle_dark", new Color(0.10f, 0.10f, 0.11f), 0.3f), true);
            KioskDoorHandle = handle.transform;

            // Вывеска «Союзпечать» и неоновый короб «ЛАРЁК» (только на титульном экране).
            Material signMat = SignMaterial("soyuz_sign", new Color(0.08f, 0.26f, 0.46f), new Color(0.96f, 0.94f, 0.88f));
            Box(root, "Вывеска Союзпечать", WorldAnchors.KioskSign, new Vector3(1.78f, 0.30f, 0.08f), signMat);
            Label(root, "Союзпечать", WorldAnchors.KioskSign + new Vector3(0, 0, 0.06f), Vector3.zero, 0.075f, new Color(0.98f, 0.97f, 0.93f));
            GameObject neon = new GameObject("Неон ЛАРЁК (титул)");
            neon.transform.SetParent(root, false);
            neon.transform.localPosition = new Vector3(0, kh + 0.55f, kd - 0.05f);
            Box(neon.transform, "Короб", Vector3.zero, new Vector3(2.1f, 0.44f, 0.06f), Mat("neon_box", new Color(0.05f, 0.07f, 0.10f), 0.4f, true));
            Label(neon.transform, "ЛАРЁК · 24 ЧАСА", new Vector3(0, 0, 0.05f), Vector3.zero, 0.075f, new Color(1f, 0.22f, 0.60f));
            neon.SetActive(false);

            // ЗИЛ-Москва КХ-240 в ларьке. Отдельного GLB нет — строим структуру.
            GameObject fridge = PlaceModel("fridge.glb", root, WorldAnchors.KioskFridge, Quaternion.identity, 1f);
            if (fridge == null)
            {
                fridge = new GameObject("Холодильник ЗИЛ-Москва КХ-240 (ларьёк)");
                fridge.transform.SetParent(root, false);
                fridge.transform.localPosition = WorldAnchors.KioskFridge;
                FallbackModelLoader loader = new FallbackModelLoader();
                GameObject shape = loader.Create("fridge.glb");
                if (shape != null) shape.transform.SetParent(fridge.transform, false);
            }
            fridge.transform.localScale = Vector3.one * 0.72f;
            PlaceModel("radio.glb", root, WorldAnchors.KioskRadio, Quaternion.Euler(0, 90, 0));
        }

        public void SetKioskHatch(float normalized)
        {
            hatchTarget = Mathf.Clamp01(normalized);
            if (KioskHatch == null) return;
            KioskHatch.transform.localRotation = Quaternion.Euler(-100f * hatchCurrent, 0, 0);
        }

        // ------------------------------------------------------------------
        //  Подъезд: магнитный замок, домофон, кнопка «ВЫХОД»
        // ------------------------------------------------------------------

        private void BuildEntrance()
        {
            Transform root = EntranceRoot.transform;
            Material panel = Mat("podezd_panel", new Color(0.49f, 0.51f, 0.52f), 0.85f);
            Material steel = Mat("podezd_steel", new Color(0.55f, 0.58f, 0.59f), 0.35f);
            Material dark = Mat("podezd_dark", new Color(0.12f, 0.13f, 0.15f), 0.4f);

            Box(root, "Дом № 14 · фасад слева", new Vector3(35.5f, 2.82f, 74.1f), new Vector3(1.4f, 5.65f, 0.28f), panel);
            Box(root, "Дом № 14 · фасад справа", new Vector3(39.33f, 2.82f, 74.1f), new Vector3(3.75f, 5.65f, 0.28f), panel);
            Box(root, "Козырёк подъезда", new Vector3(36.825f, 2.96f, 73.18f), new Vector3(3.55f, 0.22f, 1.85f), panel);
            Box(root, "Дверь подъезда · глухая створка", new Vector3(36.37f, 1.08f, 74.10f), new Vector3(0.34f, 2.16f, 0.06f), steel);
            Box(root, "Дверь подъезда · основной полотно", new Vector3(36.995f, 1.08f, 74.10f), new Vector3(0.91f, 2.16f, 0.06f), steel);
            Box(root, "Фрамуга", new Vector3(36.825f, 2.46f, 74.10f), new Vector3(1.25f, 0.56f, 0.08f), dark);

            GameObject handle = Box(root, "Ручка двери подъезда", WorldAnchors.EntranceDoorHandle, new Vector3(0.04f, 0.18f, 0.03f), Mat("handle_metal", new Color(0.16f, 0.17f, 0.19f), 0.3f), true);
            EntranceDoorHandle = handle.transform;

            GameObject intercom = Box(root, "Домофон «ВИЗИТ»", WorldAnchors.Intercom, new Vector3(0.16f, 0.24f, 0.05f), Mat("intercom", new Color(0.24f, 0.26f, 0.28f), 0.35f, true), true);
            IntercomPanel = intercom.transform;
            Label(root, "ВИЗИТ · 1992", WorldAnchors.Intercom + new Vector3(0, 0.10f, 0.04f), Vector3.zero, 0.018f, new Color(0.94f, 0.90f, 0.78f));

            GameObject exitButton = Box(root, "Кнопка ВЫХОД (изнутри)", WorldAnchors.ExitButton, new Vector3(0.12f, 0.14f, 0.03f), Mat("exit_button", new Color(0.72f, 0.14f, 0.11f), 0.3f), true);
            ExitButton = exitButton.transform;
            Label(root, "ВЫХОД", WorldAnchors.ExitButton + new Vector3(0, 0.10f, 0.03f), Vector3.zero, 0.016f, new Color(0.95f, 0.94f, 0.90f));
        }

        // ------------------------------------------------------------------
        //  Квартира № 4, лестница и лестница к чердачному люку
        // ------------------------------------------------------------------

        private void BuildApartment()
        {
            const float ay = WorldAnchors.ApartmentFloorY;
            Transform root = ApartmentRoot.transform;
            Material floor = Mat("apt_floor", new Color(0.46f, 0.32f, 0.20f), 0.6f);
            Material wall = Mat("apt_wall", new Color(0.74f, 0.69f, 0.59f), 0.9f);
            Material tile = Mat("apt_tile", new Color(0.55f, 0.72f, 0.79f), 0.5f);
            Material paint = Mat("apt_paint", new Color(0.62f, 0.66f, 0.63f), 0.85f);

            // Пол 2-го этажа и перегородки комнат (высота пола 2.60 м).
            Box(root, "Квартира · пол", new Vector3(45.4f, ay - 0.05f, 78.9f), new Vector3(8.4f, 0.1f, 9.6f), floor);
            Box(root, "Квартира · потолок", new Vector3(45.4f, ay + 3.0f, 78.9f), new Vector3(8.4f, 0.1f, 9.6f), paint);
            Box(root, "Стена прихожей", new Vector3(44.1f, ay + 1.5f, 78.9f), new Vector3(0.14f, 3.0f, 9.4f), wall);
            Box(root, "Стена жилой комнаты", new Vector3(49.6f, ay + 1.5f, 78.9f), new Vector3(0.14f, 3.0f, 9.4f), wall);
            Box(root, "Стена ванной", new Vector3(42.9f, ay + 1.5f, 75.9f), new Vector3(0.14f, 3.0f, 3.8f), tile);
            Box(root, "Северная стена квартиры", new Vector3(45.4f, ay + 1.5f, 83.75f), new Vector3(8.4f, 3.0f, 0.14f), wall);
            Box(root, "Южная стена квартиры", new Vector3(45.4f, ay + 1.5f, 74.15f), new Vector3(8.4f, 3.0f, 0.14f), wall);

            // Входная дверь квартиры № 4 и ручка (английский замок — M12/M30/M31).
            Box(root, "Дверь КВ. 4", new Vector3(41.22f, ay + 1.075f, 81.92f), new Vector3(0.08f, 2.15f, 1.15f), Mat("apt_door", new Color(0.32f, 0.18f, 0.11f), 0.6f));
            GameObject apartmentHandle = Box(root, "Ручка двери КВ. 4", WorldAnchors.ApartmentDoorHandle, new Vector3(0.05f, 0.16f, 0.04f), Mat("handle_brass", new Color(0.64f, 0.52f, 0.27f), 0.35f), true);
            ApartmentDoorHandle = apartmentHandle.transform;
            Label(root, "КВ. 4", new Vector3(41.18f, ay + 1.55f, 81.92f), new Vector3(0, 90, 0), 0.06f, new Color(0.92f, 0.88f, 0.74f));

            // Мебель и электричество.
            GameObject fridge = PlaceModel("fridge.glb", root, WorldAnchors.ApartmentFridge, Quaternion.identity);
            if (fridge == null)
            {
                fridge = new GameObject("Холодильник ЗИЛ-Москва КХ-240");
                fridge.transform.SetParent(root, false);
                fridge.transform.localPosition = WorldAnchors.ApartmentFridge;
                GameObject shape = new FallbackModelLoader().Create("fridge.glb");
                if (shape != null) shape.transform.SetParent(fridge.transform, false);
            }
            PlaceModel("phone.glb", root, WorldAnchors.ApartmentPhone, Quaternion.identity);
            Box(root, "Газовая плита «Брест»", new Vector3(41.62f, ay + 0.45f, 77.1f), new Vector3(0.58f, 0.9f, 0.58f), Mat("stove", new Color(0.82f, 0.82f, 0.78f), 0.5f));
            Box(root, "Кухонный стол", new Vector3(43.2f, ay + 0.40f, 76.5f), new Vector3(1.3f, 0.8f, 0.8f), Mat("kitchen_table", new Color(0.52f, 0.34f, 0.18f), 0.5f));
            Box(root, "Кровать", new Vector3(47.9f, ay + 0.25f, 81.6f), new Vector3(1.3f, 0.5f, 2.0f), Mat("bed", new Color(0.52f, 0.46f, 0.40f), 0.9f));
            Box(root, "Письменный стол", new Vector3(48.4f, ay + 0.38f, 74.9f), new Vector3(1.2f, 0.76f, 0.62f), Mat("desk", new Color(0.44f, 0.26f, 0.14f), 0.45f));
            Box(root, "Ковёр", new Vector3(46.9f, ay + 0.012f, 78.4f), new Vector3(3.2f, 0.02f, 2.4f), Mat("carpet", new Color(0.52f, 0.20f, 0.18f), 0.95f));

            BuildStaircase(root);
            BuildAtticLadder(root);
        }

        private void BuildStaircase(Transform parent)
        {
            Material step = Mat("stair_step", ConcreteColor, 0.9f);
            Material rail = Mat("stair_rail", new Color(0.20f, 0.22f, 0.24f), 0.35f);
            for (int i = 0; i < 13; i++)
            {
                float y = 0.20f + i * 0.20f;
                float z = 75.0f + i * 0.62f;
                Box(parent, "Ступень " + i, new Vector3(38.1f, y, z), new Vector3(2.2f, 0.08f, 0.62f), step);
            }
            Box(parent, "Площадка 2-го этажа", new Vector3(38.1f, WorldAnchors.ApartmentFloorY - 0.05f, 82.1f), new Vector3(2.4f, 0.1f, 1.8f), step);
            Box(parent, "Перила лестницы", new Vector3(39.2f, 2.0f, 79.0f), new Vector3(0.06f, 0.06f, 8f), rail);
        }

        private void BuildAtticLadder(Transform parent)
        {
            Material metal = Mat("ladder_metal", new Color(0.42f, 0.45f, 0.47f), 0.3f);
            GameObject ladder = new GameObject("Лестница к чердачному люку (M33)");
            ladder.transform.SetParent(parent, false);
            ladder.transform.position = WorldAnchors.LadderBase;
            const float bottom = 10.4f, top = 13.6f;
            for (int side = -1; side <= 1; side += 2)
                Cylinder(ladder.transform, "Стойка лестницы", new Vector3(side * 0.28f, (bottom + top) / 2f, 0), new Vector3(0.035f, (top - bottom) / 2f, 0.035f), metal);
            for (float y = bottom + 0.2f; y < top; y += 0.28f)
                Box(ladder.transform, "Ступенька", new Vector3(0, y, 0), new Vector3(0.56f, 0.03f, 0.05f), metal);

            GameObject hatchPivot = new GameObject("Крышка чердачного люка");
            hatchPivot.transform.SetParent(parent, false);
            hatchPivot.transform.position = WorldAnchors.RoofHatch + new Vector3(0, 0, -0.35f);
            RoofHatchPivot = hatchPivot.transform;
            GameObject hatch = Box(hatchPivot.transform, "Люк", new Vector3(0, 0, 0.35f), new Vector3(0.7f, 0.08f, 0.7f), metal, true);
            RoofHatch = hatch.transform;
            SetRoofHatch(0f);
        }

        public void SetRoofHatch(float normalized)
        {
            roofHatchTarget = Mathf.Clamp01(normalized);
            ApplyHatchRotation();
        }

        private void ApplyHatchRotation()
        {
            if (RoofHatchPivot != null) RoofHatchPivot.localRotation = Quaternion.Euler(-102f * roofHatchCurrent, 0, 0);
            if (KioskHatch != null) KioskHatch.localRotation = Quaternion.Euler(-100f * hatchCurrent, 0, 0);
        }

        private void StepHatches(float dt)
        {
            if (Mathf.Abs(hatchCurrent - hatchTarget) < 0.001f && Mathf.Abs(roofHatchCurrent - roofHatchTarget) < 0.001f) return;
            float k = Mathf.Min(1f, dt * 3.2f);
            hatchCurrent += (hatchTarget - hatchCurrent) * k;
            roofHatchCurrent += (roofHatchTarget - roofHatchCurrent) * k;
            ApplyHatchRotation();
        }

        // ------------------------------------------------------------------
        //  Остановки (M09/M41) и автобус (M43)
        // ------------------------------------------------------------------

        private void BuildStops()
        {
            PlacedStops.Clear();
            foreach (BusStopAnchor stop in WorldCatalogue.Stops)
            {
                GameObject group = new GameObject("Остановка: " + stop.NameRu);
                group.transform.SetParent(StopsRoot.transform, false);

                // Павильон смещается от полосы движения в заездной карман (Ни один не стоит на дороге).
                Vector3 position = stop.Shelter;
                float gap = Mathf.Abs(position.z - stop.Lane.z);
                if (gap < 2.4f)
                {
                    float sign = position.z > stop.Lane.z ? 1f : -1f;
                    position.z = stop.Lane.z + sign * 2.4f;
                }
                group.transform.position = position;
                group.transform.rotation = Quaternion.Euler(0, stop.ShelterRotationY * Mathf.Rad2Deg, 0);
                PlacedStops[stop.Key] = position;

                GameObject model = PlaceModel("busstop.glb", group.transform, Vector3.zero, Quaternion.identity);
                if (model != null)
                {
                    ForceMipmaps(model);
                    continue;
                }
                GameObject shape = new FallbackModelLoader().Create("busstop.glb");
                if (shape != null) shape.transform.SetParent(group.transform, false);
                Material signMat = SignMaterial("stop_" + stop.Key, new Color(0.13f, 0.33f, 0.55f), new Color(0.95f, 0.95f, 0.90f));
                Box(group.transform, "Табличка остановки", new Vector3(0, 2.05f, 0.98f), new Vector3(2.4f, 0.30f, 0.04f), signMat);
                Label(group.transform, stop.NameRu, new Vector3(0, 2.05f, 1.02f), Vector3.zero, 0.035f, Color.white);
            }
        }

        public bool ValidateStopPlacement()
        {
            foreach (BusStopAnchor stop in WorldCatalogue.Stops)
            {
                Vector3 placed;
                if (!PlacedStops.TryGetValue(stop.Key, out placed)) return false;
                if (Mathf.Abs(placed.z - stop.Lane.z) < 2.0f) return false;
            }
            return true;
        }

        private void BuildBus()
        {
            BusRoot.transform.position = WorldAnchors.BusStart;
            BusRoot.transform.rotation = Quaternion.Euler(0, 90, 0);
            GameObject model = PlaceModel("paz652.glb", BusRoot.transform, Vector3.zero, Quaternion.identity);
            if (model == null)
            {
                GameObject shape = new FallbackModelLoader().Create("paz652.glb");
                if (shape != null) shape.transform.SetParent(BusRoot.transform, false);
            }

            // M43: ровные резиновые уплотнители на всех плоских окнах вместо «рваных» из GLB.
            BusWindowSeals = new GameObject("Ровные резиновые уплотнители окон (M43)").transform;
            BusWindowSeals.SetParent(BusRoot.transform, false);
            Material rubber = Mat("bus_seal_rubber", DarkRubber, 0.85f);
            for (int side = -1; side <= 1; side += 2)
            {
                for (int i = 0; i < 5; i++)
                {
                    float x = -2.6f + i * 1.3f;
                    float z = side * 1.155f;
                    float width = 1.05f, height = 0.65f, centerY = 1.85f;
                    RectSeal(BusWindowSeals, "Уплотнитель " + side + "/" + i, new Vector3(x, centerY, z), width, height, rubber);
                }
            }
            // Лобовое и заднее стекло.
            RectSeal(BusWindowSeals, "Лобовое стекло", new Vector3(3.62f, 1.85f, 0), 1.85f, 0.75f, rubber, true);
            RectSeal(BusWindowSeals, "Заднее стекло", new Vector3(-3.62f, 1.85f, 0), 1.85f, 0.75f, rubber, true);
        }

        private void RectSeal(Transform parent, string name, Vector3 center, float width, float height, Material rubber, bool frontBack = false)
        {
            GameObject frame = new GameObject(name);
            frame.transform.SetParent(parent, false);
            frame.transform.localPosition = center;
            if (frontBack) frame.transform.localRotation = Quaternion.Euler(0, 90, 0);
            float thickness = 0.028f;
            Box(frame.transform, "низ", new Vector3(0, -height / 2f, 0), new Vector3(width + 0.04f, thickness, 0.022f), rubber);
            Box(frame.transform, "верх", new Vector3(0, height / 2f, 0), new Vector3(width + 0.04f, thickness, 0.022f), rubber);
            Box(frame.transform, "лево", new Vector3(-width / 2f, 0, 0), new Vector3(thickness, height, 0.022f), rubber);
            Box(frame.transform, "право", new Vector3(width / 2f, 0, 0), new Vector3(thickness, height, 0.022f), rubber);
        }

        // ------------------------------------------------------------------
        //  Свет, время суток (M40), погода
        // ------------------------------------------------------------------

        private void BuildLights()
        {
            GameObject sunObject = new GameObject("Солнце (динамическое)");
            Sun = sunObject.AddComponent<Light>();
            Sun.type = LightType.Directional;
            Sun.color = new Color(0.91f, 0.85f, 0.76f);
            Sun.intensity = 1.6f;
            Sun.shadows = LightShadows.Soft;
            Sun.shadowStrength = 0.78f;
            GameObject sunTarget = new GameObject("Солнце · цель");
            sunTarget.transform.position = WorldAnchors.Kiosk;
            Sun.transform.SetParent(transform, false);

            GameObject hemiObject = new GameObject("Небесный свет");
            Hemisphere = hemiObject.AddComponent<Light>();
            Hemisphere.type = LightType.Directional;
            Hemisphere.intensity = 0.45f;
            Hemisphere.color = new Color(0.55f, 0.63f, 0.72f);
            Hemisphere.shadows = LightShadows.None;

            GameObject kioskLampObject = new GameObject("Лампа ларька (M40 — только в кадре)");
            kioskLampObject.transform.SetParent(KioskRoot.transform, false);
            kioskLampObject.transform.localPosition = WorldAnchors.KioskLamp;
            KioskLamp = kioskLampObject.AddComponent<Light>();
            KioskLamp.type = LightType.Spot;
            KioskLamp.color = new Color(1f, 0.72f, 0.44f);
            KioskLamp.intensity = 0f;
            KioskLamp.range = 5f;
            KioskLamp.spotAngle = 84f;
            KioskLamp.innerSpotAngle = 50f;
            KioskLamp.shadows = LightShadows.Soft;
            kioskLampObject.transform.localRotation = Quaternion.Euler(180, 0, 0);

            GameObject bulbObject = new GameObject("Лампочка ларька");
            bulbObject.transform.SetParent(KioskRoot.transform, false);
            bulbObject.transform.localPosition = new Vector3(0, 2.12f, -0.1f);
            KioskBulb = bulbObject.AddComponent<Light>();
            KioskBulb.type = LightType.Point;
            KioskBulb.color = new Color(1f, 0.73f, 0.46f);
            KioskBulb.range = 5.5f;
            KioskBulb.intensity = 0f;
            KioskBulb.shadows = LightShadows.None;

            GameObject apartmentLampObject = new GameObject("Лампа квартиры");
            apartmentLampObject.transform.SetParent(ApartmentRoot.transform, false);
            apartmentLampObject.transform.position = new Vector3(46.5f, WorldAnchors.ApartmentFloorY + 2.5f, 78.5f);
            ApartmentLamp = apartmentLampObject.AddComponent<Light>();
            ApartmentLamp.type = LightType.Point;
            ApartmentLamp.color = new Color(1f, 0.88f, 0.70f);
            ApartmentLamp.range = 10f;
            ApartmentLamp.intensity = 1.2f;
            ApartmentLamp.shadows = LightShadows.None;

            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.Linear;
            RenderSettings.fogStartDistance = 20f;
            RenderSettings.fogEndDistance = 160f;
            RenderSettings.fogColor = new Color(0.60f, 0.63f, 0.62f);
            RenderSettings.ambientLight = new Color(0.52f, 0.55f, 0.58f);
        }

        public void ApplyHour(float hour)
        {
            CurrentHour = ((hour % 24f) + 24f) % 24f;
            if (Sun == null) return;
            float dayProgress = Mathf.Clamp01((CurrentHour - 6.8f) / (20.2f - 6.8f));
            float elevation = CurrentHour > 6.8f && CurrentHour < 20.2f
                ? Mathf.Sin(dayProgress * Mathf.PI) * 44f
                : -6f;
            float azimuth = Mathf.Lerp(-90f, 90f, dayProgress);
            Vector3 target = new Vector3(48f, 0f, 82f);
            Vector3 sunPosition = target + new Vector3(
                Mathf.Sin(azimuth * Mathf.Deg2Rad) * 68f,
                Mathf.Max(8f, elevation),
                Mathf.Cos(azimuth * Mathf.Deg2Rad) * 44f);
            Sun.transform.position = sunPosition;
            Sun.transform.rotation = Quaternion.LookRotation(target - sunPosition, Vector3.up);
            float daylight = Mathf.Clamp01((elevation + 4f) / 18f);
            bool dawn = CurrentHour < 9f && CurrentHour > 6f;
            bool dusk = CurrentHour < 21f && CurrentHour > 18f;
            Sun.color = dawn || dusk ? new Color(0.95f, 0.53f, 0.28f) : new Color(0.91f, 0.85f, 0.76f);
            Sun.intensity = 2.4f * daylight;
            Hemisphere.intensity = 0.30f + daylight * 0.45f;
            RenderSettings.ambientLight = Color.Lerp(new Color(0.16f, 0.20f, 0.28f), new Color(0.55f, 0.58f, 0.60f), daylight);
            Color fogDay = Weather == WorldWeather.WinterSnow
                ? new Color(0.60f, 0.63f, 0.65f)
                : new Color(0.56f, 0.61f, 0.65f);
            RenderSettings.fogColor = Color.Lerp(new Color(0.08f, 0.12f, 0.20f), fogDay, daylight);
            RenderSettings.fogEndDistance = Mathf.Lerp(38f, 160f, daylight);
            if (KioskBulb != null) KioskBulb.intensity = 1.15f + (1f - daylight) * 0.35f;
        }

        /// <summary>M40: лампа горит, когда ларёк реально попадает в пирамиду зрения камеры.</summary>
        public void UpdateKioskLampFrustum(Camera camera)
        {
            if (KioskLamp == null || camera == null) return;
            Bounds bounds = KioskRoot != null ? CollectBounds(KioskRoot) : new Bounds(WorldAnchors.Kiosk + Vector3.up * 1.25f, new Vector3(3.2f, 2.8f, 2.8f));
            Plane[] planes = GeometryUtility.CalculateFrustumPlanes(camera);
            KioskInFrustum = GeometryUtility.TestPlanesAABB(planes, bounds);
            KioskLamp.enabled = KioskInFrustum;
            KioskLamp.intensity = KioskInFrustum ? 1.2f + (1f - Mathf.Clamp01(CurrentHour / 24f)) * 0.45f : 0f;
            if (KioskBulb != null) KioskBulb.enabled = KioskInFrustum;
        }

        private static Bounds CollectBounds(GameObject root)
        {
            Renderer[] renderers = root.GetComponentsInChildren<Renderer>(true);
            Bounds bounds = new Bounds(root.transform.position, Vector3.zero);
            bool first = true;
            foreach (Renderer renderer in renderers)
            {
                if (renderer is ParticleSystemRenderer) continue;
                if (first) { bounds = renderer.bounds; first = false; }
                else bounds.Encapsulate(renderer.bounds);
            }
            if (first) bounds = new Bounds(root.transform.position + Vector3.up, new Vector3(3f, 3f, 3f));
            return bounds;
        }

        private void BuildWeather()
        {
            Snow = CreatePrecipitation("Снег", WeatherRoot.transform, new Color(0.93f, 0.96f, 1f), 0.065f, 0.75f, 850f, new Vector3(44f, 16f, 44f));
            Rain = CreatePrecipitation("Дождь", WeatherRoot.transform, new Color(0.70f, 0.78f, 0.86f), 0.025f, 12f, 900f, new Vector3(36f, 14f, 36f));
            SetWeather(Weather);
        }

        private ParticleSystem CreatePrecipitation(string name, Transform parent, Color color, float size, float speed, float rate, Vector3 box)
        {
            GameObject go = new GameObject(name);
            go.transform.SetParent(parent, false);
            ParticleSystem system = go.AddComponent<ParticleSystem>();
            ParticleSystem.MainModule main = system.main;
            main.loop = true;
            main.playOnAwake = true;
            main.simulationSpace = ParticleSystemSimulationSpace.World;
            main.startLifetime = name == "Снег" ? 16f : 2.2f;
            main.startSpeed = speed;
            main.startSize = size;
            main.startColor = new ParticleSystem.MinMaxGradient(color);
            main.maxParticles = Mathf.RoundToInt(rate * (name == "Снег" ? 1.2f : 0.4f));
            ParticleSystem.EmissionModule emission = system.emission;
            emission.rateOverTime = rate;
            ParticleSystem.ShapeModule shape = system.shape;
            shape.shapeType = ParticleSystemShapeType.Box;
            shape.scale = box;
            ParticleSystemRenderer renderer = system.GetComponent<ParticleSystemRenderer>();
            renderer.renderMode = ParticleSystemRenderMode.Billboard;
            renderer.material = Mat("particles_" + name, color, 0.1f);
            // Погода всегда рисуется вокруг камеры — отсечение здесь неуместно.
            renderer.frustumCulled = false;
            return system;
        }

        public void SetWeather(WorldWeather weather)
        {
            Weather = weather;
            if (Audio != null) Audio.SetWeather(weather);
            if (Snow != null)
            {
                ParticleSystem.EmissionModule snowEmission = Snow.emission;
                snowEmission.rateOverTime = weather == WorldWeather.WinterSnow ? 850f : 0f;
            }
            if (Rain != null)
            {
                ParticleSystem.EmissionModule rainEmission = Rain.emission;
                rainEmission.rateOverTime = weather == WorldWeather.SpringRain || weather == WorldWeather.AutumnRain ? 700f : 0f;
            }
            ApplyHour(CurrentHour);
        }

        private void DetectWeatherFromSession()
        {
            int month = ReadMonthFromSession(-1);
            if (month < 0) return;
            if (month >= 11 || month <= 2) SetWeather(WorldWeather.WinterSnow);
            else if (month == 3 || month == 4 || month == 5) SetWeather(WorldWeather.SpringRain);
            else if (month == 9 || month == 10) SetWeather(WorldWeather.AutumnRain);
            else SetWeather(WorldWeather.Clear);
        }

        // ------------------------------------------------------------------
        //  LOD (tv_rubin, radio, alarm_vityaz, chair_item, chair_old)
        // ------------------------------------------------------------------

        private void BuildLodObjects()
        {
            AddLod("tv_rubin", "Телевизор «Рубин» (LOD)", WorldAnchors.ApartmentTv, ApartmentRoot.transform, 0.22f, 5.2f, LowTv);
            AddLod("radio", "Радио (LOD)", WorldAnchors.KioskRadio, KioskRoot.transform, 0.18f, 3.8f, LowRadio);
            AddLod("alarm_vityaz", "Будильник «Витязь» (LOD)", WorldAnchors.ApartmentAlarm, ApartmentRoot.transform, 0.15f, 3.2f, LowAlarm);
            AddLod("chair_item", "Стул жилой комнаты (LOD)", new Vector3(47.6f, WorldAnchors.ApartmentFloorY, 77.4f), ApartmentRoot.transform, 0.22f, 4.8f, LowChair);
            AddLod("chair_old", "Старый стул ларька (LOD)", new Vector3(0.9f, 0f, 0.2f), KioskRoot.transform, 0.18f, 4.5f, LowChair);
        }

        private void AddLod(string id, string name, Vector3 position, Transform parent, float transition, float distance, Func<Transform, GameObject> lowFactory)
        {
            GameObject group = new GameObject(name + " [LOD]");
            group.transform.SetParent(LodRoot.transform, false);
            group.transform.position = position;

            string modelFile = id == "tv_rubin" ? "rubin.glb"
                : id == "alarm_vityaz" ? "vityaz.glb"
                : id + ".glb";
            GameObject high = PlaceModel(modelFile, group.transform, Vector3.zero, Quaternion.identity);
            if (high == null)
            {
                GameObject fallback = new FallbackModelLoader().Create(modelFile);
                if (fallback != null) fallback.transform.SetParent(group.transform, false);
            }
            GameObject low = lowFactory != null ? lowFactory(group.transform) : null;

            LODGroup lodGroup = group.AddComponent<LODGroup>();
            Renderer[] highRenderers = CollectRenderers(group.transform, low);
            Renderer[] lowRenderers = low != null ? low.GetComponentsInChildren<Renderer>(true) : new Renderer[0];
            lodGroup.SetLODs(new[]
            {
                new LOD(Mathf.Clamp01(transition), highRenderers.Length > 0 ? highRenderers : lowRenderers),
                new LOD(0.02f, lowRenderers)
            });
            lodGroup.fadeMode = LODFadeMode.None;
            lodGroup.animateCrossFading = false;
            LodObjects.Add(group.transform);
        }

        private static Renderer[] CollectRenderers(Transform root, GameObject exclude)
        {
            var result = new List<Renderer>();
            foreach (Renderer renderer in root.GetComponentsInChildren<Renderer>(true))
            {
                if (exclude != null && IsDescendant(renderer.transform, exclude.transform)) continue;
                result.Add(renderer);
            }
            return result.ToArray();
        }

        private static bool IsDescendant(Transform candidate, Transform parent)
        {
            Transform cursor = candidate;
            while (cursor != null)
            {
                if (cursor == parent) return true;
                cursor = cursor.parent;
            }
            return false;
        }

        private GameObject LowTv(Transform parent)
        {
            Material wood = Mat("lod_tv_wood", new Color(0.36f, 0.20f, 0.12f), 0.5f);
            Material screen = Mat("lod_tv_screen", new Color(0.19f, 0.25f, 0.28f), 0.2f);
            GameObject low = new GameObject("LOW tv_rubin");
            low.transform.SetParent(parent, false);
            Box(low.transform, "корпус", Vector3.zero, new Vector3(0.58f, 0.45f, 0.34f), wood);
            Box(low.transform, "экран", new Vector3(-0.06f, 0, 0.18f), new Vector3(0.36f, 0.29f, 0.03f), screen);
            return low;
        }

        private GameObject LowRadio(Transform parent)
        {
            GameObject low = new GameObject("LOW radio");
            low.transform.SetParent(parent, false);
            Box(low.transform, "корпус", Vector3.zero, new Vector3(0.28f, 0.22f, 0.11f), Mat("lod_radio", new Color(0.18f, 0.19f, 0.20f), 0.4f));
            return low;
        }

        private GameObject LowAlarm(Transform parent)
        {
            GameObject low = new GameObject("LOW alarm_vityaz");
            low.transform.SetParent(parent, false);
            Cylinder(low.transform, "циферблат", Vector3.zero, new Vector3(0.16f, 0.06f, 0.16f), Mat("lod_alarm", new Color(0.82f, 0.80f, 0.70f), 0.4f), Quaternion.Euler(90, 0, 0));
            return low;
        }

        private GameObject LowChair(Transform parent)
        {
            GameObject low = new GameObject("LOW chair");
            low.transform.SetParent(parent, false);
            Material seat = Mat("lod_chair_seat", new Color(0.54f, 0.20f, 0.16f), 0.7f);
            Material wood = Mat("lod_chair_wood", new Color(0.35f, 0.22f, 0.12f), 0.6f);
            Box(low.transform, "сиденье", new Vector3(0, 0.44f, 0), new Vector3(0.42f, 0.04f, 0.42f), seat);
            Box(low.transform, "спинка", new Vector3(0, 0.72f, -0.18f), new Vector3(0.38f, 0.26f, 0.03f), seat);
            for (int i = -1; i <= 1; i += 2)
                for (int j = -1; j <= 1; j += 2)
                    Box(low.transform, "ножка", new Vector3(i * 0.18f, 0.22f, j * 0.18f), new Vector3(0.035f, 0.44f, 0.035f), wood);
            return low;
        }

        // ------------------------------------------------------------------
        //  Зеркало: только когда игрок смотрит, каждый 3-й кадр, 224x288
        // ------------------------------------------------------------------

        private void BuildMirror()
        {
            MirrorTexture = new RenderTexture(224, 288, 16, RenderTextureFormat.ARGB32);
            MirrorTexture.name = "Зеркало 224x288";
            MirrorTexture.filterMode = FilterMode.Bilinear;
            MirrorTexture.wrapMode = TextureWrapMode.Clamp;
            MirrorTexture.Create();

            GameObject cameraObject = new GameObject("Камера зеркала");
            cameraObject.transform.SetParent(ApartmentRoot.transform, false);
            cameraObject.transform.position = WorldAnchors.ApartmentMirror + new Vector3(0, 0, -0.05f);
            cameraObject.transform.rotation = Quaternion.Euler(0, 180, 0);
            MirrorCamera = cameraObject.AddComponent<Camera>();
            MirrorCamera.fieldOfView = 58f;
            MirrorCamera.aspect = 224f / 288f;
            MirrorCamera.nearClipPlane = 0.08f;
            MirrorCamera.farClipPlane = 12f;
            MirrorCamera.targetTexture = MirrorTexture;
            MirrorCamera.enabled = false;

            Material mirrorMaterial = Mat("mirror_surface", new Color(0.82f, 0.88f, 0.92f), 0.95f);
            if (mirrorMaterial != null)
            {
                mirrorMaterial.mainTexture = MirrorTexture;
                if (mirrorMaterial.HasProperty("_EmissionColor")) mirrorMaterial.SetColor("_EmissionColor", Color.white * 0.25f);
            }
            GameObject mirror = Box(ApartmentRoot.transform, "Зеркало в ванной", WorldAnchors.ApartmentMirror, new Vector3(0.62f, 0.72f, 0.02f), mirrorMaterial);
            MirrorSurface = mirror;
            mirrorDependentRenderers.Add(mirror.GetComponent<Renderer>());
            foreach (Renderer renderer in mirrorDependentRenderers) renderer.enabled = false;
        }

        private void UpdateMirror(Camera viewer)
        {
            if (MirrorCamera == null || MirrorSurface == null || MirrorTexture == null || viewer == null) return;
            Vector3 toMirror = MirrorSurface.transform.position - viewer.transform.position;
            float distance = toMirror.magnitude;
            bool lookedAt = distance < 4f && Vector3.Dot(viewer.transform.forward, toMirror.normalized) > 0.62f;
            foreach (Renderer renderer in mirrorDependentRenderers) renderer.enabled = lookedAt;
            if (!lookedAt || Time.frameCount % 3 != 0) return;
            MirrorCamera.enabled = false;
            MirrorCamera.Render();
        }

        // ------------------------------------------------------------------
        //  Взаимодействия, звук, кадр
        // ------------------------------------------------------------------

        private void SetupInteractions()
        {
            if (Interactions == null)
            {
                Interactions = gameObject.GetComponent<WorldInteractions>();
                if (Interactions == null) Interactions = gameObject.AddComponent<WorldInteractions>();
            }
            Interactions.RegisterWorldPoints(this);
            Interactions.Interacted += OnInteraction;
        }

        private void SetupAudio()
        {
            if (Audio == null)
            {
                Audio = gameObject.GetComponent<WorldAudio>();
                if (Audio == null) Audio = gameObject.AddComponent<WorldAudio>();
            }
            Audio.BuildDefaultSources(this);
        }

        private void OnInteraction(string id)
        {
            switch (id)
            {
                case "entrance_intercom":
                    if (Audio != null) Audio.PlayIntercomBeep();
                    SubmitIntercomCode(WorldAnchors.IntercomCode);
                    break;
                case "entrance_exit_button":
                    if (Audio != null) Audio.PlayMagnetClick();
                    PressExitButton();
                    break;
                case "entrance_door_handle":
                    DoorResult entranceResult = EntranceState.UseHandle(Interactions.LastAimWasOnHandle, Interactions.LastDistance);
                    if (Audio != null && entranceResult == DoorResult.Locked) Audio.PlayIntercomBeep();
                    else if (Audio != null && (entranceResult == DoorResult.Opened || entranceResult == DoorResult.Closed)) Audio.PlayMagnetClick();
                    Debug.Log(entranceResult);
                    break;
                case "apartment_door_handle":
                    DoorResult apartmentResult = ApartmentState.UseHandle(Interactions.LastAimWasOnHandle, Interactions.LastDistance,
                        Interactions.PlayerIsInsideApartment, Interactions.PlayerHoldsApartmentKey);
                    if (Audio != null && apartmentResult == DoorResult.Opened) Audio.PlayMagnetClick();
                    Debug.Log(apartmentResult);
                    break;
                case "kiosk_hatch":
                    SetKioskHatch(hatchTarget < 0.5f ? 1f : 0f);
                    break;
                case "roof_hatch":
                    SetRoofHatch(roofHatchTarget < 0.5f ? 1f : 0f);
                    break;
                case "ladder_base":
                    if (Interactions != null) Interactions.SetOnLadder(true, false);
                    break;
                case "ladder_top":
                    if (Interactions != null) Interactions.SetOnLadder(false, false);
                    break;
                case "roof_exit":
                    if (Interactions != null) Interactions.SetOnLadder(true, true);
                    break;
            }
        }

        public bool SubmitIntercomCode(string code) => EntranceState != null && EntranceState.EnterCode(code);

        public void PressExitButton()
        {
            if (EntranceState != null) EntranceState.PressExitButton();
        }

        private void EnableFrustumCulling()
        {
            // M42: всё, что может попасть в кадр, участвует в стандартном frustum culling.
            foreach (Renderer renderer in GetComponentsInChildren<Renderer>(true))
            {
                if (WeatherRoot != null && IsDescendant(renderer.transform, WeatherRoot.transform)) continue;
                renderer.frustumCulled = true;
            }
        }

        private void Update()
        {
            if (!Built) return;
            float dt = Time.deltaTime;
            if (EntranceState != null) EntranceState.Tick(dt);
            StepHatches(dt);

            if (viewerCamera == null) viewerCamera = Camera.main;
            float hour = ReadHourFromSession(CurrentHour);
            if (Mathf.Abs(hour - CurrentHour) > 0.001f) ApplyHour(hour);
            if (viewerCamera != null)
            {
                UpdateKioskLampFrustum(viewerCamera);
                UpdateMirror(viewerCamera);
                if (Snow != null) Snow.transform.position = new Vector3(viewerCamera.transform.position.x, 0, viewerCamera.transform.position.z);
                if (Rain != null) Rain.transform.position = new Vector3(viewerCamera.transform.position.x, 0, viewerCamera.transform.position.z);
            }
        }

        // ------------------------------------------------------------------
        //  Опциональная интеграция с Larek.Gameplay через рефлексию
        //  (ассемблер GameSession может появиться позже — компиляция не зависит от него).
        // ------------------------------------------------------------------

        private static object ReadPath(object root, params string[] names)
        {
            object current = root;
            foreach (string name in names)
            {
                if (current == null) return null;
                Type type = current.GetType();
                PropertyInfo property = type.GetProperty(name, BindingFlags.Public | BindingFlags.Instance | BindingFlags.Static);
                if (property != null && property.CanRead)
                {
                    try { current = property.GetValue(current, null); continue; }
                    catch { return null; }
                }
                FieldInfo field = type.GetField(name, BindingFlags.Public | BindingFlags.Instance | BindingFlags.Static);
                if (field != null)
                {
                    try { current = field.GetValue(current); continue; }
                    catch { return null; }
                }
                return null;
            }
            return current;
        }

        private static object CurrentSession()
        {
            Assembly[] assemblies;
            try { assemblies = AppDomain.CurrentDomain.GetAssemblies(); }
            catch { return null; }
            foreach (Assembly assembly in assemblies)
            {
                Type type;
                try { type = assembly.GetType("Larek.Gameplay.GameSession", false, false); }
                catch { continue; }
                if (type == null) continue;
                PropertyInfo property = type.GetProperty("Current", BindingFlags.Public | BindingFlags.Static);
                if (property != null)
                {
                    try { return property.GetValue(null, null); }
                    catch { return null; }
                }
            }
            return null;
        }

        private static float ReadHourFromSession(float fallback)
        {
            object days = ReadPath(CurrentSession(), "Days");
            object value = ReadPath(days, "Hour") ?? ReadPath(days, "HourOfDay") ?? ReadPath(days, "CurrentHour") ?? ReadPath(days, "TimeOfDayHours");
            if (value is float) return (float)value;
            if (value is double) return (float)(double)value;
            if (value is int) return (int)value;
            return fallback;
        }

        private static int ReadMonthFromSession(int fallback)
        {
            object days = ReadPath(CurrentSession(), "Days");
            object value = ReadPath(days, "Month") ?? ReadPath(days, "CurrentMonth") ?? ReadPath(days, "Date", "Month");
            if (value is int) return (int)value;
            if (value is float) return (int)(float)value;
            if (value is double) return (int)(double)value;
            if (value is System.DateTime) return ((System.DateTime)value).Month;
            return fallback;
        }
    }
}
