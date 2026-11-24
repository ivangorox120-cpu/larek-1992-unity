using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;
using Larek.Economy;
using UnityEngine;
using UnityEngine.UI;

namespace Larek.UI
{
    /// <summary>
    /// Чтение газет «ПРАВДА» и «ИЗВЕСТИЯ» — четыре полосы с теми же заголовками
    /// и статьями, что и в оригинальной HTML-версии. Картинки не загружаются, вместо
    /// них печатается подпись к иллюстрации.
    /// </summary>
    public sealed class PaperReaderController : MonoBehaviour
    {
        private sealed class Article
        {
            public readonly string Heading;
            public readonly string Illustration;
            public readonly string Body;

            public Article(string heading, string body, string illustration = null)
            {
                Heading = heading;
                Body = body;
                Illustration = illustration;
            }
        }

        private sealed class Issue
        {
            public readonly string Title;
            public readonly string Subtitle;
            public readonly string Lead;
            public readonly Article[] Articles;

            public Issue(string title, string subtitle, string lead, Article[] articles)
            {
                Title = title;
                Subtitle = subtitle;
                Lead = lead;
                Articles = articles;
            }
        }

        private static readonly Issue Pravda = new Issue(
            "ПРАВДА",
            "Газета основана 5 мая 1912 года В. И. Лениным · Суббота, 28 ноября 1992 года · № 177 (26931) · Цена свободная",
            "С ЧЕМ ИДЕМ К СЪЕЗДУ: Полярный настрой · Та же колода",
            new[]
            {
                new Article("Полярный настрой и «Та же колода»",
                    "В канун VII съезда народных депутатов России политические страсти накалились до предела. Правительственный курс «шоковой терапии» привёл к обвальному росту цен и падению производства на крупнейших предприятиях страны. В очередях у коммерческих ларьков и государственных магазинов люди задают один вопрос: останется ли прежняя колода реформаторов у руля или съезд потребует смены экономического курса?",
                    "Рис. Александра УМЯРОВА: «Та же колода» у съездовской трибуны."),
                new Article("Краснов с Красной Пресни (Красный телефон: 257-30-20)",
                    "Прежде чем он объявит перерыв и журналисты бросятся к микрофонам, Александр Краснов — председатель Краснопресненского райсовета — прямо говорит о судьбе приватизации, ваучерах и муниципальной торговле: «Людям нужны не громкие обещания, а твёрдый рубль, работающие заводы и доступные продукты первой необходимости на каждом углу».",
                    "А. Краснов на прямой линии с читателями."),
                new Article("Коротко и ясно · Цитаты дня",
                    "• Егор ГАЙДАР: «Инфляция остаётся главным вызовом нынешней зимы, однако возврата к старой распределительной системе уже не будет».\n• «Правда» возвращает подписчиков: несмотря на взвинченные тарифы связистов и подорожание бумаги, тысячи читателей по всей стране продолжают выписывать газету.\n• В Минске чтут СССР: ветераны и рабочие делегации обсуждают сохранение кооперационных связей между заводами."),
                new Article("Субботний репортаж: «Ведь это наши горы» · «Купить город можно ...в Польше. А у нас?»",
                    "Пока на прилавках коммерческих киосков появляются импортные батончики, жвачки и кассеты, отечественные заводы вынуждены рассчитываться с рабочими по бартеру — тушёнкой, сгущёнкой и пивом собственного разлива. Предприимчивые торговцы закупают заводские партии напрямую со складов сбыта со скидкой 20%.",
                    "Зарубежная пресса о политической обстановке в России.")
            });

        private static readonly Issue Izvestia = new Issue(
            "ИЗВЕСТИЯ",
            "Газета выходит с марта 1917 года · Понедельник, 27 июля 1992 года · № 170 (23744) · Московский вечерний выпуск",
            "ВНУТРЕННИЕ РАСПРИ В СТАНЕ ДЕМОКРАТОВ УСИЛИВАЮТ УГРОЗУ РЕФОРМАМ",
            new[]
            {
                new Article("Внутренние распри в стане демократов усиливают угрозу реформам",
                    "Экономическая реформа вступила в самую сложную полосу: свободные цены и курс доллара меняются каждую неделю, а промышленное лобби требует льготных кредитов для заводов. Эксперты предупреждают: кто держит сбережения в твёрдой валюте и вовремя обновляет ассортимент, тот переживёт любые скачки инфляции.",
                    "Редакторы «Файнэншл таймс» и «Известий» с пилотным выпуском газеты."),
                new Article("Стартовал русско-французский космический экипаж · Первые победы в Барселоне",
                    "С космодрома Байконур успешно стартовал корабль «Союз ТМ-15» с международным экипажем на борту. А в Барселоне на Олимпиаде-92 в первый же день прозвучали гимны в честь наших пловцов и гимнастов.",
                    "Барселона-92: первые олимпийские медали на водных дорожках."),
                new Article("«Файнэншл таймс» и «Известия» объединяют усилия для выпуска новой газеты",
                    "Совместный финансово-экономический выпуск призван помочь новым российским предпринимателям, кооператорам и владельцам торговых точек ориентироваться в рыночной конъюнктуре, оптовых ценах и валютных курсах.",
                    "Острый штрих недели."),
                new Article("От наших корреспондентов: Клиенты Внешэкономбанка и товарные биржи",
                    "• Клиенты Внешэкономбанка, кажется, могут готовить кошельки: обсуждается порядок выплат по замороженным валютным счетам.\n• Ставропольский хлеб идёт на торги: закупочные цены нового урожая определят стоимость хлеба и продуктов в рознице на ближайшие месяцы.\n• Коммерческие киоски переходят на круглосуточный график работы у автобусных остановок.")
            });

        private static readonly string[] TabLabels =
        {
            "ПРАВДА · Полоса 1", "ПРАВДА · Полоса 2", "ИЗВЕСТИЯ · Полоса 1", "ИЗВЕСТИЯ · Полоса 2"
        };

        private static PaperReaderController instance;

        private RectTransform root;
        private RectTransform leftContent;
        private RectTransform rightContent;
        private Text masthead;
        private Text subtitle;
        private Text lead;
        private Text zoomLabel;
        private readonly Button[] tabButtons = new Button[TabLabels.Length];
        private int currentPage;
        private float zoom = 1f;

        public static PaperReaderController Ensure(Transform parent)
        {
            if (instance != null) return instance;
            instance = FindObjectOfType<PaperReaderController>();
            if (instance != null) return instance;
            GameObject go = new GameObject("Газеты", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            instance = go.AddComponent<PaperReaderController>();
            instance.Build();
            return instance;
        }

        private void Awake()
        {
            if (instance == null) instance = this;
        }

        private void Build()
        {
            root = UiFactory.Full("Слой газеты", transform);
            UiFactory.AddImage(UiFactory.Full("Затемнение", root), new Color(0f, 0f, 0f, 0.66f), true);

            RectTransform paper = UiFactory.NewRect("Газета", root, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f),
                Vector2.zero, new Vector2(1000f, 640f));
            UiFactory.AddImage(paper, new Color32(224, 216, 191, 255), true);
            Outline edge = paper.gameObject.AddComponent<Outline>();
            edge.effectColor = new Color32(48, 43, 34, 255);
            edge.effectDistance = new Vector3(3f, -3f);
            UiFactory.AddImage(UiFactory.NewRect("Сгиб", paper, new Vector2(0.5f, 0f), new Vector2(0.5f, 1f),
                Vector2.zero, new Vector2(2f, 0f)), new Color32(120, 112, 92, 120), false);

            RectTransform tabs = UiFactory.NewRect("Полосы", paper, new Vector2(0f, 1f), new Vector2(1f, 1f),
                new Vector2(0f, -18f), new Vector2(0f, 30f));
            UiFactory.Stretch(tabs, 24f, 24f, 0f, 0f);
            HorizontalLayoutGroup tabLayout = tabs.gameObject.AddComponent<HorizontalLayoutGroup>();
            tabLayout.spacing = 4f;
            tabLayout.childForceExpandWidth = true;
            tabLayout.childControlWidth = true;
            for (int i = 0; i < TabLabels.Length; i++)
            {
                int index = i;
                Button button = UiFactory.Button(tabs, TabLabels[i], Vector2.zero, new Vector2(220f, 28f),
                    () => SelectPage(index), new Color32(206, 199, 175, 255), 11, UiFactory.PaperInk);
                LayoutElement element = button.gameObject.AddComponent<LayoutElement>();
                element.preferredWidth = 220f;
                tabButtons[i] = button;
            }

            masthead = UiFactory.AddText(UiFactory.NewRect("Заголовок", paper, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f),
                new Vector2(0f, -56f), new Vector2(900f, 42f)), "ПРАВДА", 34, new Color32(24, 21, 17, 255), TextAnchor.MiddleCenter, FontStyle.Bold);
            subtitle = UiFactory.AddText(UiFactory.NewRect("Выпуск", paper, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f),
                new Vector2(0f, -84f), new Vector2(920f, 22f)), string.Empty, 11, new Color32(51, 45, 36, 255), TextAnchor.MiddleCenter);
            lead = UiFactory.AddText(UiFactory.NewRect("Лидер", paper, new Vector2(0f, 1f), new Vector2(1f, 1f),
                new Vector2(0f, -112f), new Vector2(-48f, 36f)), string.Empty, 15, new Color32(24, 21, 17, 255), TextAnchor.MiddleCenter, FontStyle.Bold);

            RectTransform columns = UiFactory.NewRect("Колонки", paper, new Vector2(0f, 0f), new Vector2(1f, 1f),
                new Vector2(0f, 0f), new Vector2(0f, -128f));
            UiFactory.Stretch(columns, 24f, 24f, 128f, 24f);

            RectTransform left = UiFactory.NewRect("Левая колонка", columns, new Vector2(0f, 0f), new Vector2(0.5f, 1f), Vector2.zero, Vector2.zero);
            UiFactory.Stretch(left, 0f, 6f, 0f, 0f);
            UiFactory.ScrollView("Левая полоса", left, Vector2.zero, Vector2.zero, out leftContent);
            RectTransform leftScroll = left.GetChild(0) as RectTransform;
            if (leftScroll != null) UiFactory.Stretch(leftScroll, 0f, 0f, 0f, 0f);

            RectTransform right = UiFactory.NewRect("Правая колонка", columns, new Vector2(0.5f, 0f), new Vector2(1f, 1f), Vector2.zero, Vector2.zero);
            UiFactory.Stretch(right, 6f, 0f, 0f, 0f);
            UiFactory.ScrollView("Правая полоса", right, Vector2.zero, Vector2.zero, out rightContent);
            RectTransform rightScroll = right.GetChild(0) as RectTransform;
            if (rightScroll != null) UiFactory.Stretch(rightScroll, 0f, 0f, 0f, 0f);

            RectTransform bar = UiFactory.NewRect("Панель кнопок", root, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f),
                new Vector2(0f, 24f), new Vector2(720f, 40f));
            bar.pivot = new Vector2(0.5f, 0f);
            HorizontalLayoutGroup barLayout = bar.gameObject.AddComponent<HorizontalLayoutGroup>();
            barLayout.spacing = 8f;
            barLayout.childForceExpandWidth = true;
            AddBarButton(bar, "Листать полосу ➔", NextPage);
            zoomLabel = AddBarButton(bar, "Шрифт ×1.0", ChangeZoom);
            AddBarButton(bar, "Убрать газету", Close);

            root.gameObject.SetActive(false);
            Render();
        }

        private static Text AddBarButton(Transform parent, string caption, Action action)
        {
            Button button = UiFactory.Button(parent, caption, Vector2.zero, new Vector2(230f, 36f), action,
                new Color32(29, 35, 36, 255), 13);
            LayoutElement element = button.gameObject.AddComponent<LayoutElement>();
            element.preferredWidth = 230f;
            element.preferredHeight = 36f;
            return button.GetComponentInChildren<Text>();
        }

        private void SelectPage(int index)
        {
            currentPage = ((index % TabLabels.Length) + TabLabels.Length) % TabLabels.Length;
            Render();
        }

        private void NextPage()
        {
            SelectPage(currentPage + 1);
        }

        private void ChangeZoom()
        {
            zoom = zoom >= 1.5f ? 0.85f : zoom + 0.15f;
            if (zoomLabel != null) zoomLabel.text = "Шрифт ×" + zoom.ToString("0.0", CultureInfo.InvariantCulture);
            Render();
        }

        private void Render()
        {
            if (masthead == null) return;
            bool pravda = currentPage < 2;
            Issue issue = pravda ? Pravda : Izvestia;
            bool pageOne = currentPage % 2 == 0;

            masthead.text = issue.Title;
            subtitle.text = issue.Subtitle;
            lead.text = issue.Lead;
            for (int i = 0; i < tabButtons.Length; i++)
            {
                Image image = tabButtons[i].GetComponent<Image>();
                if (image != null)
                    image.color = i == currentPage ? new Color32(172, 160, 122, 255) : new Color32(206, 199, 175, 255);
            }

            UiFactory.Clear(leftContent);
            UiFactory.Clear(rightContent);
            Article[] a = issue.Articles;
            if (pageOne)
            {
                AddArticle(leftContent, a[0]);
                AddArticle(leftContent, a[2]);
                AddArticle(rightContent, a[1]);
                AddArticle(rightContent, a[3]);
            }
            else
            {
                AddArticle(leftContent, a[3]);
                AddArticle(leftContent, a[1]);
                AddArticle(rightContent, a[2]);
                AddArticle(rightContent, a[0]);
            }
            AddMarketNote(rightContent);
        }

        private void AddArticle(Transform content, Article article)
        {
            if (article == null) return;
            int size = Mathf.RoundToInt(12f * zoom);
            RectTransform row = UiFactory.Row(content, "Статья " + article.Heading, 120f);
            row.GetComponent<LayoutElement>().preferredHeight = 60f + article.Body.Length / 6f * zoom;
            Text head = UiFactory.AddText(UiFactory.NewRect("Заголовок", row, new Vector2(0f, 1f), new Vector2(1f, 1f),
                new Vector2(0f, -6f), new Vector2(0f, 34f)), article.Heading, size + 2, new Color32(22, 19, 15, 255),
                TextAnchor.UpperLeft, FontStyle.Bold);
            head.horizontalOverflow = HorizontalWrapMode.Wrap;
            if (!string.IsNullOrEmpty(article.Illustration))
            {
                Text illo = UiFactory.AddText(UiFactory.NewRect("Иллюстрация", row, new Vector2(0f, 1f), new Vector2(1f, 1f),
                    new Vector2(0f, -34f), new Vector2(0f, 30f)), "▣ " + article.Illustration, size - 2,
                    new Color32(84, 75, 58, 255), TextAnchor.UpperLeft);
                illo.horizontalOverflow = HorizontalWrapMode.Wrap;
            }
            float top = string.IsNullOrEmpty(article.Illustration) ? 34f : 64f;
            Text body = UiFactory.AddText(UiFactory.NewRect("Текст", row, new Vector2(0f, 1f), new Vector2(1f, 1f),
                new Vector2(0f, -top), new Vector2(0f, 400f)), article.Body, size, new Color32(31, 27, 21, 255), TextAnchor.UpperLeft);
            body.horizontalOverflow = HorizontalWrapMode.Wrap;
            body.lineSpacing = 1.18f;
        }

        private static void AddMarketNote(Transform content)
        {
            KioskEconomy economy = UiApi.KioskEconomy;
            var note = new StringBuilder();
            note.Append("📌 КОММЕРЧЕСКИЙ ВЕСТНИК РАЙОНА (1992 г.)\n");
            note.Append("• Курс доллара: 1 $ = ").Append(economy != null ? economy.ExchangeRate : 110).Append(" ₽ · Индекс цен: ×")
                .Append(economy != null ? economy.PriceIndex.ToString("0.00", CultureInfo.InvariantCulture) : "1.00").Append('\n');
            note.Append("• Повышенный спрос: Сигареты «Космонавт», Пиво «Заводское» и Хлеб\n");
            note.Append("• На маршруте автобуса №7 (ул. Заводская — Завод) движение по расписанию, у проходной открыт отдел сбыта.");

            RectTransform row = UiFactory.Row(content, "Коммерческий вестник", 96f);
            UiFactory.AddImage(row, new Color32(206, 200, 184, 255), true);
            Text text = UiFactory.AddText(row, note.ToString(), 11, new Color32(37, 32, 25, 255), TextAnchor.UpperLeft);
            text.horizontalOverflow = HorizontalWrapMode.Wrap;
            text.lineSpacing = 1.15f;
        }

        private void Update()
        {
            if (root == null || !root.gameObject.activeSelf) return;
            if (Input.GetKeyDown(KeyCode.Escape)) Close();
        }

        public void Show(int page = 0)
        {
            if (root == null) Build();
            currentPage = Mathf.Clamp(page, 0, TabLabels.Length - 1);
            root.gameObject.SetActive(true);
            if (zoomLabel != null) zoomLabel.text = "Шрифт ×" + zoom.ToString("0.0", CultureInfo.InvariantCulture);
            Render();
        }

        public void Close()
        {
            if (root != null) root.gameObject.SetActive(false);
        }

        private void OnDestroy()
        {
            if (instance == this) instance = null;
        }

        public static void ShowGlobal(int page = 0)
        {
            if (instance != null) instance.Show(page);
        }
    }
}
