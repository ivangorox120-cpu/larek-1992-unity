using System;
using System.Collections.Generic;
using UnityEngine;

namespace Larek.World
{
    /// <summary>Роли моделей из Assets/StreamingAssets/Game/models (81 GLB).</summary>
    [Flags]
    public enum ModelRole
    {
        None = 0,
        Kiosk = 1 << 0,
        Apartment = 1 << 1,
        Furniture = 1 << 2,
        Fridge = 1 << 3,
        Tv = 1 << 4,
        Radio = 1 << 5,
        Alarm = 1 << 6,
        Bus = 1 << 7,
        BusStop = 1 << 8,
        Person = 1 << 9,
        Pedestrian = 1 << 10,
        Hero = 1 << 11,
        Police = 1 << 12,
        Vendor = 1 << 13,
        Vehicle = 1 << 14,
        Item = 1 << 15,
        Structure = 1 << 16,
        Nature = 1 << 17,
        Weapon = 1 << 18,
        Lod = 1 << 19
    }

    public sealed class WorldModel
    {
        public readonly string FileName;
        public readonly ModelRole Role;
        public readonly string Description;

        public WorldModel(string fileName, ModelRole role, string description = "")
        {
            FileName = fileName;
            Role = role;
            Description = description;
        }

        public bool Is(ModelRole role) => (Role & role) != 0;
    }

    /// <summary>Опорная точка остановки: данные взяты из transport.js (STOPS).</summary>
    public sealed class BusStopAnchor
    {
        public readonly string Key;
        public readonly string NameRu;
        public readonly Vector3 Shelter;
        public readonly Vector3 Boarding;
        public readonly Vector3 Lane;
        public readonly float ShelterRotationY;
        public readonly bool North;
        public readonly string Orientation;

        public BusStopAnchor(string key, string nameRu,
            float shelterX, float shelterZ, float stopX, float stopZ,
            float rotationY, bool north, string orientation)
        {
            Key = key;
            NameRu = nameRu;
            Shelter = new Vector3(shelterX, 0f, shelterZ);
            Boarding = new Vector3(stopX, 0f, stopZ);
            Lane = new Vector3(stopX, 0f, stopZ);
            ShelterRotationY = rotationY;
            North = north;
            Orientation = orientation;
        }
    }

    /// <summary>
    /// Мировые якоря в координатах оригинальной игры: ларёк в локальном нуле,
    /// дом № 14 / квартира № 4 — в районе (42; 82), что соответствует предупреждению
    /// PROJECT_HANDOFF о высокоточных координатах (48; 82).
    /// </summary>
    public static class WorldAnchors
    {
        public const float ApartmentFloorY = 2.60f;
        public const float RoofY = 12.86f;
        public const float LadderBottomY = 12.06f;
        public const float LadderTopClosedY = 12.90f;
        public const float LadderTopOpenY = 13.52f;
        public const string IntercomCode = "1992";
        public const float IntercomUnlockSeconds = 6f;

        public static readonly Vector3 Kiosk = new Vector3(0f, 0f, 0f);
        public static readonly Vector3 KioskCounter = new Vector3(0f, 1.05f, 1.05f);
        public static readonly Vector3 KioskDoorHandle = new Vector3(0.80f, 1.02f, -1.28f);
        public static readonly Vector3 KioskFridge = new Vector3(1.14f, 0.02f, 0.18f);
        public static readonly Vector3 KioskTv = new Vector3(-1.12f, 1.005f, 0.52f);
        public static readonly Vector3 KioskRadio = new Vector3(-1.33f, 1.315f, -0.62f);
        public static readonly Vector3 KioskSign = new Vector3(0f, 2.73f, 1.43f);
        public static readonly Vector3 KioskLamp = new Vector3(0f, 2.24f, -0.10f);

        /// <summary>Высокоточная точка из PROJECT_HANDOFF (для калибровки камеры/теней).</summary>
        public static readonly Vector3 HighPrecisionReference = new Vector3(48f, 0f, 82f);

        public static readonly Vector3 Apartment = new Vector3(45.4f, ApartmentFloorY, 79.0f);
        public static readonly Vector3 ApartmentDoor = new Vector3(41.20f, ApartmentFloorY, 81.35f);
        public static readonly Vector3 ApartmentDoorHandle = new Vector3(41.26f, ApartmentFloorY + 1.02f, 81.86f);
        public static readonly Vector3 ApartmentFridge = new Vector3(42.10f, ApartmentFloorY, 76.20f);
        public static readonly Vector3 ApartmentTv = new Vector3(44.63f, ApartmentFloorY + 0.85f, 75.75f);
        public static readonly Vector3 ApartmentRadio = new Vector3(48.55f, ApartmentFloorY + 0.82f, 76.40f);
        public static readonly Vector3 ApartmentAlarm = new Vector3(48.10f, ApartmentFloorY + 0.78f, 76.40f);
        public static readonly Vector3 ApartmentMirror = new Vector3(42.38f, ApartmentFloorY + 1.46f, 77.58f);
        public static readonly Vector3 ApartmentPhone = new Vector3(47.95f, ApartmentFloorY + 0.90f, 82.30f);

        public static readonly Vector3 Entrance = new Vector3(36.825f, 0f, 74.10f);
        public static readonly Vector3 EntranceDoorHandle = new Vector3(37.02f, 1.02f, 74.06f);
        public static readonly Vector3 Intercom = new Vector3(36.37f, 1.32f, 74.04f);
        public static readonly Vector3 ExitButton = new Vector3(36.37f, 1.36f, 74.14f);

        public static readonly Vector3 LadderBase = new Vector3(40.70f, 0f, 74.80f);
        public static readonly Vector3 Ladder = new Vector3(40.70f, LadderBottomY, 74.80f);
        public static readonly Vector3 RoofHatch = new Vector3(40.70f, RoofY, 74.75f);
        public static readonly Vector3 RoofExit = new Vector3(40.70f, RoofY + 1.66f, 75.95f);

        public static readonly Vector3 BusStart = new Vector3(6.80f, 0f, 8.40f);
    }

    /// <summary>Пути StreamingAssets. На Android они остаются JAR-URL, сетевые запросы не используются.</summary>
    public static class GameAssetPaths
    {
        public static string GameRoot => Application.streamingAssetsPath + "/Game";
        public static string Model(string fileName) => GameRoot + "/models/" + fileName;
        public static string Audio(string fileName) => GameRoot + "/audio/" + fileName;
        public static string Video(string fileName) => GameRoot + "/video/" + fileName;
        public static string Texture(string fileName) => GameRoot + "/tex/" + fileName;
        public static string Font(string fileName) => GameRoot + "/fonts/" + fileName;
        public static string ToUrl(string path)
        {
            if (string.IsNullOrEmpty(path)) return path;
            if (path.StartsWith("jar:", StringComparison.Ordinal) ||
                path.StartsWith("http://", StringComparison.Ordinal) ||
                path.StartsWith("https://", StringComparison.Ordinal)) return path;
            try { return new Uri(path).AbsoluteUri; }
            catch { return path; }
        }
    }

    public static class WorldCatalogue
    {
        private static readonly WorldModel[] ModelArray =
        {
            new WorldModel("apartment.glb", ModelRole.Structure | ModelRole.Apartment, "Квартира № 4 и дом № 14"),
            new WorldModel("beton.glb", ModelRole.Structure, "Бетонные конструкции"),
            new WorldModel("bmw733i.glb", ModelRole.Vehicle, "BMW 733i"),
            new WorldModel("bush.glb", ModelRole.Nature, "Куст"),
            new WorldModel("busstop.glb", ModelRole.BusStop | ModelRole.Structure, "Павильон остановки"),
            new WorldModel("chair.glb", ModelRole.Furniture | ModelRole.Item, "Стул"),
            new WorldModel("chair_old.glb", ModelRole.Furniture | ModelRole.Item | ModelRole.Lod, "Старый стул (LOD)"),
            new WorldModel("cigarette.glb", ModelRole.Item, "Сигарета"),
            new WorldModel("forest_trees.glb", ModelRole.Nature, "Лес вдоль заводской дороги"),
            new WorldModel("guitar.glb", ModelRole.Item, "Гитара"),
            new WorldModel("gun.glb", ModelRole.Weapon | ModelRole.Item, "Охотничье ружьё"),
            new WorldModel("kreslo.glb", ModelRole.Furniture | ModelRole.Item, "Кресло"),
            new WorldModel("nodrink.glb", ModelRole.Item, "Плакат «Не пей»"),
            new WorldModel("notepad.glb", ModelRole.Item, "Блокнот"),
            new WorldModel("npc_driver.glb", ModelRole.Person | ModelRole.Vendor, "Дядя Коля, водитель ПАЗ-652"),
            new WorldModel("npc_police.glb", ModelRole.Person | ModelRole.Police, "Милиционер"),
            new WorldModel("npc_x_bandit1.glb", ModelRole.Person | ModelRole.Pedestrian, "Бандит 1"),
            new WorldModel("npc_x_bandit2.glb", ModelRole.Person | ModelRole.Pedestrian, "Бандит 2"),
            new WorldModel("npc_x_bandit3.glb", ModelRole.Person | ModelRole.Pedestrian, "Бандит 3"),
            new WorldModel("npc_x_bandit_w1.glb", ModelRole.Person | ModelRole.Pedestrian, "Бандит (зима) 1"),
            new WorldModel("npc_x_bandit_w2.glb", ModelRole.Person | ModelRole.Pedestrian, "Бандит (зима) 2"),
            new WorldModel("npc_x_boy1.glb", ModelRole.Person | ModelRole.Pedestrian, "Мальчик 1"),
            new WorldModel("npc_x_boy2.glb", ModelRole.Person | ModelRole.Pedestrian, "Мальчик 2"),
            new WorldModel("npc_x_boy3.glb", ModelRole.Person | ModelRole.Pedestrian, "Мальчик 3"),
            new WorldModel("npc_x_boy_w1.glb", ModelRole.Person | ModelRole.Pedestrian, "Мальчик (зима) 1"),
            new WorldModel("npc_x_boy_w2.glb", ModelRole.Person | ModelRole.Pedestrian, "Мальчик (зима) 2"),
            new WorldModel("npc_x_girl1.glb", ModelRole.Person | ModelRole.Pedestrian, "Девочка 1"),
            new WorldModel("npc_x_girl2.glb", ModelRole.Person | ModelRole.Pedestrian, "Девочка 2"),
            new WorldModel("npc_x_girl3.glb", ModelRole.Person | ModelRole.Pedestrian, "Девочка 3"),
            new WorldModel("npc_x_girl_w1.glb", ModelRole.Person | ModelRole.Pedestrian, "Девочка (зима) 1"),
            new WorldModel("npc_x_girl_w2.glb", ModelRole.Person | ModelRole.Pedestrian, "Девочка (зима) 2"),
            new WorldModel("npc_x_gop1.glb", ModelRole.Person | ModelRole.Pedestrian, "Гопник 1"),
            new WorldModel("npc_x_gop2.glb", ModelRole.Person | ModelRole.Pedestrian, "Гопник 2"),
            new WorldModel("npc_x_gop3.glb", ModelRole.Person | ModelRole.Pedestrian, "Гопник 3"),
            new WorldModel("npc_x_gop_w1.glb", ModelRole.Person | ModelRole.Pedestrian, "Гопник (зима) 1"),
            new WorldModel("npc_x_gop_w2.glb", ModelRole.Person | ModelRole.Pedestrian, "Гопник (зима) 2"),
            new WorldModel("npc_x_grandma1.glb", ModelRole.Person | ModelRole.Pedestrian, "Бабушка 1"),
            new WorldModel("npc_x_grandma2.glb", ModelRole.Person | ModelRole.Pedestrian, "Бабушка 2"),
            new WorldModel("npc_x_grandma3.glb", ModelRole.Person | ModelRole.Pedestrian, "Бабушка 3"),
            new WorldModel("npc_x_grandma_w1.glb", ModelRole.Person | ModelRole.Pedestrian, "Бабушка (зима) 1"),
            new WorldModel("npc_x_grandma_w2.glb", ModelRole.Person | ModelRole.Pedestrian, "Бабушка (зима) 2"),
            new WorldModel("npc_x_grandpa1.glb", ModelRole.Person | ModelRole.Pedestrian, "Дедушка 1"),
            new WorldModel("npc_x_grandpa2.glb", ModelRole.Person | ModelRole.Pedestrian, "Дедушка 2"),
            new WorldModel("npc_x_grandpa3.glb", ModelRole.Person | ModelRole.Pedestrian, "Дедушка 3"),
            new WorldModel("npc_x_grandpa_w1.glb", ModelRole.Person | ModelRole.Pedestrian, "Дедушка (зима) 1"),
            new WorldModel("npc_x_grandpa_w2.glb", ModelRole.Person | ModelRole.Pedestrian, "Дедушка (зима) 2"),
            new WorldModel("npc_x_hero.glb", ModelRole.Person | ModelRole.Hero, "Герой (зеркало/отражение)"),
            new WorldModel("npc_x_man1.glb", ModelRole.Person | ModelRole.Pedestrian, "Мужчина 1"),
            new WorldModel("npc_x_man2.glb", ModelRole.Person | ModelRole.Pedestrian, "Мужчина 2"),
            new WorldModel("npc_x_man3.glb", ModelRole.Person | ModelRole.Pedestrian, "Мужчина 3"),
            new WorldModel("npc_x_man_w1.glb", ModelRole.Person | ModelRole.Pedestrian, "Мужчина (зима) 1"),
            new WorldModel("npc_x_man_w2.glb", ModelRole.Person | ModelRole.Pedestrian, "Мужчина (зима) 2"),
            new WorldModel("npc_x_man_w3.glb", ModelRole.Person | ModelRole.Pedestrian, "Мужчина (зима) 3"),
            new WorldModel("npc_x_marat.glb", ModelRole.Person | ModelRole.Vendor, "Марат"),
            new WorldModel("npc_x_police1.glb", ModelRole.Person | ModelRole.Police, "Сержант милиции 1"),
            new WorldModel("npc_x_police2.glb", ModelRole.Person | ModelRole.Police, "Сержант милиции 2"),
            new WorldModel("npc_x_police_w1.glb", ModelRole.Person | ModelRole.Police, "Милиционер (зима) 1"),
            new WorldModel("npc_x_police_w2.glb", ModelRole.Person | ModelRole.Police, "Милиционер (зима) 2"),
            new WorldModel("npc_x_woman1.glb", ModelRole.Person | ModelRole.Pedestrian, "Женщина 1"),
            new WorldModel("npc_x_woman2.glb", ModelRole.Person | ModelRole.Pedestrian, "Женщина 2"),
            new WorldModel("npc_x_woman3.glb", ModelRole.Person | ModelRole.Pedestrian, "Женщина 3"),
            new WorldModel("npc_x_woman_w1.glb", ModelRole.Person | ModelRole.Pedestrian, "Женщина (зима) 1"),
            new WorldModel("npc_x_woman_w2.glb", ModelRole.Person | ModelRole.Pedestrian, "Женщина (зима) 2"),
            new WorldModel("npc_x_woman_w3.glb", ModelRole.Person | ModelRole.Pedestrian, "Женщина (зима) 3"),
            new WorldModel("npc_x_zina.glb", ModelRole.Person | ModelRole.Vendor, "Тётя Зина"),
            new WorldModel("paz3205.glb", ModelRole.Bus | ModelRole.Vehicle, "ПАЗ-3205 (процедурный прототип)"),
            new WorldModel("paz652.glb", ModelRole.Bus | ModelRole.Vehicle, "ПАЗ-652, маршрут № 7"),
            new WorldModel("phone.glb", ModelRole.Item, "Телефон"),
            new WorldModel("poster.glb", ModelRole.Structure, "Плакат"),
            new WorldModel("radio.glb", ModelRole.Radio | ModelRole.Item | ModelRole.Lod, "Радио (LOD)"),
            new WorldModel("rubin.glb", ModelRole.Tv | ModelRole.Item | ModelRole.Lod, "Телевизор «Рубин» (LOD)"),
            new WorldModel("steelworker.glb", ModelRole.Person | ModelRole.Pedestrian, "Сталевар"),
            new WorldModel("stew.glb", ModelRole.Item, "Тушёнка"),
            new WorldModel("trashcan.glb", ModelRole.Structure, "Мусорный бак"),
            new WorldModel("tree.glb", ModelRole.Nature, "Дерево"),
            new WorldModel("vaz2101.glb", ModelRole.Vehicle, "ВАЗ-2101"),
            new WorldModel("vaz2101_lod.glb", ModelRole.Vehicle | ModelRole.Lod, "ВАЗ-2101 (дальний LOD)"),
            new WorldModel("vaz2107.glb", ModelRole.Vehicle, "ВАЗ-2107"),
            new WorldModel("vaz2107_lod.glb", ModelRole.Vehicle | ModelRole.Lod, "ВАЗ-2107 (дальний LOD)"),
            new WorldModel("vityaz.glb", ModelRole.Alarm | ModelRole.Item | ModelRole.Lod, "Будильник «Витязь» (LOD)"),
            new WorldModel("vodka.glb", ModelRole.Item, "Бутылка водки")
        };

        private static readonly BusStopAnchor[] StopArray =
        {
            new BusStopAnchor("kiosk", "Ул. Советская (Ларёк)", 8.0f, 3.55f, 6.8f, 8.4f, -Mathf.PI / 2f, false, "S"),
            new BusStopAnchor("factory", "Краснозаводский Мясокомбинат", 219.0f, -0.85f, 219.0f, 3.4f, -Mathf.PI / 2f, false, "S"),
            new BusStopAnchor("bakery_return", "Краснозаводский Хлебозавод", 174.55f, 29.6f, 169.6f, 30.8f, Mathf.PI, true, "W"),
            new BusStopAnchor("sizo", "СИЗО № 1 («Кресты») · ул. Ленина", 55.45f, 89.5f, 60.4f, 89.5f, 0f, false, "E"),
            new BusStopAnchor("rovd", "Участок милиции · ул. Советская", -30.0f, 66.5f, -31.2f, 61.6f, Mathf.PI / 2f, true, "N"),
            new BusStopAnchor("kiosk_return", "Квартира героя (Ул. Советская, 14)", 21.0f, 66.5f, 19.8f, 61.6f, Mathf.PI / 2f, true, "N"),
            new BusStopAnchor("lvz_return", "Краснозаводский Ликёро-водочный", 68.55f, 46.5f, 63.6f, 46.5f, Mathf.PI, true, "W"),
            new BusStopAnchor("garages", "ГСК «Советский» (Гаражи / Марат)", 36.0f, 3.55f, 34.8f, 8.4f, -Mathf.PI / 2f, false, "S")
        };

        private static readonly Dictionary<string, WorldModel> ModelsByName = BuildNameIndex();
        private static readonly Dictionary<string, BusStopAnchor> StopsByKey = BuildStopIndex();

        public static IReadOnlyList<WorldModel> Models => ModelArray;
        public static IReadOnlyList<BusStopAnchor> Stops => StopArray;

        private static Dictionary<string, WorldModel> BuildNameIndex()
        {
            var result = new Dictionary<string, WorldModel>(StringComparer.OrdinalIgnoreCase);
            foreach (WorldModel model in ModelArray) result[model.FileName] = model;
            return result;
        }

        private static Dictionary<string, BusStopAnchor> BuildStopIndex()
        {
            var result = new Dictionary<string, BusStopAnchor>(StringComparer.OrdinalIgnoreCase);
            foreach (BusStopAnchor stop in StopArray) result[stop.Key] = stop;
            return result;
        }

        public static bool TryGet(string fileName, out WorldModel model)
        {
            if (!string.IsNullOrEmpty(fileName) && ModelsByName.TryGetValue(fileName, out model)) return true;
            model = null;
            return false;
        }

        public static WorldModel Get(string fileName)
        {
            WorldModel model;
            return TryGet(fileName, out model) ? model : null;
        }

        public static IReadOnlyList<WorldModel> ByRole(ModelRole role)
        {
            var result = new List<WorldModel>();
            foreach (WorldModel model in ModelArray)
                if ((model.Role & role) != 0) result.Add(model);
            return result;
        }

        public static BusStopAnchor Stop(string key)
        {
            BusStopAnchor stop;
            return !string.IsNullOrEmpty(key) && StopsByKey.TryGetValue(key, out stop) ? stop : null;
        }

        /// <summary>Холодильник «ЗИЛ-Москва» строится процедурно (fridge_zil.js), отдельного GLB нет.</summary>
        public static bool HasModel(string fileName) => TryGet(fileName, out _);
    }
}
