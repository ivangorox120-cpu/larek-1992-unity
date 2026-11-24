using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Larek.UI
{
    /// <summary>
    /// Экранное управление: джойстик слева, зона обзора справа и кнопки действий.
    /// Связь с игровыми системами идёт через рефлексию, поэтому UI собирается даже
    /// без подключённого Prototype/Systems. M07/M08 обрабатываются здесь же.
    /// </summary>
    public sealed class TouchControls : MonoBehaviour, IBeginDragHandler, IDragHandler, IEndDragHandler
    {
        private const string GuitarHint = "↕ Свайп справа — бой и обзор · Джойстик слева — идти · 🤚 Приглушить";

        private static TouchControls instance;

        private RectTransform root;
        private RectTransform stickBase;
        private RectTransform stickKnob;
        private RectTransform lookArea;
        private GameObject inventoryButtonObject;
        private readonly List<GameObject> actionObjects = new List<GameObject>();
        private object movement;
        private Vector2 moveInput;
        private Vector2 previousLook;
        private int lookFinger = -1;
        private bool wasPlayingGuitar;
        private float refreshTimer;

        public static TouchControls Ensure(Transform parent)
        {
            if (instance != null) return instance;
            instance = FindObjectOfType<TouchControls>();
            if (instance != null) return instance;
            GameObject go = new GameObject("Экранное управление", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            instance = go.AddComponent<TouchControls>();
            instance.Build();
            return instance;
        }

        private void Awake()
        {
            if (instance == null) instance = this;
        }

        private void Build()
        {
            root = UiFactory.Full("Слой управления", transform);

            lookArea = UiFactory.NewRect("Зона обзора", root, new Vector2(0.42f, 0f), new Vector2(1f, 1f), Vector2.zero, Vector2.zero);
            UiFactory.AddImage(lookArea, new Color(1f, 1f, 1f, 0.004f), true);
            UiFactory.AddText(UiFactory.NewRect("Подсказка обзора", lookArea, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f),
                new Vector2(0f, 16f), new Vector2(360f, 24f)), "свайп — обзор", 11,
                new Color(1f, 1f, 1f, 0.25f), TextAnchor.MiddleCenter);

            RectTransform stick = UiFactory.NewRect("Джойстик", root, new Vector2(0f, 0f), new Vector2(0f, 0f),
                new Vector2(118f, 122f), new Vector2(150f, 150f));
            stick.pivot = new Vector2(0f, 0f);
            stickBase = UiFactory.Full("Основа", stick);
            UiFactory.AddImage(stickBase, new Color(0.06f, 0.08f, 0.09f, 0.55f), true);
            Outline rim = stickBase.gameObject.AddComponent<Outline>();
            rim.effectColor = new Color(0.9f, 0.75f, 0.35f, 0.55f);
            rim.effectDistance = new Vector2(2f, -2f);
            stickKnob = UiFactory.NewRect("Ручка", stick, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f),
                Vector2.zero, new Vector2(58f, 58f));
            UiFactory.AddImage(stickKnob, new Color(0.9f, 0.75f, 0.35f, 0.72f), false);
            EventTrigger trigger = stick.gameObject.AddComponent<EventTrigger>();
            AddTrigger(trigger, EventTriggerType.PointerDown, _ => ResetDrag());
            // Реальные dragged-события приходят через интерфейсы на этом же компоненте.
            stick.gameObject.AddComponent<StickProxy>().Owner = this;

            RectTransform actions = UiFactory.NewRect("Кнопки действий", root, new Vector2(1f, 0f), new Vector2(1f, 0f),
                new Vector2(-16f, 20f), new Vector2(360f, 430f));
            actions.pivot = new Vector2(1f, 0f);
            GridLayoutGroup grid = actions.gameObject.AddComponent<GridLayoutGroup>();
            grid.cellSize = new Vector2(108f, 52f);
            grid.spacing = new Vector2(8f, 8f);
            grid.constraint = GridLayoutGroup.Constraint.FixedColumnCount;
            grid.constraintCount = 3;
            grid.childAlignment = TextAnchor.LowerRight;

            actionObjects.Add(AddAction(actions, "Взаимодействовать", Interact));
            actionObjects.Add(AddAction(actions, "Атака", Attack));
            actionObjects.Add(AddAction(actions, "🤚 Приглушить", Muffle));
            inventoryButtonObject = AddAction(actions, "Инвентарь", () => HudController.ToggleWheelGlobal());
            actionObjects.Add(inventoryButtonObject);
            actionObjects.Add(AddAction(actions, "Блокнот", () => NotepadController.ToggleGlobal()));
            actionObjects.Add(AddAction(actions, "Торговля", () => TradePanelController.ToggleGlobal()));
            actionObjects.Add(AddAction(actions, "Присесть", () => UiApi.ToggleCrouching()));
            actionObjects.Add(AddAction(actions, "Гитара", () => UiApi.ToggleGuitar()));
            actionObjects.Add(AddAction(actions, "Телефон", () => UiApi.TogglePhone()));
            actionObjects.Add(AddAction(actions, "Ружьё", () => UiApi.ToggleWeapon()));
            actionObjects.Add(AddAction(actions, "Свет", () => UiApi.ToggleFlashlight()));
            actionObjects.Add(AddAction(actions, "Меню", () => SheetController.OpenSettingsGlobal()));

            RectTransform settings = UiFactory.NewRect("Редактор раскладки", root, new Vector2(0f, 1f), new Vector2(0f, 1f),
                new Vector2(16f, -16f), new Vector2(150f, 34f));
            UiFactory.Button(settings, "Раскладка", Vector2.zero, new Vector2(146f, 32f), ShowLayoutHint,
                new Color32(14, 18, 19, 210), 11);

            root.gameObject.SetActive(false);
        }

        private sealed class StickProxy : MonoBehaviour, IDragHandler, IBeginDragHandler, IEndDragHandler
        {
            public TouchControls Owner;

            public void OnBeginDrag(PointerEventData eventData)
            {
                if (Owner != null) Owner.BeginStick(eventData);
            }

            public void OnDrag(PointerEventData eventData)
            {
                if (Owner != null) Owner.DragStick(eventData);
            }

            public void OnEndDrag(PointerEventData eventData)
            {
                if (Owner != null) Owner.EndStick(eventData);
            }
        }

        private static void AddTrigger(EventTrigger trigger, EventTriggerType type, Action<BaseEventData> action)
        {
            var entry = new EventTrigger.Entry { eventID = type };
            entry.callback.AddListener(data => action(data));
            trigger.triggers.Add(entry);
        }

        private static GameObject AddAction(Transform parent, string caption, Action action)
        {
            Button button = UiFactory.Button(parent, caption, Vector2.zero, new Vector2(108f, 52f), action,
                new Color32(14, 18, 19, 218), caption.Length > 12 ? 10 : 12);
            LayoutElement element = button.gameObject.AddComponent<LayoutElement>();
            element.preferredWidth = 108f;
            element.preferredHeight = 52f;
            return button.gameObject;
        }

        public void OnBeginDrag(PointerEventData eventData)
        {
            if (eventData == null || lookArea == null) return;
            lookFinger = eventData.pointerId;
            previousLook = eventData.position;
        }

        public void OnDrag(PointerEventData eventData)
        {
            if (eventData == null || eventData.pointerId != lookFinger) return;
            Vector2 delta = eventData.position - previousLook;
            previousLook = eventData.position;
            ApplyLook(delta);
        }

        public void OnEndDrag(PointerEventData eventData)
        {
            if (eventData == null || eventData.pointerId != lookFinger) return;
            lookFinger = -1;
        }

        private void BeginStick(PointerEventData data)
        {
            DragStick(data);
        }

        private void DragStick(PointerEventData data)
        {
            if (data == null || stickBase == null) return;
            if (RectTransformUtility.ScreenPointToLocalPointInRectangle(stickBase, data.position, data.pressEventCamera, out Vector2 local))
            {
                float radius = stickBase.rect.width * 0.5f;
                moveInput = Vector2.ClampMagnitude(local / Mathf.Max(1f, radius), 1f);
                stickKnob.anchoredPosition = moveInput * radius * 0.55f;
                ApplyMove(moveInput);
            }
        }

        private void EndStick(PointerEventData data)
        {
            moveInput = Vector2.zero;
            stickKnob.anchoredPosition = Vector2.zero;
            ApplyMove(Vector2.zero);
        }

        private void ResetDrag()
        {
            moveInput = Vector2.zero;
            stickKnob.anchoredPosition = Vector2.zero;
        }

        private void ApplyMove(Vector2 value)
        {
            object player = FindMovement();
            if (player != null)
                UiReflection.SetMember(player, value, "MoveInput", "moveInput");
        }

        private void ApplyLook(Vector2 delta)
        {
            float sensitivity = UiSettings.Instance.LookSensitivity;
            float y = UiSettings.Instance.InvertY ? delta.y : -delta.y;
            object player = FindMovement();
            if (player == null) return;

            Transform view = UiReflection.GetMember(player, "View", "view") as Transform;
            if (view != null)
            {
                Vector3 angles = view.localEulerAngles;
                float pitch = angles.x > 180f ? angles.x - 360f : angles.x;
                pitch = Mathf.Clamp(pitch + y * 0.15f * sensitivity, -80f, 80f);
                view.localRotation = Quaternion.Euler(pitch, 0f, 0f);
            }
            UiReflection.Invoke(player, new[] { "Rotate", "AddLook", "Look" }, delta.x * 0.15f * sensitivity);
            Transform body = player as Transform;
            if (body == null) body = UiReflection.GetMember(player, "transform", "Transform") as Transform;
            if (body != null) body.Rotate(0f, delta.x * 0.15f * sensitivity, 0f);
        }

        private static object FindMovement()
        {
            Type type = UiReflection.FindType("Larek.Prototype.PrototypeMovement", "PrototypeMovement");
            if (type == null) return null;
            try { return FindObjectOfType(type); }
            catch (Exception) { return null; }
        }

        private void Interact()
        {
            object world = UiApi.FindSystem("Larek.World.WorldInteractions", "WorldInteractions");
            // WorldInteractions.TryInteractFocused() — реальный метод без аргументов.
            UiReflection.Invoke(world, new[] { "TryInteractFocused", "Interact", "TryInteract", "Use" });
            HudController.ShowHintGlobal("Осмотреться и взаимодействовать", 1.5f);
        }

        private void Attack()
        {
            UiReflection.Invoke(UiApi.Hand, new[] { "Attack", "Strike", "Punch", "Hit" });
            UiReflection.Invoke(UiApi.Weapon, new[] { "Fire", "Shoot", "Attack" });
        }

        private void Muffle()
        {
            UiReflection.Invoke(UiApi.Hand, new[] { "StopGuitar", "Muffle", "Dampen", "Unequip" });
        }

        private static void ShowLayoutHint()
        {
            ModalController.MessageBoxGlobal(
                "Редактор раскладки",
                "Кнопки экранного управления можно перетаскивать в LibreOffice-редакторе раскладки. " +
                "В этой сборке раскладка фиксированная: джойстик слева, обзор справа, действия — в правом нижнем углу.",
                "Понятно");
        }

        private void Update()
        {
            if (root == null) return;
            bool visible = UiApi.Session != null && !TitleScreenController.IsVisible && !DialogController.IsOpenGlobal;
            root.gameObject.SetActive(visible);
            if (!visible) return;

            refreshTimer -= Time.unscaledDeltaTime;
            if (refreshTimer <= 0f)
            {
                refreshTimer = 0.5f;
                movement = FindMovement();
            }

            // M07: инвентарь недоступен, пока играет гитара.
            if (inventoryButtonObject != null) inventoryButtonObject.SetActive(!UiApi.PlayingGuitar);

            // M08: подсказка на 3 секунды в момент начала игры на гитаре.
            bool playing = UiApi.PlayingGuitar;
            if (playing && !wasPlayingGuitar)
                HudController.ShowHintGlobal(GuitarHint, 3f);
            wasPlayingGuitar = playing;
        }

        private void OnDisable()
        {
            if (stickKnob != null) stickKnob.anchoredPosition = Vector2.zero;
            if (moveInput != Vector2.zero) ApplyMove(Vector2.zero);
            moveInput = Vector2.zero;
            lookFinger = -1;
        }

        private void OnDestroy()
        {
            if (instance == this) instance = null;
        }
    }
}
