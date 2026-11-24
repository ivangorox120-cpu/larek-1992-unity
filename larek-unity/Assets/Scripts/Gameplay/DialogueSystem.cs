using System;
using System.Collections.Generic;

namespace Larek.Gameplay
{
    /// <summary>Один вариант ответа в диалоге.</summary>
    public sealed class DialogueOption
    {
        public string Id;
        public string Label;
        public Action Action;

        public Action OnSelect { get { return Action; } set { Action = value; } }
        public Action Callback { get { return Action; } set { Action = value; } }

        public DialogueOption(string label, Action action)
        {
            Label = label ?? string.Empty;
            Id = Label;
            Action = action;
        }

        public DialogueOption(string id, string label, Action action)
        {
            Id = id ?? string.Empty;
            Label = label ?? string.Empty;
            Action = action;
        }
    }

    /// <summary>Открытый диалог.</summary>
    public sealed class Dialogue
    {
        public string Name;
        public string Text;
        public IList<DialogueOption> Options;
        public int RevealedCharacters;

        public bool Complete
        {
            get { return RevealedCharacters >= (Text == null ? 0 : Text.Length); }
        }

        public Dialogue(string name, string text, IList<DialogueOption> options)
        {
            Name = name ?? string.Empty;
            Text = text ?? string.Empty;
            Options = options ?? new List<DialogueOption>();
            RevealedCharacters = 0;
        }

        public void RevealAll()
        {
            RevealedCharacters = Text == null ? 0 : Text.Length;
        }
    }

    /// <summary>
    /// Простой аналог showDialog() из оригинала. Выбор варианта закрывает окно и вызывает его действие.
    /// </summary>
    public sealed class DialogueSystem
    {
        /// <summary>Скорость «печатающего» текста в секундах на символ (28 мс в game.js).</summary>
        public float SecondsPerCharacter = 0.028f;

        private Dialogue current;

        public Dialogue Current { get { return current; } }
        public bool IsOpen { get { return current != null; } }
        public bool DialogOpen { get { return IsOpen; } }

        public string Name { get { return current == null ? string.Empty : current.Name; } }
        public string Text { get { return current == null ? string.Empty : current.Text; } }
        public IList<DialogueOption> Options { get { return current == null ? new List<DialogueOption>() : current.Options; } }

        public Dialogue Show(string name, string text, IList<DialogueOption> options)
        {
            var copy = new List<DialogueOption>();
            if (options != null)
                foreach (DialogueOption option in options) if (option != null) copy.Add(option);
            current = new Dialogue(name, text, copy);
            return current;
        }

        public Dialogue Show(string name, string text, params DialogueOption[] options)
        {
            return Show(name, text, (IList<DialogueOption>)options);
        }

        public Dialogue Show(string name, string text, params string[] options)
        {
            var copy = new List<DialogueOption>();
            if (options != null)
                foreach (string label in options) copy.Add(new DialogueOption(label, null));
            return Show(name, text, copy);
        }

        public Dialogue ShowDialog(string name, string text, IList<DialogueOption> options)
        {
            return Show(name, text, options);
        }

        public Dialogue ShowDialog(string name, string text, params DialogueOption[] options)
        {
            return Show(name, text, options);
        }

        public Dialogue Open(string name, string text, IList<DialogueOption> options)
        {
            return Show(name, text, options);
        }

        public bool Select(int index)
        {
            if (current == null || index < 0 || index >= current.Options.Count) return false;
            DialogueOption option = current.Options[index];
            if (option != null && option.Action != null) option.Action();
            Close();
            return true;
        }

        public bool Choose(int index)
        {
            return Select(index);
        }

        public bool Select(string idOrLabel)
        {
            if (current == null || string.IsNullOrEmpty(idOrLabel)) return false;
            for (int i = 0; i < current.Options.Count; i++)
            {
                DialogueOption option = current.Options[i];
                if (option == null) continue;
                if (string.Equals(option.Id, idOrLabel, StringComparison.Ordinal) ||
                    string.Equals(option.Label, idOrLabel, StringComparison.Ordinal))
                    return Select(i);
            }
            return false;
        }

        public void Close()
        {
            current = null;
        }

        public void RevealAll()
        {
            if (current != null) current.RevealAll();
        }

        public void Update(float deltaSeconds)
        {
            if (current == null || current.Complete) return;
            float dt = float.IsNaN(deltaSeconds) || deltaSeconds < 0 ? 0 : deltaSeconds;
            if (SecondsPerCharacter <= 0)
            {
                current.RevealAll();
                return;
            }
            current.RevealedCharacters += (int)Math.Floor(dt / SecondsPerCharacter);
            current.RevealAll();
        }
    }
}
