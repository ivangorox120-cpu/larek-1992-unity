using System;
using System.Collections;
using UnityEngine;
using UnityEngine.UI;

namespace Larek.UI
{
    /// <summary>
    /// Титульный экран в стиле оригинала: год, логотип, гимн, кнопки «Продолжить»,
    /// «Новая игра» и «Настройки». Действия не требуют жёсткой ссылки на GameSession —
    /// они вызываются рефлексией, если система игры уже загружена.
    /// </summary>
    public sealed class TitleScreenController : MonoBehaviour
    {
        private static TitleScreenController instance;

        private RectTransform root;
        private CanvasGroup group;
        private RectTransform buttonsRoot;
        private Text loadInfo;
        private Text clockText;
        private Button continueButton;
        private bool busy;

        public static bool IsVisible => instance != null && instance.root != null && instance.root.gameObject.activeSelf;

        public static TitleScreenController Ensure(Transform parent)
        {
            if (instance != null) return instance;
            instance = FindObjectOfType<TitleScreenController>();
            if (instance != null) return instance;
            GameObject go = new GameObject("Главное меню", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            instance = go.AddComponent<TitleScreenController>();
            instance.Build();
            return instance;
        }

        private void Awake()
        {
            if (instance == null) instance = this;
        }

        private void Build()
        {
            root = UiFactory.Full("Титульный экран", transform);
            group = root.gameObject.AddComponent<CanvasGroup>();
            UiFactory.AddImage(root, new Color32(7, 10, 12, 255), true);

            for (int i = 0; i < 8; i++)
            {
                RectTransform bar = UiFactory.NewRect("Полоса " + i, root, new Vector2(0f, 1f), new Vector2(1f, 1f),
                    new Vector2(0f, -40f - i * 78f), new Vector2(0f, 1f));
                UiFactory.AddImage(bar, new Color(0.85f, 0.72f, 0.35f, i % 3 == 0 ? 0.07f : 0.025f), false);
            }

            UiFactory.AddText(UiFactory.NewRect("Год", root, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f),
                new Vector2(0f, -74f), new Vector2(1000f, 36f)),
                "РОССИЯ · КРАСНОЗАВОДСК · ЯНВАРЬ 1992", 16, UiFactory.Accent, TextAnchor.MiddleCenter, FontStyle.Bold);

            RectTransform logo = UiFactory.NewRect("Логотип", root, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f),
                new Vector2(0f, -180f), new Vector2(900f, 170f));
            string[] letters = { "Л", "А", "Р", "Ё", "К" };
            for (int i = 0; i < letters.Length; i++)
            {
                UiFactory.AddText(UiFactory.NewRect("Буква " + i, logo, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f),
                    new Vector2(-250f + i * 125f, 0f), new Vector2(120f, 160f)), letters[i], 118,
                    i == 3 ? UiFactory.Red : UiFactory.Text, TextAnchor.MiddleCenter, FontStyle.Bold);
            }

            UiFactory.AddText(UiFactory.NewRect("Описание", root, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f),
                new Vector2(0f, -288f), new Vector2(860f, 60f)),
                "Индустриальная зима 1992-го. Огромный долг «заводским» ($2 500), криминальные качели и борьба за район.",
                15, UiFactory.Text, TextAnchor.MiddleCenter);

            UiFactory.AddText(UiFactory.NewRect("Гимн", root, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f),
                new Vector2(0f, -338f), new Vector2(900f, 30f)),
                "🎺 Гимн РФ 1992 г. · М. И. Глинка «Патриотическая песня» (инструментал)",
                12, UiFactory.Muted, TextAnchor.MiddleCenter);

            buttonsRoot = UiFactory.NewRect("Кнопки меню", root, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f),
                new Vector2(0f, -60f), new Vector2(620f, 190f));
            VerticalLayoutGroup layout = buttonsRoot.gameObject.AddComponent<VerticalLayoutGroup>();
            layout.spacing = 10f;
            layout.childForceExpandWidth = true;
            layout.childControlWidth = true;
            layout.childControlHeight = false;
            layout.childForceExpandHeight = false;

            continueButton = AddMenuButton("Продолжить", "День 1 · 6 января 1992", ContinueGame, UiFactory.Green);
            AddMenuButton("Новая игра", "долг $2 500 · без финала", NewGame, new Color32(90, 31, 24, 255));
            AddMenuButton("Настройки", "графика · звук · управление", OpenSettings, new Color32(29, 51, 70, 255));

            loadInfo = UiFactory.AddText(UiFactory.NewRect("Загрузка", root, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f),
                new Vector2(0f, 78f), new Vector2(840f, 28f)), string.Empty, 12, UiFactory.Muted, TextAnchor.MiddleCenter);

            RectTransform clock = UiFactory.NewRect("Часы", root, new Vector2(0f, 0f), new Vector2(0f, 0f),
                new Vector2(24f, 22f), new Vector2(160f, 26f));
            clockText = UiFactory.AddText(clock, "● 18:12", 13, UiFactory.Red, TextAnchor.MiddleLeft, FontStyle.Bold);
            UiFactory.AddText(UiFactory.NewRect("Место", root, new Vector2(1f, 0f), new Vector2(1f, 0f),
                new Vector2(-22f, 22f), new Vector2(340f, 26f)), "Ул. Советская · Промзона 1992", 12, UiFactory.Muted, TextAnchor.MiddleRight);
            UiFactory.AddText(UiFactory.NewRect("Подвал", root, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f),
                new Vector2(0f, 8f), new Vector2(900f, 22f)),
                "Бесконечная песочница 1992 г. · все персонажи, фирмы и бренды вымышлены",
                11, UiFactory.Muted, TextAnchor.MiddleCenter);
        }

        private Button AddMenuButton(string title, string subtitle, Action action, Color color)
        {
            RectTransform row = UiFactory.Row(buttonsRoot, "Кнопка " + title, 54f);
            Button button = UiFactory.AddButton(row, color, action, UiFactory.Line2);
            UiFactory.AddText(UiFactory.NewRect("Название", row, new Vector2(0f, 0.5f), new Vector2(0f, 0.5f),
                new Vector2(14f, 6f), new Vector2(560f, 26f)), title, 17, UiFactory.Text, TextAnchor.MiddleLeft, FontStyle.Bold);
            UiFactory.AddText(UiFactory.NewRect("Описание", row, new Vector2(0f, 0.5f), new Vector2(0f, 0.5f),
                new Vector2(14f, -12f), new Vector2(560f, 20f)), subtitle, 11, UiFactory.Muted, TextAnchor.MiddleLeft);
            UiFactory.AddText(UiFactory.NewRect("Стрелка", row, new Vector2(1f, 0.5f), new Vector2(1f, 0.5f),
                new Vector2(-24f, 0f), new Vector2(40f, 30f)), "➔", 16, UiFactory.Accent, TextAnchor.MiddleCenter);
            return button;
        }

        private void Start()
        {
            Refresh();
        }

        private void Update()
        {
            if (root == null || !root.gameObject.activeSelf) return;
            clockText.text = "● " + DateTime.Now.ToString("HH:mm");
        }

        private void Refresh()
        {
            if (continueButton == null) return;
            bool hasSave = HasSave();
            continueButton.gameObject.SetActive(hasSave);
            loadInfo.text = UiApi.Session == null
                ? "Подгрузка 3D-мира, заводов, ассетов и скриптов…"
                : string.Empty;
        }

        private static bool HasSave()
        {
            return UiApi.HasSave();
        }

        private void NewGame()
        {
            if (busy) return;
            StartCoroutine(StartGame(true));
        }

        private void ContinueGame()
        {
            if (busy) return;
            StartCoroutine(StartGame(false));
        }

        private IEnumerator StartGame(bool fresh)
        {
            busy = true;
            ModalController.FadeGlobal(1f, 0.28f);
            yield return new WaitForSecondsRealtime(0.3f);

            object session = UiApi.Session;
            if (session == null)
            {
                HudController.ShowToastGlobal("Игра ещё загружается — попробуйте ещё раз.", 2);
            }
            else if (fresh)
            {
                // GameSession.NewGame — статический метод с необязательным параметром.
                UiApi.StartNewGame();
            }
            else
            {
                UiApi.ContinueGame();
            }

            Hide();
            ModalController.FadeGlobal(0f, 0.4f);
            busy = false;
        }

        private void OpenSettings()
        {
            SheetController.OpenGlobal(0);
        }

        public void Show()
        {
            if (root == null) Build();
            root.gameObject.SetActive(true);
            group.alpha = 1f;
            Refresh();
        }

        public void Hide()
        {
            if (root != null) root.gameObject.SetActive(false);
        }

        private void OnDestroy()
        {
            if (instance == this) instance = null;
        }

        public static void ShowGlobal()
        {
            if (instance != null) instance.Show();
        }

        public static void HideGlobal()
        {
            if (instance != null) instance.Hide();
        }
    }
}
