using System;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Larek.UI
{
    // Общая фабрика UI-элементов. Никаких префабов и сцен: всё создаётся в рантайме.
    // WOFF2-шрифты (russoone-cyr.woff2 из StreamingAssets) Unity не поддерживает,
    // поэтому используется системный шрифт с кириллицей через CreateDynamicFontFromOSFont.
    internal static class UiFactory
    {
        private static Font cachedFont;
        private static bool fontResolved;

        public static readonly Color Text = new Color32(228, 225, 216, 255);
        public static readonly Color Muted = new Color32(142, 150, 145, 255);
        public static readonly Color Accent = new Color32(212, 167, 44, 255);
        public static readonly Color Red = new Color32(192, 57, 43, 255);
        public static readonly Color Green = new Color32(95, 143, 78, 255);
        public static readonly Color Blue = new Color32(77, 126, 168, 255);
        public static readonly Color Panel = new Color32(14, 18, 19, 232);
        public static readonly Color Panel2 = new Color32(24, 29, 30, 240);
        public static readonly Color Line = new Color32(58, 67, 68, 255);
        public static readonly Color Line2 = new Color32(86, 96, 98, 255);
        public static readonly Color Paper = new Color32(233, 233, 230, 255);
        public static readonly Color PaperInk = new Color32(29, 47, 122, 255);

        public static Font UiFont
        {
            get
            {
                if (fontResolved) return cachedFont;
                fontResolved = true;

                string[] cyrillic = { "Arial", "Liberation Sans", "DejaVu Sans", "Noto Sans", "Tahoma", "Microsoft Sans Serif" };
                try
                {
                    cachedFont = UnityEngine.Font.CreateDynamicFontFromOSFont(cyrillic, 18);
                }
                catch (Exception)
                {
                    cachedFont = null;
                }

                if (cachedFont == null)
                {
                    try { cachedFont = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf"); }
                    catch (Exception) { cachedFont = null; }
                }

                if (cachedFont == null)
                {
                    try { cachedFont = Resources.GetBuiltinResource<Font>("Arial.ttf"); }
                    catch (Exception) { cachedFont = null; }
                }

                return cachedFont;
            }
        }

        public static RectTransform NewRect(string name, Transform parent, Vector2 anchorMin, Vector2 anchorMax, Vector2 position, Vector2 size)
        {
            GameObject go = new GameObject(name, typeof(RectTransform));
            go.transform.SetParent(parent, false);
            RectTransform rt = (RectTransform)go.transform;
            rt.anchorMin = anchorMin;
            rt.anchorMax = anchorMax;
            rt.pivot = new Vector2(0.5f, 0.5f);
            rt.anchoredPosition = position;
            rt.sizeDelta = size;
            return rt;
        }

        public static RectTransform Full(string name, Transform parent)
        {
            return NewRect(name, parent, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);
        }

        public static void Stretch(RectTransform rt, float left, float right, float top, float bottom)
        {
            rt.anchorMin = Vector2.zero;
            rt.anchorMax = Vector2.one;
            rt.offsetMin = new Vector2(left, bottom);
            rt.offsetMax = new Vector2(-right, -top);
        }

        public static Image AddImage(RectTransform rt, Color color, bool raycast = false)
        {
            Image image = rt.gameObject.GetComponent<Image>();
            if (image == null) image = rt.gameObject.AddComponent<Image>();
            image.color = color;
            image.raycastTarget = raycast;
            return image;
        }

        public static Text AddText(RectTransform rt, string text, int size, Color color,
            TextAnchor anchor = TextAnchor.MiddleLeft, FontStyle style = FontStyle.Normal)
        {
            Text label = rt.gameObject.GetComponent<Text>();
            if (label == null) label = rt.gameObject.AddComponent<Text>();
            label.font = UiFont;
            label.text = text ?? string.Empty;
            label.fontSize = size;
            label.color = color;
            label.fontStyle = style;
            label.alignment = anchor;
            label.horizontalOverflow = HorizontalWrapMode.Wrap;
            label.verticalOverflow = VerticalWrapMode.Overflow;
            label.supportRichText = true;
            label.raycastTarget = false;
            return label;
        }

        public static Text Label(Transform parent, string text, int size, Color color,
            Vector2 position, Vector2 size, TextAnchor anchor = TextAnchor.MiddleLeft, FontStyle style = FontStyle.Normal)
        {
            RectTransform rt = NewRect("Текст", parent, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), position, size);
            return AddText(rt, text, size, color, anchor, style);
        }

        public static RectTransform Panel(string name, Transform parent, Color color)
        {
            RectTransform rt = Full(name, parent);
            AddImage(rt, color, true);
            return rt;
        }

        public static Button AddButton(RectTransform rt, Color background, Action onClick, Color? outline = null)
        {
            AddImage(rt, background, true);
            Outline edge = rt.gameObject.GetComponent<Outline>();
            if (edge == null) edge = rt.gameObject.AddComponent<Outline>();
            edge.effectColor = outline ?? Line2;
            edge.effectDistance = new Vector2(1f, -1f);
            edge.useGraphicAlpha = true;

            Button button = rt.gameObject.GetComponent<Button>();
            if (button == null) button = rt.gameObject.AddComponent<Button>();
            button.targetGraphic = rt.GetComponent<Image>();
            ColorBlock colors = button.colors;
            colors.normalColor = Color.white;
            colors.highlightedColor = new Color(1.12f, 1.12f, 1.12f, 1f);
            colors.pressedColor = new Color(0.72f, 0.72f, 0.72f, 1f);
            colors.disabledColor = new Color(0.35f, 0.35f, 0.35f, 0.6f);
            colors.colorMultiplier = 1f;
            button.colors = colors;
            if (onClick != null) button.onClick.AddListener(() => onClick());
            return button;
        }

        public static Button Button(Transform parent, string caption, Vector2 position, Vector2 size,
            Action onClick, Color? background = null, int fontSize = 14, Color? textColor = null)
        {
            RectTransform rt = NewRect("Кнопка " + caption, parent, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), position, size);
            Button button = AddButton(rt, background ?? new Color32(29, 35, 36, 255), onClick);
            RectTransform labelRect = Full("Подпись", rt);
            Stretch(labelRect, 4, 4, 2, 2);
            AddText(labelRect, caption, fontSize, textColor ?? Text, TextAnchor.MiddleCenter);
            return button;
        }

        public static Toggle Toggle(Transform parent, string caption, Vector2 position, Vector2 size,
            bool initial, Action<bool> onChanged)
        {
            RectTransform root = NewRect("Переключатель " + caption, parent, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), position, size);
            RectTransform box = NewRect("Галочка", root, new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(11f, 0f), new Vector2(22f, 22f));
            Image boxImage = AddImage(box, new Color32(20, 26, 27, 255), true);
            RectTransform checkRect = Full("✓", box);
            Text check = AddText(checkRect, "✓", 17, Accent, TextAnchor.MiddleCenter, FontStyle.Bold);
            check.gameObject.SetActive(false);

            RectTransform captionRect = NewRect("Подпись", root, new Vector2(0f, 0.5f), new Vector2(1f, 0.5f), new Vector2(18f, 0f), new Vector2(-36f, size.y));
            captionRect.offsetMin = new Vector2(32f, 0f);
            captionRect.offsetMax = new Vector2(0f, 0f);
            AddText(captionRect, caption, 13, Text, TextAnchor.MiddleLeft);

            Toggle toggle = root.gameObject.AddComponent<Toggle>();
            toggle.targetGraphic = boxImage;
            toggle.graphic = check;
            toggle.isOn = initial;
            if (onChanged != null) toggle.onValueChanged.AddListener(value => onChanged(value));
            return toggle;
        }

        public static Slider Slider(Transform parent, string caption, Vector2 position, Vector2 size,
            float min, float max, float initial, Action<float> onChanged)
        {
            RectTransform root = NewRect("Ползунок " + caption, parent, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), position, size);
            RectTransform label = NewRect("Название", root, new Vector2(0f, 1f), new Vector2(1f, 1f), Vector2.zero, new Vector2(0f, 20f));
            label.pivot = new Vector2(0.5f, 1f);
            AddText(label, caption, 13, Text, TextAnchor.MiddleLeft);

            RectTransform track = NewRect("Дорожка", root, new Vector2(0f, 0f), new Vector2(1f, 0f), Vector2.zero, new Vector2(0f, 22f));
            track.pivot = new Vector2(0.5f, 0f);
            AddImage(track, new Color32(40, 48, 50, 255), false);

            RectTransform fillArea = Full("Заполнение", track);
            Stretch(fillArea, 2f, 2f, 2f, 2f);
            RectTransform fill = NewRect("Заполнено", fillArea, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);
            AddImage(fill, Accent, false);

            RectTransform handleArea = Full("Ручка", track);
            Stretch(handleArea, 8f, 8f, 0f, 0f);
            RectTransform handle = NewRect("Ползунок", handleArea, new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), Vector2.zero, new Vector2(18f, 26f));
            AddImage(handle, Text, false);

            Slider slider = root.gameObject.AddComponent<Slider>();
            slider.minValue = min;
            slider.maxValue = max;
            slider.wholeNumbers = false;
            slider.fillRect = fill;
            slider.handleRect = handle;
            slider.targetGraphic = handle.GetComponent<Image>();
            slider.direction = Slider.Direction.LeftToRight;
            slider.value = Mathf.Clamp(initial, min, max);
            if (onChanged != null) slider.onValueChanged.AddListener(value => onChanged(value));
            return slider;
        }

        public static InputField Input(Transform parent, string placeholder, Vector2 position, Vector2 size, Action<string> onChanged = null)
        {
            RectTransform root = NewRect("Поле ввода", parent, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), position, size);
            AddImage(root, new Color32(12, 16, 17, 255), true);
            Outline edge = root.gameObject.AddComponent<Outline>();
            edge.effectColor = Line2;
            edge.effectDistance = new Vector2(1f, -1f);

            RectTransform textRect = Full("Текст", root);
            Stretch(textRect, 8f, 8f, 4f, 4f);
            Text text = AddText(textRect, string.Empty, 15, Text, TextAnchor.MiddleLeft);

            RectTransform placeholderRect = Full("Подсказка", root);
            Stretch(placeholderRect, 8f, 8f, 4f, 4f);
            Text hint = AddText(placeholderRect, placeholder, 13, Muted, TextAnchor.MiddleLeft);

            InputField field = root.gameObject.AddComponent<InputField>();
            field.textComponent = text;
            field.placeholder = hint;
            field.lineType = InputField.LineType.SingleLine;
            field.characterLimit = 64;
            if (onChanged != null) field.onValueChanged.AddListener(value => onChanged(value));
            return field;
        }

        public static RectTransform ScrollView(string name, Transform parent, Vector2 position, Vector2 size, out RectTransform content)
        {
            RectTransform root = NewRect(name, parent, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), position, size);
            AddImage(root, new Color(0f, 0f, 0f, 0.12f), false);

            RectTransform viewport = Full("Область прокрутки", root);
            AddImage(viewport, new Color(1f, 1f, 1f, 0.01f), true);
            viewport.gameObject.AddComponent<RectMask2D>();
            viewport.pivot = new Vector2(0.5f, 1f);

            content = NewRect("Содержимое", viewport, new Vector2(0f, 1f), new Vector2(1f, 1f), Vector2.zero, new Vector2(0f, 0f));
            content.pivot = new Vector2(0.5f, 1f);
            VerticalLayoutGroup layout = content.gameObject.AddComponent<VerticalLayoutGroup>();
            layout.padding = new RectOffset(8, 8, 8, 8);
            layout.spacing = 5f;
            layout.childAlignment = TextAnchor.UpperLeft;
            layout.childControlWidth = true;
            layout.childForceExpandWidth = true;
            layout.childControlHeight = false;
            layout.childForceExpandHeight = false;
            ContentSizeFitter fitter = content.gameObject.AddComponent<ContentSizeFitter>();
            fitter.verticalFit = ContentSizeFitter.FitMode.PreferredSize;

            ScrollRect scroll = root.gameObject.AddComponent<ScrollRect>();
            scroll.viewport = viewport;
            scroll.content = content;
            scroll.horizontal = false;
            scroll.vertical = true;
            scroll.movementType = ScrollRect.MovementType.Clamped;
            scroll.scrollSensitivity = 22f;
            return root;
        }

        public static RectTransform Row(Transform parent, string name, float height)
        {
            RectTransform rt = NewRect(name, parent, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), Vector2.zero, new Vector2(0f, height));
            rt.pivot = new Vector2(0.5f, 1f);
            LayoutElement element = rt.gameObject.AddComponent<LayoutElement>();
            element.preferredHeight = height;
            element.minHeight = height;
            return rt;
        }

        public static Image Divider(Transform parent, Color color)
        {
            RectTransform rt = NewRect("Линия", parent, new Vector2(0f, 0f), new Vector2(1f, 0f), Vector2.zero, new Vector2(0f, 1f));
            return AddImage(rt, color, false);
        }

        public static void EnsureEventSystem()
        {
            if (UnityEngine.Object.FindObjectOfType<EventSystem>() != null) return;
            GameObject events = new GameObject("EventSystem", typeof(EventSystem));
            try
            {
                events.AddComponent<StandaloneInputModule>();
            }
            catch (Exception)
            {
                // В проектах с новым Input System модуль можно заменить снаружи.
            }
        }

        public static void Clear(Transform parent)
        {
            for (int i = parent.childCount - 1; i >= 0; i--)
                UnityEngine.Object.Destroy(parent.GetChild(i).gameObject);
        }
    }
}
