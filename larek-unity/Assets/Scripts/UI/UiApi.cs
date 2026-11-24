using System;
using System.Collections;
using System.Collections.Generic;
using System.Reflection;
using Larek.Economy;
using UnityEngine;

namespace Larek.UI
{
    // Внешние подсистемы подключаются через отражение: UI/asmdef не зависит от порядka сборки
    // других агентов и продолжает работать, если какой-то компонент ещё не создан.
    internal static class UiReflection
    {
        private const BindingFlags InstanceFlags = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.FlattenHierarchy | BindingFlags.IgnoreCase;
        private const BindingFlags StaticFlags = BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.FlattenHierarchy | BindingFlags.IgnoreCase;
        private static readonly Dictionary<string, Type> TypeCache = new Dictionary<string, Type>();

        public static Type FindType(params string[] fullNames)
        {
            if (fullNames == null) return null;
            foreach (string fullName in fullNames)
            {
                if (string.IsNullOrEmpty(fullName)) continue;
                Type found = null;
                if (TypeCache.TryGetValue(fullName, out found)) return found;

                found = Type.GetType(fullName, false);
                if (found == null)
                {
                    foreach (Assembly assembly in AppDomain.CurrentDomain.GetAssemblies())
                    {
                        try { found = assembly.GetType(fullName, false); }
                        catch (Exception) { found = null; }
                        if (found != null) break;
                    }
                }

                TypeCache[fullName] = found;
                if (found != null) return found;
            }
            return null;
        }

        public static object GetStatic(Type type, params string[] memberNames)
        {
            if (type == null || memberNames == null) return null;
            foreach (string name in memberNames)
            {
                try
                {
                    FieldInfo field = type.GetField(name, StaticFlags);
                    if (field != null) return field.GetValue(null);
                    PropertyInfo property = type.GetProperty(name, StaticFlags);
                    if (property != null && property.GetIndexParameters().Length == 0) return property.GetValue(null, null);
                }
                catch (Exception) { /* подсистема ещё инициализируется */ }
            }
            return null;
        }

        public static object GetMember(object target, params string[] memberNames)
        {
            if (target == null || memberNames == null) return null;
            Type type = target.GetType();
            foreach (string name in memberNames)
            {
                try
                {
                    PropertyInfo property = type.GetProperty(name, InstanceFlags);
                    if (property != null && property.GetIndexParameters().Length == 0) return property.GetValue(target, null);
                    FieldInfo field = type.GetField(name, InstanceFlags);
                    if (field != null) return field.GetValue(target);
                }
                catch (Exception) { /* ignore */ }
            }
            return null;
        }

        public static void SetMember(object target, object value, params string[] memberNames)
        {
            if (target == null || memberNames == null) return;
            Type type = target.GetType();
            foreach (string name in memberNames)
            {
                try
                {
                    PropertyInfo property = type.GetProperty(name, InstanceFlags);
                    if (property != null && property.CanWrite)
                    {
                        property.SetValue(target, ConvertValue(value, property.PropertyType), null);
                        return;
                    }
                    FieldInfo field = type.GetField(name, InstanceFlags);
                    if (field != null)
                    {
                        field.SetValue(target, ConvertValue(value, field.FieldType));
                        return;
                    }
                }
                catch (Exception) { /* ignore */ }
            }
        }

        private static object ConvertValue(object value, Type targetType)
        {
            if (value == null) return targetType.IsValueType ? Activator.CreateInstance(targetType) : null;
            if (targetType.IsInstanceOfType(value)) return value;
            try
            {
                if (targetType.IsEnum && value is string text) return Enum.Parse(targetType, text, true);
                return Convert.ChangeType(value, targetType);
            }
            catch (Exception) { return value; }
        }

        public static bool AsBool(object value)
        {
            if (value is bool flag) return flag;
            if (value is int number) return number != 0;
            if (value is float f) return Mathf.Abs(f) > 0.0001f;
            if (value is string text)
            {
                string t = text.Trim().ToLowerInvariant();
                return t == "1" || t == "true" || t == "on" || t == "yes" || t == "да" || t == "вкл";
            }
            return false;
        }

        public static int AsInt(object value, int fallback = 0)
        {
            if (value is int number) return number;
            if (value is float f) return Mathf.RoundToInt(f);
            if (value is double d) return (int)Math.Round(d);
            if (value is string text && int.TryParse(text, out int parsed)) return parsed;
            return fallback;
        }

        public static string AsString(object value, string fallback = "")
        {
            if (value == null) return fallback;
            if (value is string text) return text;
            object member = GetMember(value, "Name", "Title", "Message", "Text", "Label", "DisplayName");
            return member is string s ? s : value.ToString();
        }

        public static object Invoke(object target, string[] methodNames, params object[] args)
        {
            if (target == null || methodNames == null) return null;
            return InvokeMethods(target.GetType(), target, methodNames, args);
        }

        public static object InvokeStatic(Type type, string[] methodNames, params object[] args)
        {
            if (type == null || methodNames == null) return null;
            return InvokeMethods(type, null, methodNames, args);
        }

        private static object InvokeMethods(Type type, object target, string[] methodNames, object[] args)
        {
            object[] supplied = args ?? Array.Empty<object>();
            MethodInfo[] methods;
            try { methods = type.GetMethods(InstanceFlags | StaticFlags); }
            catch (Exception) { return null; }

            // Сначала точное совпадение аргументов, затем методы с необязательными
            // параметрами (например Show(string, string = "", float = 2.2f)).
            for (int pass = 0; pass < 2; pass++)
            {
                bool allowOptional = pass == 1;
                foreach (string name in methodNames)
                {
                    foreach (MethodInfo method in methods)
                    {
                        if (!string.Equals(method.Name, name, StringComparison.OrdinalIgnoreCase)) continue;
                        if (method.IsStatic != (target == null)) continue;

                        object[] converted;
                        if (!TryBuildArguments(method, supplied, allowOptional, out converted)) continue;
                        try { return method.Invoke(target, converted); }
                        catch (Exception) { /* пробуем другую перегрузку */ }
                    }
                }
            }
            return null;
        }

        private static bool TryBuildArguments(MethodInfo method, object[] args, bool allowOptional, out object[] converted)
        {
            converted = Array.Empty<object>();
            ParameterInfo[] parameters = method.GetParameters();
            int fixedCount = parameters.Length;
            bool hasParams = false;
            if (fixedCount > 0)
            {
                ParameterInfo last = parameters[fixedCount - 1];
                hasParams = last.ParameterType.IsArray &&
                            last.GetCustomAttributes(typeof(ParamArrayAttribute), false).Length > 0;
                if (hasParams) fixedCount--;
            }

            if (args.Length > fixedCount && !hasParams) return false;
            if (args.Length < fixedCount && !allowOptional) return false;

            var result = new object[parameters.Length];
            for (int i = 0; i < args.Length && i < fixedCount; i++)
            {
                result[i] = ConvertValue(args[i], parameters[i].ParameterType);
                if (!IsCompatible(parameters[i].ParameterType, result[i])) return false;
            }

            for (int i = args.Length; i < fixedCount; i++)
            {
                ParameterInfo parameter = parameters[i];
                if (!allowOptional || !parameter.IsOptional) return false;
                object fallback = parameter.DefaultValue;
                if (fallback == null || fallback == DBNull.Value || fallback == Missing.Value)
                    fallback = parameter.ParameterType.IsValueType ? Activator.CreateInstance(parameter.ParameterType) : null;
                result[i] = ConvertValue(fallback, parameter.ParameterType);
                if (!IsCompatible(parameter.ParameterType, result[i])) return false;
            }

            if (hasParams)
            {
                ParameterInfo tail = parameters[parameters.Length - 1];
                Type elementType = tail.ParameterType.GetElementType();
                Array tailValues = Array.CreateInstance(elementType, Mathf.Max(0, args.Length - fixedCount));
                for (int i = fixedCount; i < args.Length; i++)
                {
                    object value = ConvertValue(args[i], elementType);
                    if (!IsCompatible(elementType, value)) return false;
                    tailValues.SetValue(value, i - fixedCount);
                }
                result[parameters.Length - 1] = tailValues;
            }

            converted = result;
            return true;
        }

        private static bool IsCompatible(Type targetType, object value)
        {
            if (value == null) return !targetType.IsValueType || Nullable.GetUnderlyingType(targetType) != null;
            return targetType.IsInstanceOfType(value) || targetType.IsValueType;
        }

        public static List<Delegate> SubscribeEvent(object target, Type explicitType, string[] eventNames, Action<object[]> handler)
        {
            var tokens = new List<Delegate>();
            if (handler == null) return tokens;
            Type type = explicitType ?? (target != null ? target.GetType() : null);
            if (type == null || eventNames == null) return tokens;

            foreach (string name in eventNames)
            {
                EventInfo info;
                try { info = type.GetEvent(name, InstanceFlags | StaticFlags); }
                catch (Exception) { continue; }
                if (info == null || info.EventHandlerType == null) continue;
                object eventTarget = info.GetAddMethod(true) != null && info.GetAddMethod(true).IsStatic ? null : target;
                if (eventTarget == null && (info.GetAddMethod(true) == null || !info.GetAddMethod(true).IsStatic)) continue;

                Type handlerType = info.EventHandlerType;
                Delegate created = null;
                if (handlerType == typeof(Action))
                    created = new Action(() => handler(new object[0]));
                else if (handlerType == typeof(Action<string>))
                    created = new Action<string>(s => handler(new object[] { s }));
                else if (handlerType == typeof(Action<float>))
                    created = new Action<float>(v => handler(new object[] { v }));
                else if (handlerType == typeof(Action<int>))
                    created = new Action<int>(v => handler(new object[] { v }));
                else if (handlerType == typeof(Action<bool>))
                    created = new Action<bool>(v => handler(new object[] { v }));
                else if (typeof(EventHandler).IsAssignableFrom(handlerType))
                    created = new EventHandler((sender, e) => handler(new object[] { sender, e }));

                if (created == null) continue;
                try
                {
                    info.AddEventHandler(eventTarget, created);
                    tokens.Add(created);
                }
                catch (Exception) { /* ignore */ }
            }
            return tokens;
        }

        public static void UnsubscribeEvent(object target, Type explicitType, string[] eventNames, List<Delegate> tokens)
        {
            if (tokens == null) return;
            Type type = explicitType ?? (target != null ? target.GetType() : null);
            if (type == null || eventNames == null) return;
            foreach (string name in eventNames)
            {
                EventInfo info;
                try { info = type.GetEvent(name, InstanceFlags | StaticFlags); }
                catch (Exception) { continue; }
                if (info == null) continue;
                object eventTarget = info.GetAddMethod(true) != null && info.GetAddMethod(true).IsStatic ? null : target;
                foreach (Delegate token in tokens)
                {
                    try { info.RemoveEventHandler(eventTarget, token); }
                    catch (Exception) { /* ignore */ }
                }
            }
        }

        public static List<object> Enumerate(object value)
        {
            var result = new List<object>();
            if (value == null || value is string) return result;
            if (value is IEnumerable sequence)
            {
                try
                {
                    foreach (object item in sequence) result.Add(item);
                }
                catch (Exception) { return result; }
            }
            return result;
        }
    }

    // Удобные точки доступа к контракту внешних агентов.
    internal static class UiApi
    {
        private static readonly Dictionary<string, object> SystemCache = new Dictionary<string, object>();

        public static object Session
        {
            get
            {
                Type type = UiReflection.FindType("Larek.Gameplay.GameSession");
                return UiReflection.GetStatic(type, "Current", "Instance");
            }
        }

        public static object Economy => UiReflection.GetMember(Session, "Economy");
        public static object Notifications => UiReflection.GetMember(Session, "Notifications");
        public static object Inventory => UiReflection.GetMember(Session, "Inventory");
        public static object Player => UiReflection.GetMember(Session, "Player");
        public static object Dialogues => UiReflection.GetMember(Session, "Dialogues");
        public static object Admin => UiReflection.GetMember(Session, "Admin");
        public static object Progression => UiReflection.GetMember(Session, "Progression");
        public static object Days => UiReflection.GetMember(Session, "Days");

        public static KioskEconomy KioskEconomy => Economy as KioskEconomy;

        /// <summary>
        /// Находит систему в сцене, её статический синглтон или создаёт экземпляр.
        /// Большинство систем из Larek.Systems — обычные C#-классы без MonoBehaviour,
        /// поэтому FindObjectOfType их не видит.
        /// </summary>
        public static object FindSystem(params string[] typeNames)
        {
            Type type = UiReflection.FindType(typeNames);
            if (type == null || type.IsAbstract || type.IsInterface) return null;

            string key = type.FullName ?? type.Name;
            if (typeof(UnityEngine.Object).IsAssignableFrom(type))
            {
                try { return UnityEngine.Object.FindObjectOfType(type); }
                catch (Exception) { return null; }
            }

            object singleton = UiReflection.GetStatic(type, "Instance", "Current", "Shared");
            if (singleton != null) return singleton;

            object cached;
            if (SystemCache.TryGetValue(key, out cached) && cached != null) return cached;
            try { cached = Activator.CreateInstance(type, true); }
            catch (Exception) { cached = null; }
            if (cached != null) SystemCache[key] = cached;
            return cached;
        }

        public static object Hand => FindSystem("Larek.Systems.HandSystem");
        public static object Weapon => FindSystem("Larek.Systems.WeaponSystem");
        public static object Phone => FindSystem("Larek.Systems.PhoneSystem");
        public static object Controls => FindSystem("Larek.Systems.ControlsSystem");

        public static void ToggleGuitar()
        {
            object hand = Hand;
            if (hand == null) return;
            if (PlayingGuitar) UiReflection.Invoke(hand, new[] { "StopGuitar", "Unequip", "Clear" });
            else UiReflection.Invoke(hand, new[] { "StartGuitar", "Equip" }, "guitar");
        }

        public static void ToggleWeapon()
        {
            object weapon = Weapon;
            if (weapon == null) return;
            string state = UiApi.ExtractText(UiReflection.GetMember(weapon, "State"));
            if (string.Equals(state, "Holstered", StringComparison.OrdinalIgnoreCase))
            {
                UiReflection.Invoke(weapon, new[] { "Draw", "OpenClose" });
                UiReflection.Invoke(Hand, new[] { "Equip" }, "gun");
            }
            else
            {
                UiReflection.Invoke(weapon, new[] { "Holster", "OpenClose" });
                UiReflection.Invoke(Hand, new[] { "Unequip" });
            }
        }

        public static void TogglePhone()
        {
            UiReflection.Invoke(Hand, new[] { "Equip" }, "phone");
            Notify("Телефон на прилавке: 4-19-92 «Посылторг».", "info");
        }

        public static void ToggleFlashlight()
        {
            object hand = Hand;
            if (hand == null) return;
            string item = UiApi.ExtractText(UiReflection.GetMember(hand, "ItemId", "CurrentItemId"));
            if (string.Equals(item, "flashlight", StringComparison.OrdinalIgnoreCase))
                UiReflection.Invoke(hand, new[] { "Unequip" });
            else
                UiReflection.Invoke(hand, new[] { "Equip" }, "flashlight");
        }

        public static void ToggleCrouching()
        {
            object player = Player;
            if (player == null) return;
            bool value = !UiReflection.AsBool(UiReflection.GetMember(player, "Crouching"));
            UiReflection.SetMember(player, value, "Crouching");
        }

        public static bool PlayingGuitar
        {
            get
            {
                object hand = Hand;
                return UiReflection.AsBool(UiReflection.GetMember(hand, "PlayingGuitar", "IsPlayingGuitar", "GuitarPlaying"));
            }
        }

        public static bool Aiming
        {
            get
            {
                object weapon = Weapon;
                return UiReflection.AsBool(UiReflection.GetMember(weapon, "Aiming", "IsAiming", "aiming"));
            }
        }

        public static void Notify(string message, float seconds = 2.5f)
        {
            Notify(message, "info", seconds);
        }

        public static void Notify(string message, string category, float seconds = 2.5f)
        {
            object notifications = Notifications;
            if (notifications == null) return;
            // NotificationCenter.Show(string message, string category = "", float lifetimeSeconds = 2.2f).
            UiReflection.Invoke(notifications, new[] { "Show", "Notify", "Toast", "Add", "Push", "Post" },
                message, category ?? "info", seconds);
        }

        public static bool HasSave()
        {
            Type bootstrap = UiReflection.FindType("Larek.Gameplay.GameBootstrap");
            object path = UiReflection.GetStatic(bootstrap, "SavePath");
            try
            {
                if (path is string file && System.IO.File.Exists(file)) return true;
            }
            catch (Exception) { /* недоступная файловая система */ }

            object value = UiReflection.GetStatic(bootstrap, "HasSave", "Exists", "CanContinue");
            if (value is bool flag) return flag;
            return PlayerPrefs.HasKey("larek.save") || PlayerPrefs.HasKey("Larek.Save");
        }

        /// <summary>Новая игра через статический GameSession.NewGame или GameBootstrap.NewGame.</summary>
        public static void StartNewGame()
        {
            Type sessionType = UiReflection.FindType("Larek.Gameplay.GameSession");
            UiReflection.InvokeStatic(sessionType, new[] { "NewGame", "Create" });
            Type bootstrap = UiReflection.FindType("Larek.Gameplay.GameBootstrap");
            UiReflection.InvokeStatic(bootstrap, new[] { "NewGame" });
        }

        /// <summary>Продолжение через GameBootstrap.LoadFull(текущая сессия).</summary>
        public static void ContinueGame()
        {
            object session = Session;
            if (session == null) return;
            Type bootstrap = UiReflection.FindType("Larek.Gameplay.GameBootstrap");
            object loaded = UiReflection.InvokeStatic(bootstrap, new[] { "LoadFull", "Load" }, session);
            if (!UiReflection.AsBool(loaded))
                UiReflection.Invoke(session, new[] { "TryRestore", "Restore" });
        }

        public static object CurrentDialogue
        {
            get
            {
                object dialogues = Dialogues;
                if (dialogues == null) return null;
                return UiReflection.GetMember(dialogues, "Current", "Active", "Pending", "CurrentDialogue", "Open");
            }
        }

        public static List<Delegate> SubscribeNotifications(Action<object[]> handler)
        {
            object notifications = Notifications;
            if (notifications == null) return new List<Delegate>();
            return UiReflection.SubscribeEvent(notifications, null,
                new[] { "NotificationAdded", "NotificationsChanged", "Posted", "Raised", "Changed", "OnShow", "Message", "Added" }, handler);
        }

        public static void UnsubscribeNotifications(List<Delegate> tokens)
        {
            object notifications = Notifications;
            if (notifications == null) return;
            UiReflection.UnsubscribeEvent(notifications, null,
                new[] { "NotificationAdded", "NotificationsChanged", "Posted", "Raised", "Changed", "OnShow", "Message", "Added" }, tokens);
        }

        public static List<Delegate> SubscribeInteractions(Action<object[]> handler)
        {
            Type type = UiReflection.FindType("Larek.World.WorldInteractions");
            object instance = type == null ? null : FindSystem("Larek.World.WorldInteractions");
            return UiReflection.SubscribeEvent(instance, type, new[] { "Interacted", "OnInteracted" }, handler);
        }

        public static void UnsubscribeInteractions(List<Delegate> tokens)
        {
            Type type = UiReflection.FindType("Larek.World.WorldInteractions");
            object instance = type == null ? null : FindSystem("Larek.World.WorldInteractions");
            UiReflection.UnsubscribeEvent(instance, type, new[] { "Interacted", "OnInteracted" }, tokens);
        }

        public static string ExtractText(object item, params string[] extraNames)
        {
            if (item == null) return string.Empty;
            if (item is string text) return text;
            var names = new List<string> { "Message", "Text", "Msg", "Content", "Caption", "Title", "Name", "Label", "Body" };
            if (extraNames != null) names.InsertRange(0, extraNames);
            object value = UiReflection.GetMember(item, names.ToArray());
            if (value != null && !(value is string)) return ExtractText(value, extraNames);
            return value as string ?? item.ToString();
        }
    }
}
