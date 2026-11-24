using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace Larek.UI
{
    public sealed class ModalButton
    {
        public readonly string Label;
        public readonly Action Action;

        public ModalButton(string label, Action action)
        {
            Label = label;
            Action = action;
        }
    }

    public sealed class ModalController : MonoBehaviour
    {
        private sealed class Card
        {
            public string Title;
            public string Body;
            public List<ModalButton> Buttons;
            public Action OnShow;
        }

        private static ModalController instance;

        private RectTransform root;
        private RectTransform modal;
        private RectTransform bodyContainer;
        private Text titleText;
        private Text bodyText;
        private RectTransform buttonsRoot;
        private CanvasGroup fadeGroup;
        private readonly Queue<Card> queue = new Queue<Card>();
        private bool showing;

        public static ModalController Ensure(Transform parent)
        {
            if (instance != null) return instance;
            instance = FindObjectOfType<ModalController>();
            if (instance != null) return instance;
            GameObject go = new GameObject("Модальные окна", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            instance = go.AddComponent<ModalController>();
            instance.Build();
            return instance;
        }

        private void Awake()
        {
            if (instance == null) instance = this;
        }

        private void Build()
        {
            root = UiFactory.Full("Слой модальных окон", transform);

            RectTransform shade = UiFactory.Full("Затемнение", root);
            UiFactory.AddImage(shade, new Color(0f, 0f, 0f, 0.78f), true);

            modal = UiFactory.NewRect("Окно", root, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(560f, 620f));
            UiFactory.AddImage(modal, UiFactory.Panel2, true);
            Outline edge = modal.gameObject.AddComponent<Outline>();
            edge.effectColor = UiFactory.Line2;
            edge.effectDistance = new Vector2(1f, -1f);

            titleText = UiFactory.AddText(UiFactory.NewRect("Заголовок", modal, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, -26f), new Vector2(520f, 40f)),
                string.Empty, 19, UiFactory.Text, TextAnchor.MiddleLeft, FontStyle.Bold);
            titleText.transform.SetParent(modal, false);

            bodyContainer = UiFactory.ScrollView("Текст окна", modal, new Vector2(0f, -32f), new Vector2(520f, 430f), out RectTransform content);
            bodyContainer.anchorMin = new Vector2(0.5f, 1f);
            bodyContainer.anchorMax = new Vector2(0.5f, 1f);
            bodyContainer.pivot = new Vector2(0.5f, 1f);
            bodyText = UiFactory.AddText(content, string.Empty, 14, UiFactory.Text, TextAnchor.UpperLeft);
            bodyText.horizontalOverflow = HorizontalWrapMode.Wrap;
            bodyText.lineSpacing = 1.25f;
            LayoutElement bodyElement = bodyText.gameObject.AddComponent<LayoutElement>();
            bodyElement.minHeight = 70f;
            bodyElement.preferredHeight = 350f;

            buttonsRoot = UiFactory.NewRect("Кнопки", modal, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(0f, 20f), new Vector2(520f, 120f));
            buttonsRoot.pivot = new Vector2(0.5f, 0f);
            VerticalLayoutGroup layout = buttonsRoot.gameObject.AddComponent<VerticalLayoutGroup>();
            layout.spacing = 7f;
            layout.childControlWidth = true;
            layout.childForceExpandWidth = true;
            layout.childControlHeight = false;
            layout.childForceExpandHeight = false;

            RectTransform fade = UiFactory.Full("Затухание", root);
            fadeGroup = fade.gameObject.AddComponent<CanvasGroup>();
            fadeGroup.blocksRaycasts = false;
            fadeGroup.alpha = 0f;

            modal.gameObject.SetActive(false);
        }

        public void Show(string title, string body, params ModalButton[] buttons)
        {
            var card = new Card
            {
                Title = title ?? string.Empty,
                Body = body ?? string.Empty,
                Buttons = buttons != null && buttons.Length > 0
                    ? new List<ModalButton>(buttons)
                    : new List<ModalButton> { new ModalButton("Дальше", null) }
            };
            queue.Enqueue(card);
            if (!showing) StartCoroutine(ShowNext());
        }

        public void ShowMessageBox(string title, string body, string buttonLabel = "Понятно", Action action = null)
        {
            Show(title, body, new ModalButton(buttonLabel ?? "Понятно", action));
        }

        private IEnumerator ShowNext()
        {
            showing = true;
            while (queue.Count > 0)
            {
                Card card = queue.Dequeue();
                titleText.text = card.Title;
                bodyText.text = card.Body;
                UiFactory.Clear(buttonsRoot);

                foreach (ModalButton button in card.Buttons)
                {
                    Button uiButton = UiFactory.Button(buttonsRoot, button.Label, Vector2.zero, new Vector2(500f, 42f), () =>
                    {
                        Action callback = button.Action;
                        Hide();
                        callback?.Invoke();
                    }, new Color32(29, 35, 36, 255), 14);
                    LayoutElement element = uiButton.gameObject.AddComponent<LayoutElement>();
                    element.preferredHeight = 42f;
                }

                modal.gameObject.SetActive(true);
                card.OnShow?.Invoke();
                // Окно остаётся открытым, пока игрок не выберет кнопку.
                while (modal.gameObject.activeSelf) yield return null;
                yield return null;
            }
            showing = false;
        }

        public void Hide()
        {
            modal.gameObject.SetActive(false);
        }

        public void Fade(float target, float duration, Action done = null)
        {
            StartCoroutine(FadeRoutine(target, Mathf.Max(0.01f, duration), done));
        }

        private IEnumerator FadeRoutine(float target, float duration, Action done)
        {
            float from = fadeGroup.alpha;
            float elapsed = 0f;
            while (elapsed < duration)
            {
                elapsed += Time.unscaledDeltaTime;
                fadeGroup.alpha = Mathf.Lerp(from, target, Mathf.Clamp01(elapsed / duration));
                yield return null;
            }
            fadeGroup.alpha = target;
            done?.Invoke();
        }

        private void OnDestroy()
        {
            if (instance == this) instance = null;
        }

        public static void ShowGlobal(string title, string body, params ModalButton[] buttons)
        {
            if (instance != null) instance.Show(title, body, buttons);
        }

        public static void MessageBoxGlobal(string title, string body, string buttonLabel = "Понятно", Action action = null)
        {
            if (instance != null) instance.ShowMessageBox(title, body, buttonLabel, action);
        }

        public static void FadeGlobal(float target, float duration, Action done = null)
        {
            if (instance != null) instance.Fade(target, duration, done);
        }
    }
}
