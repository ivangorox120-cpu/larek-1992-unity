using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace Larek.UI
{
    /// <summary>
    /// Админ-панель (M01). Корень панели создаётся один раз и живёт до выхода из игры:
    /// он никогда не удаляется. Открытие возможно только после ввода кода larek1992.
    /// </summary>
    public sealed class AdminPanelController : MonoBehaviour
    {
        private const string AccessCode = "larek1992";

        private static AdminPanelController instance;

        private RectTransform root;
        private GameObject promptObject;
        private GameObject panelObject;
        private InputField codeInput;
        private Text statusText;
        private Text godLabel;
        private Text moneyLabel;
        private Text debugLabel;
        private bool authenticated;
        private bool godMode;
        private bool freeMoney;
        private bool debugMode;

        public static AdminPanelController Ensure(Transform parent)
        {
            if (instance != null) return instance;
            instance = FindObjectOfType<AdminPanelController>();
            if (instance != null) return instance;
            GameObject go = new GameObject("Админ-панель", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            // M01: корень панели не удаляется при закрытиях и сменах сцены.
            DontDestroyOnLoad(go);
            instance = go.AddComponent<AdminPanelController>();
            instance.Build();
            return instance;
        }

        private void Awake()
        {
            if (instance == null) instance = this;
            DontDestroyOnLoad(gameObject);
        }

        private void Build()
        {
            root = UiFactory.Full("Слой админ-панели", transform);

            promptObject = UiFactory.Full("Ввод кода", root).gameObject;
            RectTransform prompt = promptObject.GetComponent<RectTransform>();
            UiFactory.AddImage(prompt, new Color(0f, 0f, 0f, 0.82f), true);
            RectTransform card = UiFactory.NewRect("Карточка кода", prompt, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f),
                Vector2.zero, new Vector2(460f, 250f));
            UiFactory.AddImage(card, UiFactory.Panel2, true);
            Outline edge = card.gameObject.AddComponent<Outline>();
            edge.effectColor = UiFactory.Accent;
            edge.effectDistance = new Vector2(2f, -2f);

            UiFactory.AddText(UiFactory.NewRect("Заголовок", card, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f),
                new Vector2(0f, -34f), new Vector2(420f, 34f)), "🛠 АДМИН-ПАНЕЛЬ", 19,
                UiFactory.Accent, TextAnchor.MiddleCenter, FontStyle.Bold);
            UiFactory.AddText(UiFactory.NewRect("Подсказка", card, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f),
                new Vector2(0f, -64f), new Vector2(420f, 26f)), "Доступ только по коду", 13, UiFactory.Muted, TextAnchor.MiddleCenter);

            codeInput = UiFactory.Input(card, "Введите код…", new Vector2(0f, -108f), new Vector2(400f, 40f));
            RectTransform inputRect = codeInput.GetComponent<RectTransform>();
            inputRect.anchorMin = inputRect.anchorMax = new Vector2(0.5f, 1f);
            inputRect.pivot = new Vector2(0.5f, 1f);
            inputRect.anchoredPosition = new Vector2(0f, -94f);
            codeInput.contentType = InputField.ContentType.Standard;
            codeInput.onEndEdit.AddListener(value =>
            {
                if (!string.IsNullOrEmpty(value)) TryUnlock();
            });

            UiFactory.Button(card, "Войти", new Vector2(-104f, -176f), new Vector2(190f, 40f), TryUnlock,
                new Color32(42, 61, 34, 255), 14);
            UiFactory.Button(card, "Отмена", new Vector2(104f, -176f), new Vector2(190f, 40f), Hide,
                new Color32(90, 31, 24, 255), 14);
            statusText = UiFactory.AddText(UiFactory.NewRect("Статус", card, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f),
                new Vector2(0f, 12f), new Vector2(420f, 24f)), string.Empty, 12, UiFactory.Red, TextAnchor.MiddleCenter);

            panelObject = UiFactory.Full("Панель возможностей", root).gameObject;
            RectTransform shade = panelObject.GetComponent<RectTransform>();
            UiFactory.AddImage(shade, new Color(0f, 0f, 0f, 0.34f), true);
            RectTransform panel = UiFactory.NewRect("Окно", shade, new Vector2(1f, 0.5f), new Vector2(1f, 0.5f),
                new Vector2(-18f, 0f), new Vector2(410f, 560f));
            panel.pivot = new Vector2(1f, 0.5f);
            UiFactory.AddImage(panel, UiFactory.Panel2, true);
            Outline panelEdge = panel.gameObject.AddComponent<Outline>();
            panelEdge.effectColor = UiFactory.Accent;
            panelEdge.effectDistance = new Vector2(2f, -2f);

            UiFactory.AddText(UiFactory.NewRect("Заголовок", panel, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f),
                new Vector2(0f, -28f), new Vector2(380f, 32f)), "🛠 АДМИН · larek1992", 17,
                UiFactory.Accent, TextAnchor.MiddleCenter, FontStyle.Bold);

            RectTransform toggles = UiFactory.NewRect("Переключатели", panel, new Vector2(0f, 1f), new Vector2(1f, 1f),
                new Vector2(0f, -60f), new Vector2(0f, 170f));
            UiFactory.Toggle(toggles, "Бессмертие (God mode)", new Vector2(0f, -18f), new Vector2(360f, 34f), godMode, SetGod);
            UiFactory.Toggle(toggles, "Свободные деньги", new Vector2(0f, -66f), new Vector2(360f, 34f), freeMoney, SetFreeMoney);
            UiFactory.Toggle(toggles, "Отладочная информация", new Vector2(0f, -114f), new Vector2(360f, 34f), debugMode, SetDebug);
            godLabel = UiFactory.AddText(UiFactory.NewRect("God статус", toggles, new Vector2(0f, 0f), new Vector2(1f, 0f),
                new Vector2(0f, 4f), new Vector2(0f, 22f)), string.Empty, 11, UiFactory.Muted, TextAnchor.MiddleLeft);

            UiFactory.AddText(UiFactory.NewRect("Телепорт", panel, new Vector2(0f, 1f), new Vector2(1f, 1f),
                new Vector2(0f, -250f), new Vector2(0f, 26f)), "Телепорт", 14, UiFactory.Accent, TextAnchor.MiddleLeft, FontStyle.Bold);
            string[] places = { "Ларёк", "Завод", "Автобусная остановка", "Двор" };
            Vector3[] positions =
            {
                new Vector3(0f, 1f, 0f), new Vector3(120f, 1f, -80f), new Vector3(-60f, 1f, 40f), new Vector3(30f, 1f, 70f)
            };
            for (int i = 0; i < places.Length; i++)
            {
                int index = i;
                UiFactory.Button(panel, places[i], new Vector2(0f, -286f - i * 44f), new Vector2(360f, 36f),
                    () => Teleport(positions[index]), new Color32(29, 35, 36, 255), 13);
            }

            RectTransform actions = UiFactory.NewRect("Действия", panel, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f),
                new Vector2(0f, 18f), new Vector2(380f, 120f));
            actions.pivot = new Vector2(0.5f, 0f);
            UiFactory.Button(actions, "Выдать 100 000 ₽", new Vector2(0f, 92f), new Vector2(360f, 34f), GrantMoney,
                new Color32(42, 61, 34, 255), 13);
            UiFactory.Button(actions, "Сбросить день", new Vector2(0f, 52f), new Vector2(360f, 34f), SkipDay,
                new Color32(61, 50, 21, 255), 13);
            UiFactory.Button(actions, "Закрыть панель", new Vector2(0f, 12f), new Vector2(360f, 34f), Hide,
                new Color32(90, 31, 24, 255), 13);
            moneyLabel = UiFactory.AddText(UiFactory.NewRect("Деньги", actions, new Vector2(0f, 0f), new Vector2(0f, 0f),
                new Vector2(0f, -16f), new Vector2(360f, 20f)), string.Empty, 11, UiFactory.Muted, TextAnchor.MiddleLeft);
            debugLabel = UiFactory.AddText(UiFactory.NewRect("Отладка", actions, new Vector2(1f, 0f), new Vector2(1f, 0f),
                new Vector2(0f, -16f), new Vector2(360f, 20f)), string.Empty, 11, UiFactory.Muted, TextAnchor.MiddleRight);

            promptObject.SetActive(false);
            panelObject.SetActive(false);
            root.gameObject.SetActive(false);
            RefreshStatus();
        }

        private void TryUnlock()
        {
            if (codeInput == null) return;
            string code = codeInput.text ?? string.Empty;

            // M01: код принимается только моделью AdminPanel (Session.TryAdminCode/Admin.TryUnlock).
            bool accepted = UiReflection.AsBool(UiReflection.Invoke(UiApi.Session,
                new[] { "TryAdminCode" }, code));
            if (!accepted)
                accepted = UiReflection.AsBool(UiReflection.Invoke(UiApi.Admin,
                    new[] { "TryUnlock", "Submit", "TryOpen" }, code));

            // Локальная проверка — запасной путь, если игровая сессия ещё не загружена.
            if (!accepted)
                accepted = string.Equals(code.Trim(), AccessCode, StringComparison.OrdinalIgnoreCase);

            if (accepted) Unlock();
            else
            {
                statusText.text = "Неверный код. Доступ запрещён.";
                HudController.ShowToastGlobal("Неверный код админ-панели", 2);
            }
        }

        private void Unlock()
        {
            authenticated = true;
            UiReflection.Invoke(UiApi.Admin, new[] { "Open", "Unlock" });
            statusText.text = string.Empty;
            codeInput.text = string.Empty;
            root.gameObject.SetActive(true);
            promptObject.SetActive(false);
            panelObject.SetActive(true);
            RefreshStatus();
            HudController.ShowToastGlobal("Админ-панель открыта", 1);
        }

        private void SetGod(bool value)
        {
            godMode = value;
            // В модели PlayerState бессмертие выражается через Health/MaxHealth.
            object player = UiApi.Player;
            if (player != null)
            {
                UiReflection.SetMember(player, value ? 9999 : 100, "MaxHealth");
                UiReflection.SetMember(player, value ? 9999 : 100, "Health");
            }
            UiReflection.Invoke(UiApi.Session, new[] { "SetGodMode", "SetInvincible" }, value);
            RefreshStatus();
        }

        private void SetFreeMoney(bool value)
        {
            freeMoney = value;
            if (value) GrantMoney();
            RefreshStatus();
        }

        private void SetDebug(bool value)
        {
            debugMode = value;
            UiSettings.Instance.ShowDiag = value ? 1 : 0;
            UiSettings.Instance.Save();
            RefreshStatus();
        }

        private void Teleport(Vector3 position)
        {
            object player = UiApi.Player;
            if (player == null)
            {
                HudController.ShowToastGlobal("Игрок ещё не создан — телепорт недоступен.", 2);
                return;
            }
            // PlayerState.SetPosition(double x, double y, double z) — реальный контракт модели.
            object moved = UiReflection.Invoke(player, new[] { "SetPosition", "MoveTo", "Teleport" },
                (double)position.x, (double)position.y, (double)position.z);
            if (moved == null)
            {
                UiReflection.SetMember(player, (double)position.x, "X");
                UiReflection.SetMember(player, (double)position.y, "Y");
                UiReflection.SetMember(player, (double)position.z, "Z");
            }
            HudController.ShowToastGlobal("Телепорт выполнен", 1);
        }

        private void GrantMoney()
        {
            object economy = UiApi.Economy;
            int before = UiReflection.AsInt(UiReflection.GetMember(economy, "Money"));
            UiReflection.Invoke(economy, new[] { "Earn", "AddMoney", "GiveMoney" }, 100000);
            int after = UiReflection.AsInt(UiReflection.GetMember(economy, "Money"));
            if (after == before)
            {
                UiReflection.SetMember(economy, before + 100000, "Money", "Cash");
                after = UiReflection.AsInt(UiReflection.GetMember(economy, "Money"));
            }
            HudController.ShowToastGlobal("Выдано 100 000 ₽", 1);
            RefreshStatus();
        }

        private void SkipDay()
        {
            UiReflection.Invoke(UiApi.Economy, new[] { "AdvanceDay", "NextDay", "SkipDay" });
            UiReflection.Invoke(UiApi.Session, new[] { "AdvanceDay", "NextDay", "SkipDay" });
            HudController.ShowToastGlobal("День пропущен", 1);
            RefreshStatus();
        }

        private void RefreshStatus()
        {
            if (godLabel != null)
                godLabel.text = godMode ? "God mode включён" : string.Empty;
            if (moneyLabel != null)
                moneyLabel.text = "Касса: " + UiReflection.AsInt(UiReflection.GetMember(UiApi.Economy, "Money")).ToString("N0") + " ₽";
            if (debugLabel != null)
                debugLabel.text = debugMode ? "Отладка включена" : string.Empty;
        }

        private void Update()
        {
            if (root == null || !root.gameObject.activeSelf) return;
            if (Input.GetKeyDown(KeyCode.Escape)) Hide();
            if (Time.frameCount % 30 == 0 && panelObject.activeSelf) RefreshStatus();
        }

        public void Hide()
        {
            // M01: корень остаётся в памяти, скрываются только дочерние панели.
            if (promptObject != null) promptObject.SetActive(false);
            if (panelObject != null) panelObject.SetActive(false);
            if (root != null) root.gameObject.SetActive(false);
        }

        private void OnDestroy()
        {
            if (instance == this) instance = null;
        }

        /// <summary>Единственный легальный путь открытия панели — ввод кода.</summary>
        public static void PromptGlobal()
        {
            if (instance == null) return;
            instance.root.gameObject.SetActive(true);
            instance.promptObject.SetActive(true);
            instance.panelObject.SetActive(false);
            instance.statusText.text = string.Empty;
            if (instance.codeInput != null)
            {
                instance.codeInput.text = string.Empty;
                instance.codeInput.ActivateInputField();
            }
        }

        public static bool IsUnlockedGlobal => instance != null && instance.authenticated &&
                                               UiReflection.AsBool(UiReflection.GetMember(UiApi.Admin, "IsUnlocked", "IsOpen"));
    }
}
