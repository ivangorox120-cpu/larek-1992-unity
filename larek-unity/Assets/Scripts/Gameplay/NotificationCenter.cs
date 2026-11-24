using System;
using System.Collections.Generic;

namespace Larek.Gameplay
{
    /// <summary>Одно всплывающее сообщение. Время хранится в секундах реального времени.</summary>
    public sealed class Notification
    {
        public string Message;
        public string Category;
        public float LifetimeSeconds;
        public float RemainingSeconds;

        public string Text { get { return Message; } set { Message = value; } }
        public string Kind { get { return Category; } set { Category = value; } }
        public bool IsExpired { get { return RemainingSeconds <= 0; } }

        public Notification(string message, string category, float lifetimeSeconds)
        {
            Message = message ?? string.Empty;
            Category = category ?? string.Empty;
            LifetimeSeconds = lifetimeSeconds;
            RemainingSeconds = lifetimeSeconds;
        }
    }

    /// <summary>
    /// Очередь всплывающих сообщений из game.js: живут 2,2 с и одновременно видны не более трёх.
    /// Сообщение удаляется только по таймеру (или явным Clear), а не при закрытии диалога.
    /// </summary>
    public sealed class NotificationCenter
    {
        public const float DefaultLifetimeSeconds = 2.2f;
        public const int DefaultMaxVisible = 3;

        private readonly List<Notification> active = new List<Notification>();

        public int MaxVisible = DefaultMaxVisible;

        public int Count { get { return active.Count; } }
        public bool HasAny { get { return active.Count > 0; } }

        public IList<Notification> Active
        {
            get { return new List<Notification>(active); }
        }

        public IList<Notification> Notifications
        {
            get { return Active; }
        }

        public IList<string> Messages
        {
            get
            {
                var result = new List<string>(active.Count);
                foreach (Notification item in active) result.Add(item.Message);
                return result;
            }
        }

        public Notification Show(string message, string category = "", float lifetimeSeconds = DefaultLifetimeSeconds)
        {
            if (lifetimeSeconds <= 0) return null;
            var notification = new Notification(message, category, lifetimeSeconds);
            active.Add(notification);
            while (active.Count > MaxVisible && MaxVisible > 0) active.RemoveAt(0);
            return notification;
        }

        public Notification Notify(string message, string category = "", float lifetimeSeconds = DefaultLifetimeSeconds)
        {
            return Show(message, category, lifetimeSeconds);
        }

        public Notification Toast(string message, string category = "", float lifetimeSeconds = DefaultLifetimeSeconds)
        {
            return Show(message, category, lifetimeSeconds);
        }

        public Notification Add(string message, string category = "", float lifetimeSeconds = DefaultLifetimeSeconds)
        {
            return Show(message, category, lifetimeSeconds);
        }

        public void Update(float deltaSeconds)
        {
            if (active.Count == 0) return;
            float dt = float.IsNaN(deltaSeconds) || deltaSeconds < 0 ? 0 : deltaSeconds;
            for (int i = active.Count - 1; i >= 0; i--)
            {
                active[i].RemainingSeconds -= dt;
                if (active[i].RemainingSeconds <= 0.00001f) active.RemoveAt(i);
            }
        }

        public void Update(double deltaSeconds)
        {
            Update((float)Math.Max(0, double.IsNaN(deltaSeconds) ? 0 : deltaSeconds));
        }

        public Notification Peek()
        {
            return active.Count == 0 ? null : active[0];
        }

        public void Clear()
        {
            active.Clear();
        }
    }
}
