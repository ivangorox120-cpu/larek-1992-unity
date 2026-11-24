using System;
using System.Collections.Generic;
using System.Globalization;
using Larek.Economy;
using UnityEngine;
using UnityEngine.UI;

namespace Larek.UI
{
    /// <summary>
    /// Бумажный блокнот заказов: категории, количество, наценка и итог заказа на базу.
    /// Всё строится в рантайме; данные заказа synchronization через рефлексию, чтобы не
    /// зависеть от точного контракта GameSession.
    /// </summary>
    public sealed class NotepadController : MonoBehaviour
    {
        private sealed class Category
        {
            public readonly string Name;
            public readonly string[] Ids;

            public Category(string name, params string[] ids)
            {
                Name = name;
                Ids = ids;
            }
        }

        private static readonly Category[] Categories =
        {
            new Category("Продукты", "bread", "choc"),
            new Category("Консервы", "tushonka", "kilka"),
            new Category("Напитки", "soda", "beer"),
            new Category("Сигареты", "cig"),
            new Category("Жвачка", "gum"),
            new Category("Журналы", "paper", "mag", "mag2"),
            new Category("Алкоголь", "vodka"),
            new Category("Прочее", "batt", "tape", "toy"),
            new Category("Карандашом…", "samogon", "kontra", "royal", "anabol", "vhs")
        };

        private static NotepadController instance;

        private RectTransform root;
        private RectTransform itemsContent;
        private RectTransform orderContent;
        private Text categoryHeader;
        private Text markupValue;
        private Text orderLines;
        private Text orderTotal;
        private Text cashText;
        private Text noteText;
        private Slider markupSlider;
        private readonly Button[] categoryButtons = new Button[Categories.Length];
        private readonly Dictionary<string, int> quantities = new Dictionary<string, int>();
        private int currentCategory;
        private float refreshTimer;

        public static NotepadController Ensure(Transform parent)
        {
            if (instance != null) return instance;
            instance = FindObjectOfType<NotepadController>();
            if (instance != null) return instance;
            GameObject go = new GameObject("Блокнот заказов", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            instance = go.AddComponent<NotepadController>();
            instance.Build();
            return instance;
        }

        private void Awake()
        {
            if (instance == null) instance = this;
        }

        private void Build()
        {
            root = UiFactory.Full("Слой блокнота", transform);
            UiFactory.AddImage(UiFactory.Full("Затемнение", root), new Color(0f, 0f, 0f, 0.62f), true);

            RectTransform book = UiFactory.NewRect("Блокнот", root, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f),
                Vector2.zero, new Vector2(960f, 620f));
            UiFactory.AddImage(book, new Color32(214, 208, 188, 255), true);
            Outline edge = book.gameObject.AddComponent<Outline>();
            edge.effectColor = new Color32(54, 49, 38, 255);
            edge.effectDistance = new Vector3(3f, -3f);

            RectTransform rings = UiFactory.NewRect("Кольца", book, new Vector2(0f, 0.5f), new Vector2(0f, 0.5f),
                new Vector2(16f, 0f), new Vector2(22f, 560f));
            for (int i = 0; i < 16; i++)
            {
                UiFactory.AddImage(UiFactory.NewRect("Кольцо " + i, rings, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f),
                    new Vector2(0f, i * 35f), new Vector2(30f, 10f)), new Color32(88, 83, 70, 220), false);
            }

            RectTransform tabs = UiFactory.NewRect("Категории", book, new Vector2(0f, 0f), new Vector2(0f, 1f),
                new Vector2(36f, 0f), new Vector2(150f, 0f));
            UiFactory.Stretch(tabs, 0f, 0f, 22f, 22f);
            VerticalLayoutGroup tabLayout = tabs.gameObject.AddComponent<VerticalLayoutGroup>();
            tabLayout.spacing = 3f;
            tabLayout.childControlWidth = true;
            tabLayout.childForceExpandWidth = true;
            tabLayout.childControlHeight = false;
            tabLayout.childForceExpandHeight = false;
            for (int i = 0; i < Categories.Length; i++)
            {
                int index = i;
                Button button = UiFactory.Button(tabs, Categories[i].Name, Vector2.zero, new Vector2(146f, 44f),
                    () => SelectCategory(index), new Color32(206, 199, 175, 255), 12, UiFactory.PaperInk);
                LayoutElement element = button.gameObject.AddComponent<LayoutElement>();
                element.preferredHeight = 44f;
                categoryButtons[i] = button;
            }

            categoryHeader = UiFactory.AddText(UiFactory.NewRect("Заголовок категории", book, new Vector2(0f, 1f), new Vector2(1f, 1f),
                new Vector2(0f, -36f), new Vector2(-36f, 30f)), "ПРОДУКТЫ", 16, UiFactory.PaperInk, TextAnchor.MiddleCenter, FontStyle.Bold);

            RectTransform sheet = UiFactory.NewRect("Лист", book, new Vector2(0f, 0f), new Vector2(1f, 1f),
                new Vector2(0f, 0f), new Vector2(-36f, -84f));
            UiFactory.Stretch(sheet, 194f, 22f, 54f, 28f);
            UiFactory.AddImage(sheet, new Color(1f, 1f, 1f, 0.08f), false);

            RectTransform left = UiFactory.NewRect("Товары", sheet, new Vector2(0f, 0f), new Vector2(0.62f, 1f), Vector2.zero, Vector2.zero);
            left.offsetMin = Vector2.zero;
            left.offsetMax = new Vector2(-6f, 0f);
            RectTransform itemsScroll = UiFactory.ScrollView("Список товаров", left, Vector2.zero, Vector2.zero, out itemsContent);
            UiFactory.Stretch(itemsScroll, 0f, 0f, 0f, 0f);

            RectTransform right = UiFactory.NewRect("Заказ", sheet, new Vector2(0.62f, 0f), new Vector2(1f, 1f), Vector2.zero, Vector2.zero);
            right.offsetMin = new Vector2(6f, 0f);
            right.offsetMax = Vector2.zero;
            UiFactory.AddImage(right, new Color(0.14f, 0.18f, 0.42f, 0.06f), false);
            UiFactory.AddText(UiFactory.NewRect("Заголовок заказа", right, new Vector2(0f, 1f), new Vector2(1f, 1f),
                new Vector2(0f, -20f), new Vector2(0f, 24f)), "Наценка в ларьке", 14, UiFactory.PaperInk, TextAnchor.MiddleLeft, FontStyle.Bold);

            markupValue = UiFactory.AddText(UiFactory.NewRect("Наценка", right, new Vector2(0f, 1f), new Vector2(1f, 1f),
                new Vector2(0f, -44f), new Vector2(0f, 24f)), "+40% (как все)", 13, UiFactory.PaperInk, TextAnchor.MiddleLeft);
            markupSlider = UiFactory.Slider(right, string.Empty, new Vector2(0f, -74f), new Vector2(250f, 34f),
                0f, 150f, 40f, OnMarkupChanged);
            RectTransform sliderRect = markupSlider.GetComponent<RectTransform>();
            sliderRect.anchorMin = sliderRect.anchorMax = new Vector2(0f, 1f);
            sliderRect.pivot = new Vector2(0f, 1f);
            sliderRect.anchoredPosition = new Vector2(10f, -62f);

            RectTransform presets = UiFactory.NewRect("Пресеты наценки", right, new Vector2(0f, 1f), new Vector2(1f, 1f),
                new Vector2(0f, -112f), new Vector2(0f, 28f));
            int[] presetValues = { 20, 40, 60, 100 };
            for (int i = 0; i < presetValues.Length; i++)
            {
                int value = presetValues[i];
                UiFactory.Button(presets, value + "%", new Vector2(-108f + i * 72f, 0f), new Vector2(64f, 26f),
                    () => markupSlider.value = value, new Color32(204, 197, 173, 255), 12, UiFactory.PaperInk);
            }

            RectTransform summary = UiFactory.NewRect("Итог", right, new Vector2(0f, 0f), new Vector2(1f, 0f),
                new Vector2(0f, 0f), new Vector2(0f, 220f));
            summary.pivot = new Vector2(0.5f, 0f);
            orderLines = UiFactory.AddText(summary, string.Empty, 12, UiFactory.PaperInk, TextAnchor.UpperLeft);
            orderLines.horizontalOverflow = HorizontalWrapMode.Wrap;
            orderLines.lineSpacing = 1.2f;
            RectTransform lineRect = UiFactory.NewRect("Строки", summary, new Vector2(0f, 1f), new Vector2(1f, 1f),
                new Vector2(0f, -6f), new Vector2(0f, 126f));
            lineRect.pivot = new Vector2(0.5f, 1f);
            orderLines.transform.SetParent(lineRect, false);
            UiFactory.Stretch((RectTransform)orderLines.transform, 0f, 0f, 0f, 0f);

            orderTotal = UiFactory.AddText(UiFactory.NewRect("Сумма", summary, new Vector2(0f, 0f), new Vector2(1f, 0f),
                new Vector2(0f, 78f), new Vector2(0f, 30f)), "итого: 0 р.", 14, UiFactory.PaperInk, TextAnchor.MiddleRight, FontStyle.Bold);
            noteText = UiFactory.AddText(UiFactory.NewRect("Заметка", summary, new Vector2(0f, 0f), new Vector2(1f, 0f),
                new Vector2(0f, 54f), new Vector2(0f, 22f)), string.Empty, 11, UiFactory.PaperInk, TextAnchor.MiddleRight);
            cashText = UiFactory.AddText(UiFactory.NewRect("Касса", summary, new Vector2(0f, 0f), new Vector2(1f, 0f),
                new Vector2(0f, 30f), new Vector2(0f, 22f)), "в кассе: 0 р.", 11, UiFactory.PaperInk, TextAnchor.MiddleRight);

            RectTransform bar = UiFactory.NewRect("Панель кнопок", root, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f),
                new Vector2(0f, 26f), new Vector2(700f, 42f));
            bar.pivot = new Vector2(0.5f, 0f);
            HorizontalLayoutGroup barLayout = bar.gameObject.AddComponent<HorizontalLayoutGroup>();
            barLayout.spacing = 8f;
            barLayout.childForceExpandWidth = true;
            AddBarButton(bar, "Очистить заказ", ClearOrder);
            AddBarButton(bar, "Газеты", () => PaperReaderController.ShowGlobal(0));
            AddBarButton(bar, "Убрать блокнот", Close);

            root.gameObject.SetActive(false);
            Refresh();
        }

        private static void AddBarButton(Transform parent, string caption, Action action)
        {
            Button button = UiFactory.Button(parent, caption, Vector2.zero, new Vector2(220f, 38f), action,
                new Color32(29, 35, 36, 255), 13);
            LayoutElement element = button.gameObject.AddComponent<LayoutElement>();
            element.preferredWidth = 220f;
            element.preferredHeight = 38f;
        }

        private void OnMarkupChanged(float value)
        {
            int percent = Mathf.RoundToInt(value / 5f) * 5;
            markupValue.text = "+%" + percent.ToString(CultureInfo.InvariantCulture) + " (" + MarkupLabel(percent) + ")";
            UiReflection.SetMember(UiApi.Economy, percent / 100f, "Markup");
            UiReflection.Invoke(UiApi.Session, new[] { "SetMarkup", "SetMarkupPercent" }, percent / 100f);
        }

        private static string MarkupLabel(int percent)
        {
            if (percent <= 25) return "по-честному";
            if (percent <= 60) return "как все";
            if (percent <= 100) return "дерзко";
            return "грабёж";
        }

        private void SelectCategory(int index)
        {
            currentCategory = Mathf.Clamp(index, 0, Categories.Length - 1);
            RenderItems();
        }

        private int Quantity(string id)
        {
            return quantities.TryGetValue(id, out int value) ? value : 0;
        }

        private void Change(string id, int delta)
        {
            int value = Mathf.Clamp(Quantity(id) + delta, 0, 200);
            if (value == 0) quantities.Remove(id);
            else quantities[id] = value;

            object order = UiReflection.GetMember(UiApi.Session, "Order", "Orders", "OrderLines");
            if (order != null)
            {
                object lines = UiReflection.GetMember(order, "lines", "Lines", "items", "Items");
                UiReflection.Invoke(order, new[] { "Set", "SetQuantity", "SetQty" }, id, value);
                if (lines is IDictionary dictionary)
                {
                    if (value == 0) dictionary.Remove(id);
                    else dictionary[id] = value;
                }
            }
            RenderItems();
            RenderOrder();
        }

        private void ClearOrder()
        {
            quantities.Clear();
            object order = UiReflection.GetMember(UiApi.Session, "Order", "Orders", "OrderLines");
            UiReflection.Invoke(order, new[] { "Clear", "ClearOrder", "Reset" });
            RenderItems();
            RenderOrder();
            HudController.ShowToastGlobal("Заказ очищен", 0);
        }

        private void RenderItems()
        {
            if (itemsContent == null) return;
            UiFactory.Clear(itemsContent);
            Category category = Categories[currentCategory];
            categoryHeader.text = category.Name.ToUpperInvariant();
            for (int i = 0; i < categoryButtons.Length; i++)
            {
                Image image = categoryButtons[i].GetComponent<Image>();
                if (image != null)
                    image.color = i == currentCategory ? new Color32(172, 160, 122, 255) : new Color32(206, 199, 175, 255);
            }

            if (category.Name.StartsWith("Карандаш", StringComparison.Ordinal))
            {
                UiFactory.AddText(UiFactory.Row(itemsContent, "Заметка", 40f),
                    "для своих. Вова с вокзала, звонить вечером.", 12, UiFactory.PaperInk, TextAnchor.MiddleLeft);
            }

            KioskEconomy economy = UiApi.KioskEconomy;
            foreach (string id in category.Ids)
            {
                Good good = Goods.Exists(id) ? Goods.Find(id) : null;
                string name = good != null ? good.Name : Capitalize(id);
                RectTransform row = UiFactory.Row(itemsContent, "Товар " + id, 58f);
                UiFactory.AddImage(row, new Color(0.1f, 0.12f, 0.42f, 0.05f), false);
                int wholesale = economy != null ? economy.WholesalePrice(id) : good != null ? good.BasePrice : 0;
                int retail = economy != null ? economy.RetailPrice(id) : Mathf.Max(1, Mathf.RoundToInt(wholesale * 1.4f));
                UiFactory.AddText(UiFactory.NewRect("Название", row, new Vector2(0f, 1f), new Vector2(1f, 1f),
                    new Vector2(10f, -8f), new Vector2(-170f, 22f)), name, 13, UiFactory.PaperInk, TextAnchor.MiddleLeft, FontStyle.Bold);
                UiFactory.AddText(UiFactory.NewRect("Цена", row, new Vector2(0f, 1f), new Vector2(1f, 1f),
                    new Vector2(10f, -30f), new Vector2(-170f, 20f)),
                    "опт " + wholesale + " → " + retail + " р.", 11, new Color32(74, 60, 120, 255), TextAnchor.MiddleLeft);

                RectTransform stepper = UiFactory.NewRect("Количество", row, new Vector2(1f, 0.5f), new Vector2(1f, 0.5f),
                    new Vector2(-88f, 0f), new Vector2(140f, 34f));
                stepper.pivot = new Vector2(1f, 0.5f);
                UiFactory.Button(stepper, "−", new Vector2(-48f, 0f), new Vector2(32f, 30f), () => Change(id, -5),
                    new Color32(206, 199, 175, 255), 16, UiFactory.PaperInk);
                UiFactory.AddText(UiFactory.NewRect("Число", stepper, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f),
                    Vector2.zero, new Vector2(44f, 28f)), Quantity(id).ToString(CultureInfo.InvariantCulture),
                    13, UiFactory.PaperInk, TextAnchor.MiddleCenter, FontStyle.Bold);
                UiFactory.Button(stepper, "+", new Vector2(48f, 0f), new Vector2(32f, 30f), () => Change(id, 5),
                    new Color32(206, 199, 175, 255), 16, UiFactory.PaperInk);
            }
        }

        private static string Capitalize(string id)
        {
            if (string.IsNullOrEmpty(id)) return "—";
            return char.ToUpperInvariant(id[0]) + id.Substring(1);
        }

        private void RenderOrder()
        {
            if (orderLines == null) return;
            KioskEconomy economy = UiApi.KioskEconomy;
            var text = new System.Text.StringBuilder();
            int sum = 0;
            int units = 0;
            foreach (KeyValuePair<string, int> pair in quantities)
            {
                if (pair.Value <= 0) continue;
                Good good = Goods.Exists(pair.Key) ? Goods.Find(pair.Key) : null;
                int price = economy != null ? economy.WholesalePrice(pair.Key) : good != null ? good.BasePrice : 0;
                int line = price * pair.Value;
                sum += line;
                units += pair.Value;
                string name = good != null ? good.Name.Replace("«", string.Empty).Replace("»", string.Empty) : Capitalize(pair.Key);
                text.Append(name).Append(" · ").Append(pair.Value).Append(" шт · ").Append(line).Append(" р.\n");
            }
            if (text.Length == 0) text.Append("пока пусто…\n");
            orderLines.text = text.ToString();

            int delivery = units > 0
                ? Mathf.Max(165, Mathf.RoundToInt(sum * 0.06f))
                : 0;
            orderTotal.text = "итого: " + (sum + delivery).ToString("N0") + " р.";
            noteText.text = units > 0 ? "→ позвонить с телефона на прилавке, подтвердить" : string.Empty;
            cashText.text = "в кассе: " + (economy != null ? economy.Money.ToString("N0") : "0") + " р.";

            int percent = economy != null ? Mathf.RoundToInt((float)economy.Markup * 100f) : 40;
            if (Mathf.Abs(markupSlider.value - percent) > 0.5f)
                markupSlider.SetValueWithoutNotify(Mathf.Clamp(percent, 0f, 150f));
            markupValue.text = "+%" + percent.ToString(CultureInfo.InvariantCulture) + " (" + MarkupLabel(percent) + ")";
        }

        private void Update()
        {
            if (root == null || !root.gameObject.activeSelf) return;
            if (Input.GetKeyDown(KeyCode.Escape))
            {
                Close();
                return;
            }
            refreshTimer -= Time.unscaledDeltaTime;
            if (refreshTimer <= 0f)
            {
                refreshTimer = 1f;
                RenderOrder();
            }
        }

        public void Show()
        {
            if (root == null) Build();
            root.gameObject.SetActive(true);
            RenderItems();
            RenderOrder();
        }

        public void Close()
        {
            if (root != null) root.gameObject.SetActive(false);
        }

        public void Toggle()
        {
            if (root != null && root.gameObject.activeSelf) Close();
            else Show();
        }

        private void OnDestroy()
        {
            if (instance == this) instance = null;
        }

        public static void ShowGlobal()
        {
            if (instance != null) instance.Show();
        }

        public static void ToggleGlobal()
        {
            if (instance != null) instance.Toggle();
        }
    }
}
