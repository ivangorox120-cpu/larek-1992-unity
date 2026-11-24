using System;
using System.Collections.Generic;
using Larek.Economy;
using UnityEngine;
using UnityEngine.UI;

namespace Larek.UI
{
    public sealed class TradePanelController : MonoBehaviour
    {
        private sealed class GoodRow
        {
            public string Id;
            public int Quantity = 1;
            public Text Name;
            public Text Stock;
            public Text Prices;
            public Text QuantityLabel;
        }

        private static TradePanelController instance;

        private RectTransform root;
        private RectTransform panel;
        private Text moneyText;
        private RectTransform scroll;
        private readonly List<GoodRow> rows = new List<GoodRow>();
        private KioskEconomy cachedEconomy;
        private KioskTrading trading;
        private float refreshTimer;

        public static TradePanelController Ensure(Transform parent)
        {
            if (instance != null) return instance;
            instance = FindObjectOfType<TradePanelController>();
            if (instance != null) return instance;
            GameObject go = new GameObject("Торговля", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            instance = go.AddComponent<TradePanelController>();
            instance.Build();
            return instance;
        }

        private void Awake()
        {
            if (instance == null) instance = this;
        }

        private void Build()
        {
            root = UiFactory.Full("Слой торговли", transform);
            panel = UiFactory.NewRect("Панель торговли", root, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, -58f), new Vector2(520f, 560f));
            panel.pivot = new Vector2(0.5f, 1f);
            UiFactory.AddImage(panel, UiFactory.Panel, true);
            Outline edge = panel.gameObject.AddComponent<Outline>();
            edge.effectColor = UiFactory.Line2;
            edge.effectDistance = new Vector2(1f, -1f);

            UiFactory.AddText(UiFactory.NewRect("Заголовок", panel, new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0f, -20f), new Vector2(0f, 30f)),
                "🏪 ОПТОВАЯ ЗАКУПКА И ПРОДАЖА", 15, UiFactory.Accent, TextAnchor.MiddleCenter, FontStyle.Bold);
            moneyText = UiFactory.AddText(UiFactory.NewRect("Касса", panel, new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0f, -46f), new Vector2(0f, 26f)),
                "В кассе: —", 13, UiFactory.Text, TextAnchor.MiddleCenter);

            scroll = UiFactory.ScrollView("Список товаров", panel, new Vector2(0f, -48f), new Vector2(500f, 490f), out RectTransform content);
            scroll.anchorMin = new Vector2(0.5f, 1f);
            scroll.anchorMax = new Vector2(0.5f, 1f);
            scroll.pivot = new Vector2(0.5f, 1f);

            foreach (Good good in Goods.All)
            {
                GoodRow row = CreateRow(content, good);
                rows.Add(row);
            }

            UiFactory.Button(panel, "Закрыть", new Vector2(0f, 18f), new Vector2(460f, 30f), () => Hide(),
                new Color32(29, 35, 36, 255), 12);
            RectTransform closeRect = (RectTransform)panel.Find("Кнопка Закрыть");
            if (closeRect != null)
            {
                closeRect.anchorMin = new Vector2(0.5f, 0f);
                closeRect.anchorMax = new Vector2(0.5f, 0f);
                closeRect.pivot = new Vector2(0.5f, 0f);
                closeRect.anchoredPosition = new Vector2(0f, 12f);
            }

            root.gameObject.SetActive(false);
        }

        private GoodRow CreateRow(Transform content, Good good)
        {
            var row = new GoodRow { Id = good.Id };
            RectTransform card = UiFactory.Row(content, "Товар " + good.Name, 84f);
            UiFactory.AddImage(card, new Color(1f, 1f, 1f, 0.04f), false);

            row.Name = UiFactory.AddText(UiFactory.NewRect("Название", card, new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0f, -16f), new Vector2(0f, 22f)),
                good.Name, 13, UiFactory.Text, TextAnchor.MiddleLeft, FontStyle.Bold);
            row.Stock = UiFactory.AddText(UiFactory.NewRect("Остаток", card, new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0f, -36f), new Vector2(0f, 20f)),
                "На складе: 0", 11, UiFactory.Muted, TextAnchor.MiddleLeft);
            row.Prices = UiFactory.AddText(UiFactory.NewRect("Цены", card, new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0f, -54f), new Vector2(0f, 20f)),
                "Опт: — · Розница: —", 12, UiFactory.Accent, TextAnchor.MiddleLeft);

            RectTransform stepper = UiFactory.NewRect("Количество", card, new Vector2(1f, 0f), new Vector2(1f, 0f), new Vector2(-186f, 10f), new Vector2(130f, 30f));
            stepper.pivot = new Vector2(1f, 0f);
            UiFactory.Button(stepper, "−", new Vector2(-48f, 0f), new Vector2(30f, 28f), () => Change(row, -1), new Color32(29, 35, 36, 255), 15);
            row.QuantityLabel = UiFactory.AddText(UiFactory.NewRect("Число", stepper, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(40f, 26f)),
                "1", 14, Color.white, TextAnchor.MiddleCenter);
            UiFactory.Button(stepper, "+", new Vector2(48f, 0f), new Vector2(30f, 28f), () => Change(row, 1), new Color32(29, 35, 36, 255), 15);

            UiFactory.Button(card, "Закупить", new Vector2(-84f, 12f), new Vector2(120f, 32f), () => Buy(row),
                new Color32(29, 51, 70, 255), 12);
            UiFactory.Button(card, "Продать", new Vector2(74f, 12f), new Vector2(120f, 32f), () => Sell(row),
                new Color32(42, 61, 34, 255), 12);

            RectTransform buyRect = (RectTransform)card.Find("Кнопка Закупить");
            RectTransform sellRect = (RectTransform)card.Find("Кнопка Продать");
            if (buyRect != null)
            {
                buyRect.anchorMin = buyRect.anchorMax = new Vector2(0f, 0f);
                buyRect.pivot = new Vector2(0f, 0f);
                buyRect.anchoredPosition = new Vector2(12f, 10f);
            }
            if (sellRect != null)
            {
                sellRect.anchorMin = sellRect.anchorMax = new Vector2(0f, 0f);
                sellRect.pivot = new Vector2(0f, 0f);
                sellRect.anchoredPosition = new Vector2(140f, 10f);
            }
            return row;
        }

        private static void Change(GoodRow row, int delta)
        {
            row.Quantity = Mathf.Clamp(row.Quantity + delta, 1, 50);
            row.QuantityLabel.text = row.Quantity.ToString();
        }

        private void EnsureTrading()
        {
            KioskEconomy economy = UiApi.KioskEconomy;
            if (economy == null)
            {
                trading = null;
                cachedEconomy = null;
                return;
            }
            if (ReferenceEquals(economy, cachedEconomy) && trading != null) return;
            cachedEconomy = economy;
            trading = new KioskTrading(economy);
        }

        private void Buy(GoodRow row)
        {
            EnsureTrading();
            if (trading == null)
            {
                HudController.ShowToastGlobal("Экономика ещё не готова — закупка недоступна.", 2);
                return;
            }
            TradeResult result = trading.Restock(row.Id, row.Quantity);
            HudController.ShowToastGlobal(Describe(result, "закупка", row.Quantity), result == TradeResult.Success ? 1 : 2);
            Refresh();
        }

        private void Sell(GoodRow row)
        {
            EnsureTrading();
            if (trading == null)
            {
                HudController.ShowToastGlobal("Экономика ещё не готова — продажа недоступна.", 2);
                return;
            }
            TradeResult result = trading.SellToCustomer(row.Id, row.Quantity);
            HudController.ShowToastGlobal(Describe(result, "продажа", row.Quantity), result == TradeResult.Success ? 1 : 2);
            Refresh();
        }

        private static string Describe(TradeResult result, string action, int quantity)
        {
            switch (result)
            {
                case TradeResult.Success: return (action == "закупка" ? "Закуплено: " : "Продано: ") + quantity + " шт.";
                case TradeResult.NotEnoughMoney: return "Не хватает наличных для закупки.";
                case TradeResult.NotEnoughStock: return "На складе нет столько товара.";
                case TradeResult.UnknownGood: return "Неизвестный товар.";
                default: return "Неверное количество.";
            }
        }

        private int Price(string id, bool retail)
        {
            if (trading != null)
            {
                try { return retail ? trading.CustomerPayout(id, 1) : trading.WholesaleCost(id, 1); }
                catch (Exception) { /* падаем назад к базовым ценам */ }
            }
            Good good = Goods.Exists(id) ? Goods.Find(id) : null;
            int baseline = good != null ? good.BasePrice : 10;
            return retail ? Mathf.Max(1, Mathf.RoundToInt(baseline * 1.4f)) : baseline;
        }

        private void Refresh()
        {
            if (panel == null) return;
            EnsureTrading();
            KioskEconomy economy = cachedEconomy;
            moneyText.text = economy != null ? "В кассе: " + economy.Money.ToString("N0") + " ₽ · День " + economy.Day : "В кассе: — (подсистема экономики не загружена)";

            foreach (GoodRow row in rows)
            {
                int stock = economy != null ? economy.Quantity(row.Id) : 0;
                row.Stock.text = "На складе: " + stock + " шт.";
                row.Prices.text = "Опт: " + Price(row.Id, false) + " ₽ · Розница: " + Price(row.Id, true) + " ₽";
            }
        }

        private void Update()
        {
            if (root == null || !root.gameObject.activeSelf) return;
            refreshTimer -= Time.unscaledDeltaTime;
            if (refreshTimer <= 0f)
            {
                refreshTimer = 0.5f;
                Refresh();
            }
        }

        public void Show()
        {
            root.gameObject.SetActive(true);
            Refresh();
        }

        public void Hide()
        {
            root.gameObject.SetActive(false);
        }

        public void Toggle()
        {
            if (root.gameObject.activeSelf) Hide();
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
