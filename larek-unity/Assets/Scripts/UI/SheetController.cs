using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace Larek.UI
{
    public sealed class SheetController : MonoBehaviour
    {
        private static SheetController instance;

        private readonly string[] tabNames = { "Графика", "Геймплей", "Звук", "Система" };
        private readonly Button[] tabButtons = new Button[4];
        private RectTransform root;
        private RectTransform content;
        private int currentTab;
        private bool open;

        public static SheetController Ensure(Transform parent)
        {
            if (instance != null) return instance;
            instance = FindObjectOfType<SheetController>();
            if (instance != null) return instance;
            GameObject go = new GameObject("Настройки", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            instance = go.AddComponent<SheetController>();
            instance.Build();
            return instance;
        }

        private void Awake()
        {
            if (instance == null) instance = this;
        }

        private void Build()
        {
            root = UiFactory.Full("Слой настроек", transform);
            RectTransform sheet = UiFactory.NewRect("Панель настроек", root, new Vector2(1f, 0f), new Vector2(1f, 1f), Vector2.zero, new Vector2(520f, 0f));
            sheet.pivot = new Vector2(1f, 0.5f);
            UiFactory.AddImage(sheet, UiFactory.Panel2, true);
            Outline edge = sheet.gameObject.AddComponent<Outline>();
            edge.effectColor = UiFactory.Line2;
            edge.effectDistance = new Vector2(1f, -1f);

            RectTransform head = UiFactory.NewRect("Шапка", sheet, new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0f, -27f), new Vector2(0f, 54f));
            head.pivot = new Vector2(0.5f, 1f);
            UiFactory.AddImage(head, new Color(0f, 0f, 0f, 0.18f), false);

            RectTransform tabs = UiFactory.NewRect("Вкладки", head, new Vector2(0f, 0f), new Vector2(1f, 0f), Vector2.zero, new Vector2(0f, 54f));
            HorizontalLayoutGroup tabLayout = tabs.gameObject.AddComponent<HorizontalLayoutGroup>();
            tabLayout.spacing = 2f;
            tabLayout.childControlWidth = true;
            tabLayout.childForceExpandWidth = true;
            for (int i = 0; i < tabNames.Length; i++)
            {
                int index = i;
                Button button = UiFactory.Button(tabs, tabNames[i], Vector2.zero, new Vector2(110f, 54f), () => Open(index),
                    new Color32(24, 29, 30, 255), 11);
                LayoutElement element = button.gameObject.AddComponent<LayoutElement>();
                element.preferredWidth = 110f;
                tabButtons[i] = button;
            }

            UiFactory.Button(head, "✕", new Vector2(-14f, 0f), new Vector2(34f, 34f), () => Close(),
                new Color32(24, 29, 30, 255), 18).GetComponent<RectTransform>().anchorMin = new Vector2(1f, 0.5f);
            RectTransform closeRect = (RectTransform)head.Find("Кнопка ✕");
            if (closeRect != null)
            {
                closeRect.anchorMax = new Vector2(1f, 0.5f);
                closeRect.pivot = new Vector2(1f, 0.5f);
                closeRect.anchoredPosition = new Vector2(-8f, 0f);
            }

            RectTransform scroll = UiFactory.ScrollView("Экран настроек", sheet, Vector2.zero, Vector2.zero, out content);
            scroll.anchorMin = Vector2.zero;
            scroll.anchorMax = Vector2.one;
            scroll.offsetMin = new Vector2(0f, 6f);
            scroll.offsetMax = new Vector2(0f, -56f);

            root.gameObject.SetActive(false);
            UiSettings.Instance.Changed += OnSettingsChanged;
            Render();
        }

        private void OnSettingsChanged()
        {
            if (open) Render();
        }

        public void Open(int tab)
        {
            currentTab = Mathf.Clamp(tab, 0, 3);
            open = true;
            root.gameObject.SetActive(true);
            Render();
        }

        public void Close()
        {
            open = false;
            root.gameObject.SetActive(false);
        }

        private void Render()
        {
            if (content == null) return;
            UiFactory.Clear(content);
            for (int i = 0; i < tabButtons.Length; i++)
            {
                Image image = tabButtons[i].GetComponent<Image>();
                if (image != null) image.color = i == currentTab ? new Color32(61, 50, 21, 255) : new Color32(24, 29, 30, 255);
            }

            AddHeading("⚙ Настройки", 19, UiFactory.Text);
            if (currentTab == 0) RenderGraphics();
            else if (currentTab == 1) RenderGameplay();
            else if (currentTab == 2) RenderSound();
            else RenderSystem();
        }

        private void RenderGraphics()
        {
            UiSettings settings = UiSettings.Instance;
            AddHeading("Пресеты графики и авто-профиль", 13, UiFactory.Accent);

            RectTransform presets = UiFactory.Row(content, "Пресеты", 38f);
            string[] keys = UiSettings.PresetKeys;
            string[] labels = { "Ультра", "Баланс", "Высокое" };
            for (int i = 0; i < keys.Length; i++)
            {
                string key = keys[i];
                UiFactory.Button(presets, labels[i], new Vector2(-170f + i * 110f, 0f), new Vector2(104f, 32f), () =>
                {
                    settings.ApplyPreset(key);
                    HudController.ShowToastGlobal("Пресет графики: " + UiSettings.GetPreset(key).Label, 1);
                }, key == settings.Quality ? new Color32(61, 50, 21, 255) : new Color32(29, 35, 36, 255), 12);
            }

            RectTransform autoRow = UiFactory.Row(content, "Авто", 36f);
            UiFactory.Button(autoRow, "⚡ Авто-профиль устройства (" + UiSettings.GetPreset(settings.AutoPreset()).Label + ")",
                Vector2.zero, new Vector2(460f, 32f), () =>
                {
                    string auto = settings.AutoPreset();
                    settings.ApplyPreset(auto);
                    HudController.ShowToastGlobal("Авто-профиль: " + UiSettings.GetPreset(auto).Label, 1);
                }, new Color32(29, 51, 70, 255), 12);

            AddCard("Видеокарта: " + SystemInfo.graphicsDeviceName + "\nРендер: Unity " + Application.unityVersion +
                    "\nТекстурная память: " + SystemInfo.graphicsMemorySize + " МБ\nПресет: " + UiSettings.GetPreset(settings.Quality).Label, 92f);

            AddHeading("Детализация", 13, UiFactory.Accent);
            AddChoice("Разрешение рендера", new[] { "65%", "85%", "100%", "125%", "150%" }, new[] { "0.65", "0.85", "1", "1.25", "1.5" },
                settings.GetCustom("dpr", "1"), value => settings.SetCustom("dpr", value));
            AddToggle("Dynamic Resolution Scaling", settings.Drs, value => { settings.Drs = value; settings.Save(); });
            AddChoice("Качество теней", new[] { "Выключены", "Низкие", "Средние", "Высокие" }, new[] { "0", "512", "1024", "1536" },
                settings.GetCustom("shadows", settings.Shadows.ToString()), value =>
                {
                    settings.Shadows = int.TryParse(value, out int v) ? v : 1024;
                    settings.SetCustom("shadows", value);
                });
            AddSliderRow("Дальность прорисовки", 55f, 220f, settings.Draw, value => { settings.Draw = Mathf.RoundToInt(value); settings.Save(); }, v => Mathf.RoundToInt(v) + " м");
            AddChoice("Качество освещения", new[] { "Базовое", "Среднее", "Полное" }, new[] { "0", "1", "2" },
                settings.GetCustom("light", "2"), value => settings.SetCustom("light", value));
            AddChoice("Активных источников света", new[] { "1", "2", "3", "4" }, new[] { "1", "2", "3", "4" },
                settings.MaxLights.ToString(), value => { settings.MaxLights = int.TryParse(value, out int v) ? v : 3; settings.Save(); });
            AddChoice("Фильтрация текстур", new[] { "Билинейная", "Трилинейная" }, new[] { "bilinear", "trilinear" },
                settings.GetCustom("texFilter", "trilinear"), value => settings.SetCustom("texFilter", value));
            AddChoice("Анизотропная фильтрация", new[] { "1×", "2×", "4×", "8×", "16×" }, new[] { "1", "2", "4", "8", "16" },
                settings.GetCustom("aniso", "4"), value => settings.SetCustom("aniso", value));
            AddChoice("Отражения", new[] { "Выключены", "Низкие", "Высокие" }, new[] { "0", "1", "2" },
                settings.GetCustom("reflections", "1"), value => settings.SetCustom("reflections", value));
            AddSliderRow("Дальность NPC", 30f, 120f, settings.GetCustomInt("npcDraw", 75), value => settings.SetCustom("npcDraw", Mathf.RoundToInt(value).ToString()), v => Mathf.RoundToInt(v) + " м");
            AddSliderRow("Количество NPC", 4f, 24f, settings.NpcCount, value => { settings.NpcCount = Mathf.RoundToInt(value); settings.Save(); }, v => Mathf.RoundToInt(v).ToString());
            AddSliderRow("Количество транспорта", 1f, 6f, settings.GetCustomInt("cars", 3), value => settings.SetCustom("cars", Mathf.RoundToInt(value).ToString()), v => Mathf.RoundToInt(v).ToString());
            AddSliderRow("Снег и погода", 0f, 2500f, settings.GetCustomInt("snow", 850), value => settings.SetCustom("snow", Mathf.RoundToInt(value).ToString()), v => Mathf.RoundToInt(v).ToString());
            AddToggle("Постобработка", settings.GetCustom("postfx", "1") != "0", value => settings.SetCustom("postfx", value ? "1" : "0"));
            AddToggle("Вертикальная синхронизация", settings.Vsync != 0, value => { settings.Vsync = value ? 1 : 0; settings.Save(); });
            AddChoice("Ограничитель FPS", new[] { "30", "45", "60", "90", "120" }, new[] { "30", "45", "60", "90", "120" },
                settings.FpsCap.ToString(), value => { settings.FpsCap = int.TryParse(value, out int v) ? v : 60; settings.Save(); });
            AddToggle("Диагностика производительности", settings.ShowDiag != 0, value => { settings.ShowDiag = value ? 1 : 0; settings.Save(); });
            AddToggle("Ретро-фильтр", settings.Retro, value => { settings.Retro = value; settings.Save(); });
            AddToggle("Газеты и мусор на улицах", settings.Litter, value => { settings.Litter = value; settings.Save(); });
        }

        private void RenderGameplay()
        {
            UiSettings settings = UiSettings.Instance;
            AddHeading("Геймплей и интерфейс", 13, UiFactory.Accent);
            AddSliderRow("Покачивание камеры", 0f, 2f, settings.Bob, value => { settings.Bob = value; settings.Save(); }, v => Mathf.RoundToInt(v * 100f) + "%");
            AddChoice("Счётчик FPS", new[] { "включён", "выключен" }, new[] { "1", "0" }, settings.ShowFps.ToString(),
                value => { settings.ShowFps = int.TryParse(value, out int v) ? v : 1; settings.Save(); });
            AddChoice("Уведомления на экране", new[] { "все", "только важные", "выключены" }, new[] { "2", "1", "0" }, settings.Toasts.ToString(),
                value => { settings.Toasts = int.TryParse(value, out int v) ? v : 2; settings.Save(); });
            AddToggle("Сдача руками (мини-игра)", settings.ChangeGame, value => { settings.ChangeGame = value; settings.Save(); });
            AddSliderRow("Чувствительность обзора", 0.3f, 3f, settings.LookSensitivity, value => { settings.LookSensitivity = value; settings.Save(); }, v => v.ToString("0.00"));
            AddToggle("Инверсия по вертикали", settings.InvertY, value => { settings.InvertY = value; settings.Save(); });
            AddCard("«Только важные» — без реплик прохожих и подсказок: остаются деньги, угрозы и итоги.", 66f);
        }

        private void RenderSound()
        {
            UiSettings settings = UiSettings.Instance;
            AddHeading("Звук и радио", 13, UiFactory.Accent);
            AddSliderRow("Общая громкость", 0f, 1f, settings.Master, value => { settings.Master = value; settings.Save(); }, v => Mathf.RoundToInt(v * 100f) + "%");
            AddSliderRow("Радио", 0f, 1f, settings.Radio, value => { settings.Radio = value; settings.Save(); }, v => Mathf.RoundToInt(v * 100f) + "%");
            AddSliderRow("Город и ветер", 0f, 1f, settings.Ambience, value => { settings.Ambience = value; settings.Save(); }, v => Mathf.RoundToInt(v * 100f) + "%");

            RectTransform buttons = UiFactory.Row(content, "Кнопки звука", 42f);
            UiFactory.Button(buttons, settings.RadioOn ? "📻 Радио: вкл" : "📻 Радио: выкл", new Vector2(-125f, 0f), new Vector2(230f, 34f), () =>
            {
                settings.RadioOn = !settings.RadioOn;
                settings.Save();
            }, new Color32(29, 35, 36, 255), 12);
            UiFactory.Button(buttons, settings.Mute ? "🔇 Звук выкл" : "🔊 Звук вкл", new Vector2(125f, 0f), new Vector2(230f, 34f), () =>
            {
                settings.Mute = !settings.Mute;
                settings.Save();
            }, new Color32(29, 35, 36, 255), 12);
            AddCard("Звук должен быть реалистичным 3D: источники дней, радио и шагов рассчитываются в мире, а не в интерфейсе.", 66f);
        }

        private void RenderSystem()
        {
            UiSettings settings = UiSettings.Instance;
            AddHeading("Управление и система", 13, UiFactory.Accent);
            AddSliderRow("Чувствительность обзора", 0.3f, 3f, settings.LookSensitivity, value => { settings.LookSensitivity = value; settings.Save(); }, v => v.ToString("0.00"));
            AddCard("Unity " + Application.unityVersion + "\n" + SystemInfo.operatingSystem + "\n" + SystemInfo.deviceModel +
                    "\nЯзык: русский · кодировка UTF-8\nШрифт: системный с кириллицей (WOFF2 в Unity не поддерживается)", 108f);

            RectTransform trade = UiFactory.Row(content, "Торговля", 44f);
            UiFactory.Button(trade, "🏪 Торговая панель (15 товаров)", Vector2.zero, new Vector2(460f, 38f),
                () => TradePanelController.ShowGlobal(), new Color32(29, 51, 70, 255), 13);

            RectTransform admin = UiFactory.Row(content, "Админ", 44f);
            UiFactory.Button(admin, "🛠 Админ-панель (код larek1992)", Vector2.zero, new Vector2(460f, 38f),
                () => AdminPanelController.PromptGlobal(), new Color32(61, 50, 21, 255), 13);

            RectTransform controls = UiFactory.Row(content, "Управление", 44f);
            UiFactory.Button(controls, "Редактор раскладки экранного управления", Vector2.zero, new Vector2(460f, 38f),
                () => HudController.ShowToastGlobal("Раскладка кнопок настраивается в TouchControls.", 0),
                new Color32(29, 35, 36, 255), 13);

            RectTransform bottom = UiFactory.Row(content, "Кнопки выхода", 90f);
            UiFactory.Button(bottom, "Выйти в главное меню", new Vector2(-118f, 12f), new Vector2(220f, 40f), () =>
            {
                Close();
                TitleScreenController.ShowGlobal();
            }, new Color32(29, 51, 70, 255), 13);
            UiFactory.Button(bottom, "Начать заново", new Vector2(118f, 12f), new Vector2(220f, 40f), () =>
                ModalController.MessageBoxGlobal("Начать заново?", "Весь прогресс пропадёт.", "Отмена"), new Color32(90, 31, 24, 255), 13);
            UiFactory.Button(bottom, "Сохранить настройки", new Vector2(0f, -28f), new Vector2(460f, 34f), () =>
            {
                settings.Save();
                HudController.ShowToastGlobal("Настройки сохранены", 1);
            }, new Color32(42, 61, 34, 255), 13);
        }

        private void AddHeading(string text, int size, Color color)
        {
            RectTransform row = UiFactory.Row(content, "Заголовок " + text, size + 12f);
            UiFactory.AddText(row, text, size, color, TextAnchor.MiddleLeft, FontStyle.Bold);
        }

        private void AddCard(string text, float height)
        {
            RectTransform row = UiFactory.Row(content, "Карточка", height);
            UiFactory.AddImage(row, new Color(1f, 1f, 1f, 0.05f), false);
            Text label = UiFactory.AddText(row, text, 12, UiFactory.Muted, TextAnchor.UpperLeft);
            label.lineSpacing = 1.25f;
        }

        private void AddToggle(string caption, bool initial, Action<bool> onChanged)
        {
            RectTransform row = UiFactory.Row(content, "Переключатель " + caption, 34f);
            UiFactory.AddText(row, caption, 13, UiFactory.Text, TextAnchor.MiddleLeft);
            UiFactory.Toggle(row, string.Empty, new Vector2(215f, 0f), new Vector2(24f, 24f), initial, onChanged);
        }

        private void AddSliderRow(string caption, float min, float max, float initial, Action<float> onChanged, Func<float, string> format)
        {
            RectTransform row = UiFactory.Row(content, "Ползунок " + caption, 58f);
            UiFactory.AddText(row, caption, 13, UiFactory.Text, TextAnchor.UpperLeft);
            Slider slider = UiFactory.Slider(row, string.Empty, new Vector2(90f, -12f), new Vector2(300f, 38f), min, max, initial, value =>
            {
                onChanged(value);
            });
            Text valueLabel = UiFactory.AddText(UiFactory.NewRect("Значение", row, new Vector2(1f, 0.5f), new Vector2(1f, 0.5f),
                new Vector2(-50f, -10f), new Vector2(96f, 26f)), format(initial), 12, UiFactory.Muted, TextAnchor.MiddleRight);
            slider.onValueChanged.AddListener(value => valueLabel.text = format(value));
        }

        private void AddChoice(string caption, string[] labels, string[] values, string current, Action<string> onChanged)
        {
            RectTransform row = UiFactory.Row(content, "Выбор " + caption, 40f);
            UiFactory.AddText(row, caption, 13, UiFactory.Text, TextAnchor.MiddleLeft);
            CreateDropdown(row, labels, values, current, onChanged);
        }

        private static Dropdown CreateDropdown(Transform parent, string[] labels, string[] values, string current, Action<string> onChanged)
        {
            RectTransform rect = UiFactory.NewRect("Выбор", parent, new Vector2(1f, 0.5f), new Vector2(1f, 0.5f),
                new Vector2(-122f, 0f), new Vector2(236f, 28f));
            rect.pivot = new Vector2(1f, 0.5f);
            Image image = UiFactory.AddImage(rect, new Color32(29, 35, 36, 255), true);

            RectTransform captionRect = FullLocal("Подпись", rect, 6f, 22f, 2f, 2f);
            Text caption = UiFactory.AddText(captionRect, string.Empty, 12, UiFactory.Text, TextAnchor.MiddleLeft);

            RectTransform arrowRect = UiFactory.NewRect("Стрелка", rect, new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(-12f, 0f), new Vector2(16f, 18f));
            UiFactory.AddText(arrowRect, "▼", 11, UiFactory.Accent, TextAnchor.MiddleCenter);

            RectTransform template = UiFactory.NewRect("Список", rect, new Vector2(0f, 0f), new Vector2(1f, 0f), new Vector2(0f, 2f), new Vector2(0f, 170f));
            template.pivot = new Vector2(0.5f, 0f);
            UiFactory.AddImage(template, UiFactory.Panel2, true);
            ScrollRect templateScroll = template.gameObject.AddComponent<ScrollRect>();
            templateScroll.horizontal = false;
            templateScroll.vertical = true;

            RectTransform viewport = UiFactory.Full("Область", template);
            UiFactory.AddImage(viewport, new Color(1f, 1f, 1f, 0.01f), true);
            viewport.gameObject.AddComponent<RectMask2D>();
            RectTransform list = UiFactory.NewRect("Элементы", viewport, new Vector2(0f, 1f), new Vector2(1f, 1f), Vector2.zero, new Vector2(0f, 0f));
            list.pivot = new Vector2(0.5f, 1f);
            VerticalLayoutGroup listLayout = list.gameObject.AddComponent<VerticalLayoutGroup>();
            listLayout.childControlWidth = true;
            listLayout.childForceExpandWidth = true;
            listLayout.childControlHeight = false;
            listLayout.padding = new RectOffset(4, 4, 4, 4);
            list.gameObject.AddComponent<ContentSizeFitter>().verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            templateScroll.viewport = viewport;
            templateScroll.content = list;

            RectTransform item = UiFactory.NewRect("Элемент", list, new Vector2(0f, 1f), new Vector2(1f, 1f), Vector2.zero, new Vector2(0f, 28f));
            item.pivot = new Vector2(0.5f, 1f);
            Toggle itemToggle = item.gameObject.AddComponent<Toggle>();
            itemToggle.targetGraphic = UiFactory.AddImage(item, new Color32(29, 35, 36, 255), true);
            RectTransform itemCaption = FullLocal("Подпись", item, 8f, 8f, 2f, 2f);
            Text itemText = UiFactory.AddText(itemCaption, string.Empty, 12, UiFactory.Text, TextAnchor.MiddleLeft);
            itemToggle.graphic = itemText;

            Dropdown dropdown = rect.gameObject.AddComponent<Dropdown>();
            dropdown.targetGraphic = image;
            dropdown.template = template;
            dropdown.itemTemplate = item;
            dropdown.captionText = caption;
            dropdown.itemText = itemText;
            dropdown.ClearOptions();
            dropdown.AddOptions(new List<string>(labels));
            int index = Array.IndexOf(values, current);
            dropdown.SetValueWithoutNotify(index >= 0 ? index : 0);
            if (onChanged != null) dropdown.onValueChanged.AddListener(i => onChanged(values[Mathf.Clamp(i, 0, values.Length - 1)]));
            template.gameObject.SetActive(false);
            return dropdown;
        }

        private static RectTransform FullLocal(string name, Transform parent, float left, float right, float top, float bottom)
        {
            RectTransform rt = UiFactory.Full(name, parent);
            UiFactory.Stretch(rt, left, right, top, bottom);
            return rt;
        }

        private void OnDestroy()
        {
            if (UiSettings.Instance != null) UiSettings.Instance.Changed -= OnSettingsChanged;
            if (instance == this) instance = null;
        }

        public static void OpenSettingsGlobal()
        {
            if (instance != null) instance.Open(3);
        }

        public static void OpenGlobal(int tab)
        {
            if (instance != null) instance.Open(tab);
        }
    }
}
