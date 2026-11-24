using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace Larek.UI
{
    public sealed class HudController : MonoBehaviour
    {
        private sealed class ToastEntry
        {
            public RectTransform Rect;
            public Text Text;
            public float Until;
        }

        private static HudController instance;

        private RectTransform root;
        private RectTransform cross;
        private Image crossImage;
        private RectTransform hintRoot;
        private Text hintText;
        private RectTransform toastHost;
        private RectTransform subRoot;
        private Text subText;
        private Text fpsText;
        private Text diagText;
        private RectTransform topButtons;
        private GameObject inventoryButtonObject;
        private RectTransform wheelRoot;
        private Text wheelTitle;
        private Text wheelDescription;
        private readonly List<ToastEntry> toasts = new List<ToastEntry>();
        private readonly List<float> frameTimes = new List<float>();
        private readonly Dictionary<string, float> seenNotifications = new Dictionary<string, float>();
        private List<Delegate> notificationTokens = new List<Delegate>();
        private List<Delegate> interactionTokens = new List<Delegate>();
        private object subscribedNotifications;
        private float hintUntil;
        private float subtitleUntil;
        private float fpsAccum;
        private int fpsFrames;
        private float pollTimer;

        public static HudController Ensure(Transform parent)
        {
            if (instance != null) return instance;
            instance = FindObjectOfType<HudController>();
            if (instance != null) return instance;
            GameObject go = new GameObject("HUD", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            instance = go.AddComponent<HudController>();
            instance.Build();
            return instance;
        }

        private void Awake()
        {
            if (instance == null) instance = this;
        }

        private void Start()
        {
            interactionTokens = UiApi.SubscribeInteractions(OnInteraction);
            Resubscribe();
        }

        private void Build()
        {
            root = UiFactory.Full("Слой HUD", transform);

            cross = UiFactory.NewRect("Прицел", root, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(4f, 4f));
            crossImage = UiFactory.AddImage(cross, new Color(1f, 1f, 1f, 0.75f), false);

            hintRoot = UiFactory.NewRect("Подсказка", root, new Vector2(0.1f, 0.76f), new Vector2(0.9f, 0.76f), Vector2.zero, new Vector2(0f, 48f));
            hintText = UiFactory.AddText(hintRoot, string.Empty, 14, Color.white, TextAnchor.MiddleCenter, FontStyle.Normal);
            hintText.horizontalOverflow = HorizontalWrapMode.Wrap;

            toastHost = UiFactory.NewRect("Уведомления", root, new Vector2(0.5f, 0.75f), new Vector2(0.5f, 0.75f), Vector2.zero, new Vector2(540f, 170f));
            toastHost.pivot = new Vector2(0.5f, 1f);
            VerticalLayoutGroup toastLayout = toastHost.gameObject.AddComponent<VerticalLayoutGroup>();
            toastLayout.spacing = 5f;
            toastLayout.childAlignment = TextAnchor.UpperCenter;
            toastLayout.childControlWidth = true;
            toastLayout.childForceExpandWidth = true;
            toastLayout.childControlHeight = false;
            toastLayout.childForceExpandHeight = false;

            subRoot = UiFactory.NewRect("Субтитры", root, new Vector2(0.1f, 0.17f), new Vector2(0.9f, 0.17f), Vector2.zero, new Vector2(0f, 72f));
            subText = UiFactory.AddText(subRoot, string.Empty, 18, new Color32(244, 241, 232, 255), TextAnchor.LowerCenter);
            subText.horizontalOverflow = HorizontalWrapMode.Wrap;

            RectTransform fpsBadge = UiFactory.NewRect("FPS", root, new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(66f, -20f), new Vector2(100f, 26f));
            UiFactory.AddImage(fpsBadge, new Color32(10, 12, 14, 200), false);
            fpsText = UiFactory.AddText(fpsBadge, "60 FPS", 13, new Color32(110, 232, 94, 255), TextAnchor.MiddleCenter, FontStyle.Bold);

            RectTransform diag = UiFactory.NewRect("Диагностика", root, new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(210f, -62f), new Vector2(420f, 132f));
            diag.pivot = new Vector2(0f, 1f);
            UiFactory.AddImage(diag, new Color32(8, 12, 14, 210), false);
            diagText = UiFactory.AddText(diag, string.Empty, 11, new Color32(217, 226, 220, 255), TextAnchor.UpperLeft);
            diag.gameObject.SetActive(false);

            topButtons = UiFactory.NewRect("Верхние кнопки", root, new Vector2(1f, 1f), new Vector2(1f, 1f), new Vector2(-10f, -20f), new Vector2(560f, 38f));
            topButtons.pivot = new Vector2(1f, 0.5f);
            HorizontalLayoutGroup topLayout = topButtons.gameObject.AddComponent<HorizontalLayoutGroup>();
            topLayout.spacing = 6f;
            topLayout.childAlignment = TextAnchor.MiddleRight;
            topLayout.childControlWidth = true;
            topLayout.childForceExpandWidth = false;
            inventoryButtonObject = AddTopButton("Инв.", 58f, () => ToggleWheel());
            AddTopButton("Телефон", 94f, () => UiApi.TogglePhone());
            AddTopButton("Ружьё", 78f, () => UiApi.ToggleWeapon());
            AddTopButton("Блокнот", 94f, () => NotepadController.ShowGlobal());
            AddTopButton("Меню", 76f, () => SheetController.OpenSettingsGlobal());
            topButtons.gameObject.SetActive(false);

            BuildWheel();
        }

        private GameObject AddTopButton(string caption, float width, Action action)
        {
            Button button = UiFactory.Button(topButtons, caption, Vector2.zero, new Vector2(width, 34f), action,
                new Color32(14, 18, 19, 225), 12);
            LayoutElement element = button.gameObject.AddComponent<LayoutElement>();
            element.preferredWidth = width;
            element.preferredHeight = 34f;
            return button.gameObject;
        }

        private void BuildWheel()
        {
            wheelRoot = UiFactory.Full("Колесо предметов", root);
            Button backdrop = UiFactory.AddButton(UiFactory.Full("Затемнение", wheelRoot), new Color(0.02f, 0.02f, 0.02f, 0.72f), () => SetWheel(false), Color.clear);
            backdrop.transition = Selectable.Transition.None;

            RectTransform banner = UiFactory.NewRect("Заголовок колеса", wheelRoot, new Vector2(0.5f, 0.86f), new Vector2(0.5f, 0.86f), Vector2.zero, new Vector2(560f, 34f));
            UiFactory.AddText(banner, "ИНВЕНТАРЬ · ВЫБЕРИТЕ ПРЕДМЕТ", 13, UiFactory.Text, TextAnchor.MiddleCenter, FontStyle.Bold);

            RectTransform box = UiFactory.NewRect("Колесо", wheelRoot, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(330f, 330f));
            Image ring = UiFactory.AddImage(box, new Color(0.05f, 0.05f, 0.05f, 0.55f), false);
            ring.sprite = null;

            // Inventory.Items — список InventoryEntry { Id, Count }.
            List<object> items = UiReflection.Enumerate(UiReflection.GetMember(UiApi.Inventory, "Items", "Slots", "All"));
            for (int i = 0; i < 10; i++)
            {
                float angle = (-90f + i * 36f) * Mathf.Deg2Rad;
                Vector2 position = new Vector2(Mathf.Cos(angle) * 124f, Mathf.Sin(angle) * 124f);
                object entry = i < items.Count ? items[i] : null;
                string id = entry == null ? null : UiApi.ExtractText(UiReflection.GetMember(entry, "Id", "id"));
                int count = entry == null ? 0 : UiReflection.AsInt(UiReflection.GetMember(entry, "Count", "count"));
                string label = string.IsNullOrEmpty(id) ? "—" : id + " ×" + count;
                int index = i;
                Button slot = UiFactory.Button(box, label, position, new Vector2(62f, 46f), () =>
                {
                    wheelTitle.text = label;
                    if (string.IsNullOrEmpty(id))
                    {
                        wheelDescription.text = "Пустой слот.";
                        return;
                    }
                    wheelDescription.text = "Слот " + (index + 1) + ": " + id + " (" + count + " шт.). Взято в руку.";
                    // Реальный контракт инвентаря: Equip(id), Count(id), Add/Remove.
                    UiReflection.Invoke(UiApi.Inventory, new[] { "Equip", "TryEquip" }, id);
                }, new Color32(14, 18, 19, 235), 12);
                slot.transition = Selectable.Transition.ColorTint;
            }

            RectTransform hub = UiFactory.NewRect("Центр", box, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(150f, 140f));
            UiFactory.AddImage(hub, new Color(0.04f, 0.04f, 0.04f, 0.88f), true);
            wheelTitle = UiFactory.AddText(UiFactory.NewRect("Название", hub, new Vector2(0.5f, 0.8f), new Vector2(0.5f, 0.8f), Vector2.zero, new Vector2(140f, 48f)),
                "ИНВЕНТАРЬ", 13, UiFactory.Text, TextAnchor.MiddleCenter, FontStyle.Bold);
            UiFactory.AddImage(UiFactory.NewRect("Красная линия", hub, new Vector2(0.5f, 0.55f), new Vector2(0.5f, 0.55f), Vector2.zero, new Vector2(100f, 2f)), UiFactory.Red, false);
            wheelDescription = UiFactory.AddText(UiFactory.NewRect("Описание", hub, new Vector2(0.5f, 0.35f), new Vector2(0.5f, 0.35f), Vector2.zero, new Vector2(140f, 52f)),
                "Колесо предметов якобы RDR2-стиля. Клик вне круга закрывает.", 11, UiFactory.Muted, TextAnchor.MiddleCenter);
            UiFactory.AddText(UiFactory.NewRect("Подсказка", hub, new Vector2(0.5f, 0.1f), new Vector2(0.5f, 0.1f), Vector2.zero, new Vector2(140f, 22f)),
                "ВЫБРАТЬ · ЗАКРЫТЬ", 9, UiFactory.Muted, TextAnchor.MiddleCenter);

            wheelRoot.gameObject.SetActive(false);
        }

        private void Update()
        {
            float dt = Time.unscaledDeltaTime;
            fpsAccum += dt;
            fpsFrames++;
            frameTimes.Add(Mathf.Max(0.5f, dt * 1000f));
            if (frameTimes.Count > 120) frameTimes.RemoveAt(0);
            if (fpsAccum >= 0.25f)
            {
                int fps = Mathf.Clamp(Mathf.RoundToInt(fpsFrames / fpsAccum), 1, 240);
                fpsAccum = 0f;
                fpsFrames = 0;
                fpsText.text = fps + " FPS";
                fpsText.color = fps >= 50 ? new Color32(110, 232, 94, 255) : fps >= 30 ? new Color32(242, 201, 76, 255) : new Color32(255, 82, 66, 255);
                RefreshDiagnostics(fps);
            }

            for (int i = toasts.Count - 1; i >= 0; i--)
            {
                if (Time.unscaledTime < toasts[i].Until) continue;
                Destroy(toasts[i].Rect.gameObject);
                toasts.RemoveAt(i);
            }

            if (Time.unscaledTime > hintUntil && hintText.text.Length > 0) hintText.text = string.Empty;
            if (Time.unscaledTime > subtitleUntil && subText.text.Length > 0) subText.text = string.Empty;

            bool inGame = UiApi.Session != null;
            topButtons.gameObject.SetActive(inGame);
            cross.gameObject.SetActive(inGame);
            crossImage.color = UiApi.Aiming ? new Color(1f, 1f, 1f, 0.95f) : new Color(1f, 1f, 1f, 0.75f);
            cross.sizeDelta = UiApi.Aiming ? new Vector2(2f, 2f) : new Vector2(4f, 4f);

            // M07: пока играет гитара, кнопка инвентаря скрыта.
            if (inventoryButtonObject != null) inventoryButtonObject.SetActive(!UiApi.PlayingGuitar);
            if (!inGame && wheelRoot.gameObject.activeSelf) SetWheel(false);

            Resubscribe();
            pollTimer -= dt;
            if (pollTimer <= 0f)
            {
                pollTimer = 0.35f;
                PollActiveNotifications();
            }
        }

        private void RefreshDiagnostics(int fps)
        {
            bool show = UiApi.Session != null && UiSettings.Instance.ShowDiag != 0;
            diagText.transform.parent.gameObject.SetActive(show);
            fpsText.transform.parent.gameObject.SetActive(UiApi.Session != null && UiSettings.Instance.ShowFps != 0);
            if (!show) return;

            float total = 0f;
            for (int i = 0; i < frameTimes.Count; i++) total += frameTimes[i];
            float average = frameTimes.Count > 0 ? total / frameTimes.Count : 16.7f;
            var sorted = new List<float>(frameTimes);
            sorted.Sort();
            float p99 = sorted.Count > 0 ? sorted[Mathf.Min(sorted.Count - 1, Mathf.FloorToInt(sorted.Count * 0.99f))] : average;
            QualityPreset preset = UiSettings.GetPreset(UiSettings.Instance.Quality);

            diagText.text =
                "FPS: " + fps + " | Средн.: " + (1000f / Mathf.Max(0.5f, average)).ToString("0.0") +
                " | 1% low: " + (1000f / Mathf.Max(0.5f, p99)).ToString("0.0") + " | " + average.ToString("0.0") + " мс\n" +
                "Пресет: " + preset.Label + " | Тени: " + UiSettings.Instance.Shadows + " | Дальность: " + UiSettings.Instance.Draw + " м\n" +
                "Разрешение: " + Screen.width + "x" + Screen.height + " | Ограничение: " + UiSettings.Instance.FpsCap + " FPS\n" +
                "Устройство: " + SystemInfo.deviceModel + "\n" +
                "Видеокарта: " + SystemInfo.graphicsDeviceName;
        }

        private void Resubscribe()
        {
            object current = UiApi.Notifications;
            if (ReferenceEquals(current, subscribedNotifications)) return;
            if (notificationTokens.Count > 0) UiApi.UnsubscribeNotifications(notificationTokens);
            notificationTokens = UiApi.SubscribeNotifications(OnNotificationEvent);
            subscribedNotifications = current;
        }

        private void OnNotificationEvent(object[] args)
        {
            if (args == null || args.Length == 0) return;
            string text = UiApi.ExtractText(args[0]);
            if (!string.IsNullOrEmpty(text)) ShowToast(text, 0);
        }

        private void PollActiveNotifications()
        {
            object active = UiReflection.GetMember(UiApi.Notifications, "Active");
            List<object> items = active is string ? new List<object> { active } : UiReflection.Enumerate(active);
            if (items.Count == 0) return;
            int limit = Mathf.Min(3, items.Count);
            for (int i = items.Count - limit; i < items.Count; i++)
            {
                string text = UiApi.ExtractText(items[i]);
                if (string.IsNullOrEmpty(text)) continue;
                float now = Time.unscaledTime;
                if (seenNotifications.TryGetValue(text, out float last) && now - last < 4f) continue;
                seenNotifications[text] = now;
                ShowToast(text, 0);
            }
        }

        private void OnInteraction(object[] args)
        {
            if (args == null || args.Length == 0) return;
            string text = UiApi.ExtractText(args[0]);
            if (!string.IsNullOrEmpty(text)) ShowHint(text, 4f);
        }

        public void ShowToast(string message, int kind)
        {
            if (string.IsNullOrEmpty(message)) return;
            if (UiSettings.Instance.Toasts == 0) return;
            if (UiSettings.Instance.Toasts == 1 && kind == 0) return;

            float now = Time.unscaledTime;
            if (toasts.Count > 0 && toasts[toasts.Count - 1].Text.text == message && now < toasts[toasts.Count - 1].Until - 1.4f) return;

            RectTransform entry = UiFactory.NewRect("Уведомление", toastHost, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), Vector2.zero, new Vector2(520f, 36f));
            entry.pivot = new Vector2(0.5f, 1f);
            LayoutElement layout = entry.gameObject.AddComponent<LayoutElement>();
            layout.preferredHeight = 36f;
            Color border = kind == 1 ? UiFactory.Green : kind == 2 ? UiFactory.Red : UiFactory.Accent;
            UiFactory.AddImage(entry, UiFactory.Panel, false);
            Outline outline = entry.gameObject.AddComponent<Outline>();
            outline.effectColor = border;
            outline.effectDistance = new Vector2(2f, -2f);
            Text label = UiFactory.AddText(entry, message, 13, Color.white, TextAnchor.MiddleCenter, FontStyle.Bold);
            label.horizontalOverflow = HorizontalWrapMode.Wrap;
            toasts.Add(new ToastEntry { Rect = entry, Text = label, Until = now + 2.2f });
            while (toasts.Count > 3)
            {
                Destroy(toasts[0].Rect.gameObject);
                toasts.RemoveAt(0);
            }
        }

        public void ShowHint(string text, float duration)
        {
            hintText.text = text ?? string.Empty;
            hintUntil = Time.unscaledTime + Mathf.Max(0.1f, duration);
        }

        public void ShowSubtitle(string speaker, string text, float duration)
        {
            subText.text = string.IsNullOrEmpty(speaker) ? text : "<b>" + speaker + "</b> «" + text + "»";
            subtitleUntil = Time.unscaledTime + Mathf.Max(0.1f, duration);
        }

        public void SetWheel(bool open)
        {
            wheelRoot.gameObject.SetActive(open && UiApi.Session != null);
        }

        public void ToggleWheel()
        {
            SetWheel(!wheelRoot.gameObject.activeSelf);
        }

        private void OnDestroy()
        {
            if (notificationTokens.Count > 0) UiApi.UnsubscribeNotifications(notificationTokens);
            if (interactionTokens.Count > 0) UiApi.UnsubscribeInteractions(interactionTokens);
            if (instance == this) instance = null;
        }

        public static void ShowToastGlobal(string message, int kind = 0)
        {
            if (instance != null) instance.ShowToast(message, kind);
        }

        public static void ShowHintGlobal(string text, float duration = 3f)
        {
            if (instance != null) instance.ShowHint(text, duration);
        }

        public static void ShowSubtitleGlobal(string speaker, string text, float duration = 3f)
        {
            if (instance != null) instance.ShowSubtitle(speaker, text, duration);
        }

        public static void ToggleWheelGlobal()
        {
            if (instance != null) instance.ToggleWheel();
        }
    }
}
