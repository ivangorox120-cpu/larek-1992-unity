using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;

namespace Larek.UI
{
    /// <summary>
    /// Нижняя панель диалога с «печатной машинкой» и вариантами ответа.
    /// Диалоги movestudio подключаются через рефлексию: сборка может не содержать
    /// систему диалогов, и тогда панель просто остаётся скрытой.
    /// </summary>
    public sealed class DialogController : MonoBehaviour
    {
        private const float CharDelay = 0.02f;
        private const int MaxOptions = 6;

        private static DialogController instance;

        private RectTransform root;
        private RectTransform panel;
        private Text speakerText;
        private Text bodyText;
        private Text counterText;
        private Button nextButton;
        private Text nextLabel;
        private RectTransform optionsRoot;
        private readonly Button[] optionButtons = new Button[MaxOptions];
        private readonly Text[] optionLabels = new Text[MaxOptions];

        private object currentDialogue;
        private string[] lines = Array.Empty<string>();
        private string[] options = Array.Empty<string>();
        private int[] optionIndices = Array.Empty<int>();
        private int lineIndex;
        private int visibleChars;
        private float charTimer;
        private bool optionsShown;
        private object subscribedDialogues;
        private List<Delegate> dialogueTokens = new List<Delegate>();

        public static bool IsOpenGlobal => instance != null && instance.root != null && instance.root.gameObject.activeSelf;

        public static DialogController Ensure(Transform parent)
        {
            if (instance != null) return instance;
            instance = FindObjectOfType<DialogController>();
            if (instance != null) return instance;
            GameObject go = new GameObject("Диалоги", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            instance = go.AddComponent<DialogController>();
            instance.Build();
            return instance;
        }

        private void Awake()
        {
            if (instance == null) instance = this;
        }

        private void Build()
        {
            root = UiFactory.Full("Слой диалога", transform);

            panel = UiFactory.NewRect("Панель диалога", root, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f),
                new Vector2(0f, 28f), new Vector2(860f, 340f));
            panel.pivot = new Vector2(0.5f, 0f);
            UiFactory.AddImage(panel, new Color32(9, 11, 12, 244), true);
            Outline edge = panel.gameObject.AddComponent<Outline>();
            edge.effectColor = UiFactory.Accent;
            edge.effectDistance = new Vector2(2f, -2f);

            speakerText = UiFactory.AddText(UiFactory.NewRect("Имя", panel, new Vector2(0f, 1f), new Vector2(1f, 1f),
                new Vector2(0f, -26f), new Vector2(-52f, 36f)), "РАЗГОВОР", 20, UiFactory.Accent, TextAnchor.MiddleLeft, FontStyle.Bold);
            counterText = UiFactory.AddText(UiFactory.NewRect("Счётчик", panel, new Vector2(1f, 1f), new Vector2(1f, 1f),
                new Vector2(-24f, -26f), new Vector2(110f, 30f)), string.Empty, 13, UiFactory.Muted, TextAnchor.MiddleRight);

            bodyText = UiFactory.AddText(UiFactory.NewRect("Реплика", panel, new Vector2(0f, 1f), new Vector2(1f, 1f),
                new Vector2(0f, -50f), new Vector2(-48f, 180f)), string.Empty, 19, UiFactory.Text, TextAnchor.UpperLeft);
            bodyText.horizontalOverflow = HorizontalWrapMode.Wrap;
            bodyText.verticalOverflow = VerticalWrapMode.Truncate;
            bodyText.lineSpacing = 1.2f;

            optionsRoot = UiFactory.NewRect("Варианты", panel, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f),
                new Vector2(0f, 68f), new Vector2(800f, 108f));
            optionsRoot.pivot = new Vector2(0.5f, 0f);
            VerticalLayoutGroup optionsLayout = optionsRoot.gameObject.AddComponent<VerticalLayoutGroup>();
            optionsLayout.spacing = 5f;
            optionsLayout.childControlWidth = true;
            optionsLayout.childForceExpandWidth = true;
            optionsLayout.childControlHeight = false;
            optionsLayout.childForceExpandHeight = false;
            optionsLayout.childAlignment = TextAnchor.LowerCenter;

            for (int i = 0; i < MaxOptions; i++)
            {
                int index = i;
                Button button = UiFactory.Button(optionsRoot, string.Empty, Vector2.zero, new Vector2(780f, 30f),
                    () => SelectOption(index), new Color32(24, 30, 32, 250), 13, UiFactory.Accent);
                LayoutElement element = button.gameObject.AddComponent<LayoutElement>();
                element.preferredHeight = 30f;
                optionButtons[i] = button;
                optionLabels[i] = button.GetComponentInChildren<Text>();
                button.gameObject.SetActive(false);
            }

            nextButton = UiFactory.Button(panel, "ДАЛЬШЕ", new Vector2(-112f, 20f), new Vector2(150f, 38f),
                OnNext, new Color32(76, 39, 26, 255), 14);
            nextLabel = nextButton.GetComponentInChildren<Text>();

            UiFactory.AddText(UiFactory.NewRect("Подсказка", panel, new Vector2(0f, 0f), new Vector2(0f, 0f),
                new Vector2(28f, 22f), new Vector2(380f, 26f)),
                "ПРОБЕЛ — продолжить · ESC — закрыть", 12, UiFactory.Muted, TextAnchor.MiddleLeft);

            root.gameObject.SetActive(false);
        }

        private void Start()
        {
            Resubscribe();
        }

        private void Update()
        {
            Resubscribe();

            object active = UiApi.CurrentDialogue;
            if (active != null && !ReferenceEquals(active, currentDialogue) && !root.gameObject.activeSelf)
                Open(active, null, null, null);

            if (!root.gameObject.activeSelf) return;

            if (Input.GetKeyDown(KeyCode.Escape))
            {
                Close();
                return;
            }
            if (Input.GetKeyDown(KeyCode.Space) || Input.GetKeyDown(KeyCode.Return))
            {
                OnNext();
                return;
            }

            if (lines.Length == 0 || optionsShown || lineIndex >= lines.Length) return;
            string full = lines[lineIndex];
            if (visibleChars >= full.Length) return;

            charTimer += Time.unscaledDeltaTime;
            while (charTimer >= CharDelay && visibleChars < full.Length)
            {
                charTimer -= CharDelay;
                visibleChars++;
            }
            bodyText.text = full.Substring(0, visibleChars);
        }

        private void Resubscribe()
        {
            object dialogues = UiApi.Dialogues;
            if (ReferenceEquals(dialogues, subscribedDialogues)) return;
            if (dialogueTokens.Count > 0)
                UiReflection.UnsubscribeEvent(subscribedDialogues, null,
                    new[] { "Started", "DialogueStarted", "OnDialogueStart", "Opened", "Changed" }, dialogueTokens);
            dialogueTokens = UiReflection.SubscribeEvent(dialogues, null,
                new[] { "Started", "DialogueStarted", "OnDialogueStart", "Opened", "Changed" }, OnDialogueEvent);
            subscribedDialogues = dialogues;
        }

        private void OnDialogueEvent(object[] args)
        {
            object candidate = args != null && args.Length > 0 ? args[0] : UiApi.CurrentDialogue;
            if (candidate == null) return;
            if (root.gameObject.activeSelf && ReferenceEquals(candidate, currentDialogue)) return;
            Open(candidate, null, null, null);
        }

        private static string TextOf(object value)
        {
            if (value == null) return string.Empty;
            if (value is string s) return s.Trim();
            var text = UiApi.ExtractText(value, "Phrase", "Line", "Body");
            if (string.IsNullOrWhiteSpace(text)) return string.Empty;
            if (text.IndexOf("MoveStudio", StringComparison.OrdinalIgnoreCase) >= 0) return string.Empty;
            return text.Trim();
        }

        private static void CollectText(object value, List<string> output)
        {
            if (value == null) return;
            if (value is string s)
            {
                if (!string.IsNullOrWhiteSpace(s)) output.Add(s.Trim());
                return;
            }
            var list = UiReflection.Enumerate(value);
            if (list.Count > 0)
            {
                foreach (object item in list) CollectText(item, output);
                return;
            }
            string text = TextOf(value);
            if (!string.IsNullOrEmpty(text)) output.Add(text);
        }

        private static string[] CollectLines(object dialogue)
        {
            var result = new List<string>();
            if (dialogue == null) return Array.Empty<string>();

            object node = UiReflection.GetMember(dialogue, "node", "currentNode", "CurrentNode");
            object data = node != null ? UiReflection.GetMember(node, "data", "Data") : null;

            CollectText(UiReflection.GetMember(data != null ? data : dialogue, "text", "Text"), result);
            CollectText(UiReflection.GetMember(dialogue, "phrase", "line", "message", "Phrase", "Line", "Message"), result);
            CollectText(UiReflection.GetMember(dialogue, "lines", "phrases", "messages", "Lines"), result);
            CollectText(UiReflection.GetMember(node, "text", "Text"), result);

            return result.Where(x => !string.IsNullOrWhiteSpace(x)).Distinct().ToArray();
        }

        private static string SpeakerOf(object dialogue)
        {
            if (dialogue == null) return "РАЗГОВОР";
            string speaker = UiApi.ExtractText(UiReflection.GetMember(dialogue, "speaker", "Speaker", "name", "Name"));
            if (string.IsNullOrWhiteSpace(speaker))
            {
                object node = UiReflection.GetMember(dialogue, "node", "currentNode");
                object data = node != null ? UiReflection.GetMember(node, "data") : null;
                speaker = UiApi.ExtractText(data != null ? UiReflection.GetMember(data, "speaker", "name") : null);
            }
            if (string.IsNullOrWhiteSpace(speaker))
            {
                object actor = UiReflection.GetMember(dialogue, "actor", "Actor");
                if (actor != null) speaker = UiApi.ExtractText(UiReflection.GetMember(actor, "name", "Name"));
            }
            return string.IsNullOrWhiteSpace(speaker) ? "РАЗГОВОР" : speaker;
        }

        private static string[] CollectOptions(object dialogue, out int[] indices)
        {
            indices = Array.Empty<int>();
            if (dialogue == null) return Array.Empty<string>();

            object node = UiReflection.GetMember(dialogue, "node", "currentNode");
            object data = node != null ? UiReflection.GetMember(node, "data") : null;
            object source = UiReflection.GetMember(dialogue, "options", "answers", "choices", "variants")
                            ?? UiReflection.GetMember(data, "options", "answers", "choices", "variants");
            var list = UiReflection.Enumerate(source);
            var labels = new List<string>();
            var resultIndices = new List<int>();

            for (int i = 0; i < list.Count && labels.Count < MaxOptions; i++)
            {
                object item = list[i];
                string label = TextOf(item);
                if (string.IsNullOrEmpty(label))
                    label = UiApi.ExtractText(UiReflection.GetMember(item, "text", "Text", "title", "Title", "label", "Label"));
                if (string.IsNullOrWhiteSpace(label)) continue;
                labels.Add(label.Trim());
                resultIndices.Add(i);
            }
            indices = resultIndices.ToArray();
            return labels.ToArray();
        }

        public void Open(object dialogue, string speaker, string text, string[] suppliedOptions)
        {
            if (root == null) Ensure(transform.parent ?? transform);

            currentDialogue = dialogue;
            var collected = new List<string>();
            if (!string.IsNullOrWhiteSpace(text)) collected.Add(text.Trim());
            collected.AddRange(CollectLines(dialogue));
            lines = collected.Where(x => !string.IsNullOrWhiteSpace(x)).Distinct().ToArray();
            if (lines.Length == 0) lines = new[] { "…" };

            if (suppliedOptions != null && suppliedOptions.Length > 0)
            {
                options = suppliedOptions.Where(x => !string.IsNullOrWhiteSpace(x)).Take(MaxOptions).ToArray();
                optionIndices = Enumerable.Range(0, options.Length).ToArray();
            }
            else
            {
                options = CollectOptions(dialogue, out optionIndices);
            }

            lineIndex = 0;
            visibleChars = 0;
            charTimer = 0f;
            optionsShown = false;
            speakerText.text = string.IsNullOrWhiteSpace(speaker) ? SpeakerOf(dialogue) : speaker;
            bodyText.text = string.Empty;
            Refresh();
            root.gameObject.SetActive(true);
        }

        private void Refresh()
        {
            counterText.text = lines.Length > 1
                ? (lineIndex + 1).ToString(CultureInfo.InvariantCulture) + " / " + lines.Length.ToString(CultureInfo.InvariantCulture)
                : string.Empty;

            bool showOptions = options.Length > 0 && optionsShown;
            for (int i = 0; i < optionButtons.Length; i++)
            {
                bool visible = showOptions && i < options.Length;
                optionButtons[i].gameObject.SetActive(visible);
                if (visible)
                    optionLabels[i].text = (i + 1).ToString(CultureInfo.InvariantCulture) + ". " + options[i];
            }
            nextButton.gameObject.SetActive(!showOptions);
            nextLabel.text = lineIndex < lines.Length - 1 ? "ДАЛЬШЕ" : options.Length > 0 ? "ВЫБРАТЬ" : "ЗАКРЫТЬ";
        }

        private void OnNext()
        {
            if (!root.gameObject.activeSelf) return;

            if (!optionsShown && lines.Length > 0 && visibleChars < lines[lineIndex].Length)
            {
                visibleChars = lines[lineIndex].Length;
                bodyText.text = lines[lineIndex];
                Refresh();
                return;
            }

            if (lineIndex < lines.Length - 1)
            {
                lineIndex++;
                visibleChars = 0;
                charTimer = 0f;
                bodyText.text = string.Empty;
                Refresh();
                return;
            }

            if (options.Length > 0 && !optionsShown)
            {
                optionsShown = true;
                Refresh();
                return;
            }

            Close();
        }

        private void SelectOption(int buttonIndex)
        {
            if (buttonIndex < 0 || buttonIndex >= options.Length) return;
            string label = options[buttonIndex];
            int value = buttonIndex < optionIndices.Length ? optionIndices[buttonIndex] : buttonIndex;

            object dialogues = UiApi.Dialogues;
            bool selected = UiReflection.AsBool(UiReflection.Invoke(dialogues,
                new[] { "Select", "Choose", "SelectOption" }, value));
            if (!selected)
                UiReflection.Invoke(dialogues, new[] { "Select", "Choose", "SelectAnswer" }, label);

            HudController.ShowSubtitleGlobal("ВЫБРАНО: " + label, 2f);
            Close(false);
        }

        public void Close()
        {
            Close(true);
        }

        private void Close(bool closeEngineDialogue)
        {
            if (closeEngineDialogue && UiApi.CurrentDialogue != null)
                UiReflection.Invoke(UiApi.Dialogues, new[] { "Close", "Hide", "Clear" });

            currentDialogue = null;
            lines = Array.Empty<string>();
            options = Array.Empty<string>();
            optionIndices = Array.Empty<int>();
            if (root != null) root.gameObject.SetActive(false);
        }

        private void OnDestroy()
        {
            if (dialogueTokens.Count > 0 && subscribedDialogues != null)
                UiReflection.UnsubscribeEvent(subscribedDialogues, null,
                    new[] { "Started", "DialogueStarted", "OnDialogueStart", "Opened", "Changed" }, dialogueTokens);
            if (instance == this) instance = null;
        }

        public static void ShowGlobal(object dialogue, string speaker = null, string text = null, string[] choices = null)
        {
            if (instance != null) instance.Open(dialogue, speaker, text, choices);
        }

        public static void CloseGlobal()
        {
            if (instance != null) instance.Close();
        }
    }
}
