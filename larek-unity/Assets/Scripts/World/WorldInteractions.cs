using System;
using System.Collections;
using System.Collections.Generic;
using System.Reflection;
using Larek.Interactions;
using UnityEngine;

namespace Larek.World
{
    /// <summary>Тип точки взаимодействия в мире.</summary>
    public enum WorldInteractionType
    {
        Generic,
        Door,
        Handle,
        Intercom,
        Button,
        Hatch,
        Ladder,
        Stop,
        Item
    }

    /// <summary>
    /// Точка взаимодействия: идентификатор, тип, дальность и русская подсказка.
    /// </summary>
    public sealed class WorldInteractionPoint
    {
        public readonly string Id;
        public readonly WorldInteractionType Type;
        public readonly float Reach;

        public string Prompt;
        public Transform Target;
        public GameObject MarkerObject;
        public WorldInteractionMarker Marker;
        public bool Enabled = true;

        public WorldInteractionPoint(string id, WorldInteractionType type, string prompt, float reach, Transform target)
        {
            Id = id;
            Type = type;
            Prompt = prompt;
            Reach = Mathf.Max(0.1f, reach);
            Target = target;
        }

        public Vector3 Position => Target != null ? Target.position : Vector3.zero;

        /// <summary>Ручка двери: M06/M32 требуют прицела именно на неё и дистанции ≤ 1 м.</summary>
        public bool IsHandle => Type == WorldInteractionType.Handle || Type == WorldInteractionType.Door ||
                                (Id != null && Id.EndsWith("_handle", StringComparison.OrdinalIgnoreCase));

        public bool IsLadder => Type == WorldInteractionType.Ladder;
    }

    /// <summary>Маркер на коллайдере точки; позволяет найти точку через Physics.Raycast.</summary>
    public sealed class WorldInteractionMarker : MonoBehaviour
    {
        public WorldInteractionPoint Point;
    }

    /// <summary>
    /// Рэйкаст-взаимодействия мира: подсказки, двери (≤ 1 м и прицел на ручку),
    /// домофон/кнопку, люки и подъём по лестнице на крышу (M33).
    /// Событие <see cref="Interacted"/> получает строковый id точки.
    /// </summary>
    public sealed class WorldInteractions : MonoBehaviour
    {
        private const BindingFlags MemberFlags = BindingFlags.Public | BindingFlags.NonPublic |
                                                 BindingFlags.Instance | BindingFlags.Static;

        [Header("Управление")]
        public Camera InteractionCamera;
        public Transform Player;
        public KeyCode InteractionKey = KeyCode.E;
        public bool ReadKeyboardInput = true;

        [Header("Прицел")]
        [Tooltip("Максимальный угол прицела для обычных точек, градусы")]
        public float AimAngleDegrees = 12f;
        [Tooltip("Максимальный угол прицела для ручек дверей, градусы")]
        public float HandleAimAngleDegrees = 6f;
        [Tooltip("Дальность рэйкаста поиска точек, метры")]
        public float RaycastDistance = 3f;

        [Header("Лестница на крышу (M33)")]
        public float LadderClimbSpeed = 0.55f;
        public string LadderAxis = "Vertical";

        [Header("Состояние игрока")]
        public bool AutoDetectPlayerZones = true;
        public bool DetectKeyFromSession = true;

        /// <summary>Идентификатор точки, в которую игрок смотрит сейчас.</summary>
        public event Action<string> Interacted;

        public readonly List<WorldInteractionPoint> Points = new List<WorldInteractionPoint>();

        /// <summary>Прицел на ручку двери в пределах досягаемости.</summary>
        public bool LastAimWasOnHandle { get; private set; }

        /// <summary>Горизонтальное расстояние до точки (метры); для дверей проверяется ≤ 1 м.</summary>
        public float LastDistance { get; private set; } = float.MaxValue;

        /// <summary>Игрок внутри квартиры № 4 (используется английским замком).</summary>
        public bool PlayerIsInsideApartment { get; set; }

        /// <summary>Ключ от квартиры в руке/инвентаре; при отсутствии GameSession можно задать вручную.</summary>
        public bool PlayerHoldsApartmentKey { get; set; }

        public WorldInteractionPoint FocusedPoint { get; private set; }
        public string CurrentPrompt => FocusedPoint != null && FocusedPoint.Enabled ? FocusedPoint.Prompt : LadderPrompt;

        public bool OnLadder { get; private set; }
        public float LadderProgress { get; private set; }
        public bool AtRoof => OnLadder && LadderProgress >= 0.999f;
        public bool AtLadderBottom => OnLadder && LadderProgress <= 0.001f;

        public string LadderPrompt
        {
            get
            {
                if (!OnLadder) return string.Empty;
                if (AtRoof) return "Спуск: ↑ / ↓ или W / S";
                if (AtLadderBottom) return "Подъём на крышу: ↑ / ↓ или W / S";
                return "Подъём / спуск: ↑ / ↓ или W / S";
            }
        }

        /// <summary>Позиция игрока на лестнице: 0 — низ, 1 — крыша.</summary>
        public Vector3 LadderWorldPosition
        {
            get
            {
                float y = Mathf.Lerp(WorldAnchors.LadderBottomY, WorldAnchors.LadderTopOpenY,
                    Mathf.Clamp01(LadderProgress));
                return new Vector3(WorldAnchors.Ladder.x, y, WorldAnchors.Ladder.z);
            }
        }

        private WorldBuilder builder;
        private readonly List<GameObject> createdMarkers = new List<GameObject>();
        private readonly List<GameObject> createdFallbacks = new List<GameObject>();
        private const float KeyPollSeconds = 0.5f;
        private float keyPollTimer;
        private bool roofReachedNotified;

        // ------------------------------------------------------------------
        //  Регистрация точек
        // ------------------------------------------------------------------

        /// <summary>Создаёт точки взаимодействия по объектам построенного мира.</summary>
        public void RegisterWorldPoints(WorldBuilder world)
        {
            builder = world;
            ClearPoints();
            if (world == null) return;

            Transform root = world.transform;

            AddPoint("kiosk_door_handle", WorldInteractionType.Handle, "Открыть дверь ларька", 1f,
                EnsureTransform(world.KioskDoorHandle, WorldAnchors.KioskDoorHandle, "Ручка двери ларька", root), 0.16f);
            AddPoint("kiosk_hatch", WorldInteractionType.Hatch, "Поднять люк прилавка", 1.4f,
                EnsureTransform(world.KioskHatch, WorldAnchors.KioskCounter + Vector3.up * 0.45f, "Люк ларька", root), 0.24f);
            AddPoint("kiosk_counter", WorldInteractionType.Item, "Посмотреть на прилавок", 1.8f,
                EnsureTransform(world.KioskCounter, WorldAnchors.KioskCounter, "Прилавок ларька", root), 0.32f);

            AddPoint("entrance_door_handle", WorldInteractionType.Handle, "Открыть дверь подъезда", 1f,
                EnsureTransform(world.EntranceDoorHandle, WorldAnchors.EntranceDoorHandle, "Ручка двери подъезда", root), 0.16f);
            AddPoint("entrance_intercom", WorldInteractionType.Intercom, "Набрать код домофона", 1.25f,
                EnsureTransform(world.IntercomPanel, WorldAnchors.Intercom, "Домофон", root), 0.18f);
            AddPoint("entrance_exit_button", WorldInteractionType.Button, "Нажать кнопку «ВЫХОД»", 1.25f,
                EnsureTransform(world.ExitButton, WorldAnchors.ExitButton, "Кнопка «ВЫХОД»", root), 0.14f);

            AddPoint("apartment_door_handle", WorldInteractionType.Handle, "Открыть дверь квартиры", 1f,
                EnsureTransform(world.ApartmentDoorHandle, WorldAnchors.ApartmentDoorHandle, "Ручка двери квартиры", root), 0.16f);

            AddPoint("ladder_base", WorldInteractionType.Ladder, "Влезть на лестницу", 1.5f,
                EnsureTransform(null, WorldAnchors.LadderBase + Vector3.up * 0.6f, "Основание лестницы", root), 0.28f);
            AddPoint("ladder_top", WorldInteractionType.Ladder, "Выйти на крышу", 1.4f,
                EnsureTransform(null, new Vector3(WorldAnchors.Ladder.x, WorldAnchors.LadderTopOpenY, WorldAnchors.Ladder.z),
                    "Верх лестницы", root), 0.24f);
            AddPoint("roof_hatch", WorldInteractionType.Hatch, "Открыть люк крыши", 1.5f,
                EnsureTransform(world.RoofHatch, WorldAnchors.RoofHatch, "Люк крыши", root), 0.26f);
            AddPoint("roof_exit", WorldInteractionType.Ladder, "Спуститься к лестнице", 1.6f,
                EnsureTransform(null, WorldAnchors.RoofExit, "Выход на крыше", root), 0.28f);

            foreach (BusStopAnchor stop in WorldCatalogue.Stops)
            {
                AddPoint("bus_stop_" + stop.Key, WorldInteractionType.Stop,
                    "Остановка «" + stop.NameRu + "»", 2.2f,
                    EnsureTransform(null, stop.Shelter + Vector3.up * 1.1f, "Остановка: " + stop.Key, root), 0.42f);
            }

            RefreshPrompts();
        }

        private Transform EnsureTransform(Transform existing, Vector3 fallbackPosition, string name, Transform root)
        {
            if (existing != null) return existing;
            GameObject go = new GameObject("Точка: " + name);
            if (root != null) go.transform.SetParent(root, false);
            go.transform.position = fallbackPosition;
            createdFallbacks.Add(go);
            return go.transform;
        }

        public WorldInteractionPoint AddPoint(string id, WorldInteractionType type, string prompt, float reach,
            Transform target, float markerRadius = 0.2f)
        {
            if (string.IsNullOrEmpty(id) || target == null) return null;
            WorldInteractionPoint existing = Find(id);
            if (existing != null) return existing;

            var point = new WorldInteractionPoint(id, type, prompt, reach, target);
            Points.Add(point);

            GameObject markerObject = new GameObject("Взаимодействие: " + id);
            markerObject.transform.SetParent(target, false);
            SphereCollider collider = markerObject.AddComponent<SphereCollider>();
            collider.isTrigger = true;
            collider.radius = Mathf.Max(0.05f, markerRadius);
            WorldInteractionMarker marker = markerObject.AddComponent<WorldInteractionMarker>();
            marker.Point = point;
            point.Marker = marker;
            point.MarkerObject = markerObject;
            createdMarkers.Add(markerObject);
            return point;
        }

        public void ClearPoints()
        {
            Points.Clear();
            FocusedPoint = null;
            LastAimWasOnHandle = false;
            LastDistance = float.MaxValue;
            foreach (GameObject marker in createdMarkers)
                if (marker != null) Destroy(marker);
            createdMarkers.Clear();
            foreach (GameObject fallback in createdFallbacks)
                if (fallback != null) Destroy(fallback);
            createdFallbacks.Clear();
        }

        public WorldInteractionPoint Find(string id)
        {
            if (string.IsNullOrEmpty(id)) return null;
            foreach (WorldInteractionPoint point in Points)
                if (string.Equals(point.Id, id, StringComparison.OrdinalIgnoreCase)) return point;
            return null;
        }

        public void SetPrompt(string id, string prompt)
        {
            WorldInteractionPoint point = Find(id);
            if (point != null) point.Prompt = prompt;
        }

        public void SetPointEnabled(string id, bool enabled)
        {
            WorldInteractionPoint point = Find(id);
            if (point == null) return;
            point.Enabled = enabled;
            if (point.MarkerObject != null) point.MarkerObject.SetActive(enabled);
        }

        // ------------------------------------------------------------------
        //  Запуск взаимодействия
        // ------------------------------------------------------------------

        /// <summary>Вызывает событие для точки по id (для UI и игровых систем).</summary>
        public bool TryInteract(string id)
        {
            WorldInteractionPoint point = Find(id);
            if (point == null || !point.Enabled) return false;

            LastDistance = PlanarDistance(ObserverPosition(), point.Position);
            LastAimWasOnHandle = point.IsHandle;
            FocusedPoint = point;
            Interacted?.Invoke(id);
            return true;
        }

        /// <summary>Взаимодействие с точкой под прицелом.</summary>
        public bool TryInteractFocused()
        {
            return FocusedPoint != null && TryInteract(FocusedPoint.Id);
        }

        private void Update()
        {
            if (Points.Count == 0) return;

            Camera camera = InteractionCamera != null ? InteractionCamera : Camera.main;
            EvaluateFocus(camera);
            UpdateZones();
            UpdateLadder();
            RefreshPrompts();

            if (ReadKeyboardInput && ReadInteractPressed()) TryInteractFocused();
        }

        private void EvaluateFocus(Camera camera)
        {
            FocusedPoint = null;
            LastAimWasOnHandle = false;
            LastDistance = float.MaxValue;
            if (camera == null) return;

            Vector3 origin = camera.transform.position;
            Vector3 forward = camera.transform.forward;
            float bestScore = float.MaxValue;
            float bestDistance = float.MaxValue;

            // Сначала — реальный рэйкаст по маркерам коллайдеров (QueryTriggerInteraction.Collide).
            RaycastHit[] hits = Physics.RaycastAll(new Ray(origin, forward), Mathf.Max(0.1f, RaycastDistance),
                ~0, QueryTriggerInteraction.Collide);
            bool[] hitByRay = new bool[Points.Count];
            foreach (RaycastHit hit in hits)
            {
                WorldInteractionMarker marker = hit.collider.GetComponent<WorldInteractionMarker>();
                if (marker == null) marker = hit.collider.GetComponentInParent<WorldInteractionMarker>();
                if (marker == null || marker.Point == null || !marker.Point.Enabled) continue;
                int index = Points.IndexOf(marker.Point);
                if (index >= 0) hitByRay[index] = true;
            }

            // Угловая проверка дублирует рэйкаст для точек без активного коллайдера
            // (например, если queriesHitTriggers отключён в проекте).
            for (int i = 0; i < Points.Count; i++)
            {
                WorldInteractionPoint point = Points[i];
                if (!point.Enabled) continue;
                Vector3 delta = point.Position - origin;
                float distance = PlanarDistance(origin, point.Position);
                if (distance > point.Reach) continue;

                float angle = Vector3.Angle(forward, delta.normalized);
                float limit = point.IsHandle ? HandleAimAngleDegrees : AimAngleDegrees;
                if (angle > limit) continue;

                float score = angle + distance * 0.45f - (hitByRay[i] ? 4f : 0f);
                if (score >= bestScore) continue;
                bestScore = score;
                bestDistance = distance;
                FocusedPoint = point;
            }

            if (FocusedPoint != null)
            {
                LastDistance = bestDistance;
                LastAimWasOnHandle = FocusedPoint.IsHandle;
            }
        }

        private Vector3 ObserverPosition()
        {
            if (Player != null) return Player.position;
            if (InteractionCamera != null) return InteractionCamera.transform.position;
            Camera main = Camera.main;
            return main != null ? main.transform.position : transform.position;
        }

        private static float PlanarDistance(Vector3 a, Vector3 b)
        {
            a.y = 0f;
            b.y = 0f;
            return Vector3.Distance(a, b);
        }

        private static bool ReadInteractPressed()
        {
            try { return Input.GetKeyDown(KeyCode.E) || Input.GetKeyDown(KeyCode.JoystickButton0); }
            catch { return false; }
        }

        private void RefreshPrompts()
        {
            WorldInteractionPoint kioskHatch = Find("kiosk_hatch");
            if (kioskHatch != null)
            {
                float x = builder != null && builder.KioskHatch != null
                    ? Mathf.Abs(Mathf.DeltaAngle(0f, builder.KioskHatch.localRotation.eulerAngles.x)) : 0f;
                kioskHatch.Prompt = x > 12f ? "Опустить люк прилавка" : "Поднять люк прилавка";
            }

            WorldInteractionPoint roofHatch = Find("roof_hatch");
            if (roofHatch != null)
            {
                float x = builder != null && builder.RoofHatchPivot != null
                    ? Mathf.Abs(Mathf.DeltaAngle(0f, builder.RoofHatchPivot.localRotation.eulerAngles.x)) : 0f;
                roofHatch.Prompt = x > 12f ? "Закрыть люк крыши" : "Открыть люк крыши";
            }

            WorldInteractionPoint apartment = Find("apartment_door_handle");
            if (apartment != null)
            {
                bool open = builder != null && builder.ApartmentState != null && builder.ApartmentState.IsOpen;
                apartment.Prompt = open ? "Закрыть дверь квартиры" : "Открыть дверь квартиры";
            }

            WorldInteractionPoint entrance = Find("entrance_door_handle");
            if (entrance != null)
            {
                bool open = builder != null && builder.EntranceState != null && builder.EntranceState.IsOpen;
                entrance.Prompt = open ? "Закрыть дверь подъезда" : "Открыть дверь подъезда";
            }
        }

        // ------------------------------------------------------------------
        //  Лестница на крышу: M33
        // ------------------------------------------------------------------

        public void SetOnLadder(bool value, bool fromRoof = false)
        {
            OnLadder = value;
            if (value)
            {
                LadderProgress = fromRoof ? 1f : 0f;
                roofReachedNotified = fromRoof;
            }
            else
            {
                roofReachedNotified = false;
            }
        }

        /// <summary>Сдвиг по лестнице в нормализованных единицах (0 — низ, 1 — крыша).</summary>
        public void Climb(float normalizedDelta)
        {
            if (!OnLadder || float.IsNaN(normalizedDelta)) return;
            LadderProgress = Mathf.Clamp01(LadderProgress + normalizedDelta);
            if (LadderProgress >= 1f && !roofReachedNotified)
            {
                roofReachedNotified = true;
                Interacted?.Invoke("ladder_reached_roof");
            }
            else if (LadderProgress < 0.999f)
            {
                roofReachedNotified = false;
            }
        }

        public void ClimbUp(float seconds) => Climb(Mathf.Max(0f, seconds) * LadderClimbSpeed);
        public void ClimbDown(float seconds) => Climb(-Mathf.Max(0f, seconds) * LadderClimbSpeed);

        private void UpdateLadder()
        {
            if (!OnLadder) return;
            float axis = ReadLadderAxis();
            if (Mathf.Abs(axis) > 0.01f) Climb(axis * LadderClimbSpeed * Time.deltaTime);
        }

        private float ReadLadderAxis()
        {
            try
            {
                float axis = Input.GetAxisRaw(LadderAxis);
                if (Mathf.Abs(axis) > 0.01f) return axis;
            }
            catch { /* активен только новый Input System — используем клавиши ниже */ }

            try
            {
                bool up = Input.GetKey(KeyCode.UpArrow) || Input.GetKey(KeyCode.W);
                bool down = Input.GetKey(KeyCode.DownArrow) || Input.GetKey(KeyCode.S);
                return (up ? 1f : 0f) - (down ? 1f : 0f);
            }
            catch { return 0f; }
        }

        // ------------------------------------------------------------------
        //  Зоны игрока и ключ квартиры
        // ------------------------------------------------------------------

        private void UpdateZones()
        {
            Transform observer = Player;
            if (observer == null) observer = InteractionCamera != null ? InteractionCamera.transform : null;
            if (observer == null && Camera.main != null) observer = Camera.main.transform;

            if (AutoDetectPlayerZones && observer != null)
            {
                Vector3 p = observer.position;
                PlayerIsInsideApartment = p.x > 38f && p.x < 51f && p.z > 72f && p.z < 84f &&
                                          p.y > WorldAnchors.ApartmentFloorY - 0.5f &&
                                          p.y < WorldAnchors.ApartmentFloorY + 4f;
            }

            if (!DetectKeyFromSession) return;
            keyPollTimer -= Time.deltaTime;
            if (keyPollTimer > 0f) return;
            keyPollTimer = KeyPollSeconds;

            bool found;
            bool hasKey = ReadKeyFromSession(out found);
            if (found) PlayerHoldsApartmentKey = hasKey;
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
                PropertyInfo property = type.GetProperty("Current", MemberFlags);
                if (property == null) continue;
                try { return property.GetValue(null, null); }
                catch { return null; }
            }
            return null;
        }

        private static object ReadPath(object root, params string[] names)
        {
            object current = root;
            foreach (string name in names)
            {
                if (current == null) return null;
                Type type = current.GetType();
                PropertyInfo property = type.GetProperty(name, MemberFlags);
                if (property != null && property.CanRead)
                {
                    try { current = property.GetValue(current, null); continue; }
                    catch { return null; }
                }
                FieldInfo field = type.GetField(name, MemberFlags);
                if (field != null)
                {
                    try { current = field.GetValue(current); continue; }
                    catch { return null; }
                }
                return null;
            }
            return current;
        }

        private static bool ReadKeyFromSession(out bool found)
        {
            found = false;
            object inventory = ReadPath(CurrentSession(), "Inventory");
            if (inventory == null) return false;

            object flag = ReadPath(inventory, "ApartmentKey") ?? ReadPath(inventory, "HasApartmentKey") ??
                          ReadPath(inventory, "KeyInHand");
            if (flag is bool b)
            {
                found = true;
                return b;
            }

            string[] keyNames = { "ключ от квартиры", "apartment_key", "apartment key", "ключ", "квартира" };
            string[] methods = { "HasItem", "Contains", "Has" };
            foreach (string methodName in methods)
                foreach (string key in keyNames)
                {
                    bool value;
                    if (TryBoolMethod(inventory, methodName, key, out value))
                    {
                        found = true;
                        return value;
                    }
                }

            object items = ReadPath(inventory, "Items") ?? ReadPath(inventory, "Slots");
            IEnumerable enumerable = items as IEnumerable;
            if (enumerable == null) return false;
            foreach (object item in enumerable)
            {
                string text = item != null ? item.ToString() : string.Empty;
                if (text.IndexOf("ключ", StringComparison.OrdinalIgnoreCase) >= 0 ||
                    text.IndexOf("apartment", StringComparison.OrdinalIgnoreCase) >= 0 ||
                    text.IndexOf("квартир", StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    found = true;
                    return true;
                }
            }
            return false;
        }

        private static bool TryBoolMethod(object target, string methodName, string argument, out bool value)
        {
            value = false;
            if (target == null) return false;
            foreach (MethodInfo method in target.GetType().GetMethods(MemberFlags))
            {
                if (method.Name != methodName || method.IsGenericMethodDefinition) continue;
                ParameterInfo[] parameters = method.GetParameters();
                if (parameters.Length != 1 || parameters[0].ParameterType != typeof(string)) continue;
                try
                {
                    object result = method.Invoke(target, new object[] { argument });
                    if (result is bool b)
                    {
                        value = b;
                        return true;
                    }
                }
                catch { /* другая перегрузка */ }
            }
            return false;
        }
    }
}
