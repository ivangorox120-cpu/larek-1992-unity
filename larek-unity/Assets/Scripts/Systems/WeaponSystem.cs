using System;
using System.Collections.Generic;

namespace Larek.Systems
{
    /// <summary>Состояния двуствольного охотничьего ружья.</summary>
    public enum WeaponState
    {
        Holstered,
        InHand,
        Open,
        Loaded,
        Firing
    }

    /// <summary>
    /// Чистая модель ружья: два патронника, перелом стволов, законы перезарядки
    /// и детерминированная задержка между выстрелами. Звуковые события — логические имена.
    /// </summary>
    public sealed class WeaponSystem
    {
        public const int Capacity = 2;
        public const double FireCooldownSeconds = 0.38;
        public const string EventShot = "shot";
        public const string EventOpen = "gun_open";
        public const string EventClose = "gun_close";
        public const string EventShell = "gun_shell";
        public const string EventShellDrop = "shell_drop";
        public const string EventGunMove = "gun_move";

        private readonly List<string> audioEvents = new List<string>();
        private WeaponState state = WeaponState.Holstered;
        private int ammo;
        private int reserve;
        private int spentShells;
        private double cooldown;
        private double elapsed;

        public WeaponSystem()
        {
        }

        /// <summary>Удобный конструктор: сразу заряжает до двух патронов, остаток — в запас.</summary>
        public WeaponSystem(int rounds)
        {
            AddRounds(rounds);
            if (rounds > 0)
            {
                Draw();
                Reload(0);
            }
        }

        public WeaponState State { get { return state; } }
        public int Ammo { get { return ammo; } }
        /// <summary>Число патронов в стволах (совпадает с Ammo).</summary>
        public int Shells { get { return ammo; } }
        public int ChamberedShells { get { return ammo; } }
        public int Reserve { get { return reserve; } }
        public int ReserveShells { get { return reserve; } }
        public int TotalShells { get { return ammo + reserve; } }
        public int SpentShells { get { return spentShells; } }
        public int ShotsFired { get; private set; }
        public double CooldownRemaining { get { return cooldown; } }
        public double Elapsed { get { return elapsed; } }
        public bool CanFire { get { return state == WeaponState.InHand || state == WeaponState.Loaded; } }
        public IReadOnlyList<string> AudioEvents { get { return audioEvents.AsReadOnly(); } }
        public string LastAudioEvent { get { return audioEvents.Count == 0 ? string.Empty : audioEvents[audioEvents.Count - 1]; } }

        public bool Draw()
        {
            if (state != WeaponState.Holstered) return false;
            state = ammo > 0 ? WeaponState.Loaded : WeaponState.InHand;
            Emit(EventGunMove);
            return true;
        }

        public bool Holster()
        {
            if (state == WeaponState.Holstered) return false;
            state = WeaponState.Holstered;
            cooldown = 0;
            Emit(EventGunMove);
            return true;
        }

        /// <summary>Перелом/закрытие стволов.</summary>
        public bool OpenClose()
        {
            if (state == WeaponState.Firing && cooldown > 0) return false;
            if (state == WeaponState.Holstered) Draw();
            if (state == WeaponState.Open)
            {
                state = ammo > 0 ? WeaponState.Loaded : WeaponState.InHand;
                Emit(EventClose);
                return true;
            }
            if (state != WeaponState.InHand && state != WeaponState.Loaded) return false;
            state = WeaponState.Open;
            Emit(EventOpen);
            return true;
        }

        /// <summary>
        /// Перезарядка. Параметр — число доступных патронов; они добавляются в запас
        /// и затем уходят в патронники. Стволы автоматически открываются и закрываются.
        /// </summary>
        public bool Reload(int rounds)
        {
            if (rounds < 0) throw new ArgumentOutOfRangeException(nameof(rounds));
            if (state == WeaponState.Firing && cooldown > 0) return false;
            if (state == WeaponState.Holstered) Draw();

            bool wasOpen = state == WeaponState.Open;
            if (!wasOpen)
            {
                state = WeaponState.Open;
                Emit(EventOpen);
            }

            // При переломе стволов старые гильзы вылетают (как в weapon.js: W.ejectedDone).
            int ejected = Math.Max(0, Capacity - ammo);
            for (int i = 0; i < ejected; i++) Emit(EventShellDrop);
            spentShells += ejected;

            if (rounds > 0) reserve += rounds;
            int inserted = Math.Min(Capacity - ammo, reserve);
            for (int i = 0; i < inserted; i++)
            {
                ammo++;
                reserve--;
                Emit(i % 2 == 0 ? EventShell : EventShellDrop);
            }

            state = ammo > 0 ? WeaponState.Loaded : WeaponState.InHand;
            Emit(EventClose);
            return inserted > 0 || rounds == 0;
        }

        /// <summary>Выстрел. Возвращает false, если ружьё не готово, пусто или идёт задержка.</summary>
        public bool Fire(Action onShot)
        {
            if (!CanFire || cooldown > 0 || ammo <= 0) return false;

            ammo--;
            ShotsFired++;
            spentShells++;
            state = WeaponState.Firing;
            cooldown = FireCooldownSeconds;
            Emit(EventShot);
            if (onShot != null) onShot();
            return true;
        }

        public bool Fire()
        {
            return Fire(null);
        }

        public void Tick(float seconds)
        {
            if (!SystemMath.IsFinite(seconds) || seconds < 0)
                throw new ArgumentOutOfRangeException(nameof(seconds));
            elapsed += seconds;
            if (cooldown <= 0) return;
            cooldown = Math.Max(0, cooldown - seconds);
            if (cooldown == 0 && state == WeaponState.Firing)
                state = ammo > 0 ? WeaponState.Loaded : WeaponState.InHand;
        }

        public void AddRounds(int rounds)
        {
            if (rounds < 0) throw new ArgumentOutOfRangeException(nameof(rounds));
            reserve += rounds;
        }

        public void SetReserve(int rounds)
        {
            if (rounds < 0) throw new ArgumentOutOfRangeException(nameof(rounds));
            reserve = rounds;
        }

        public void ClearAudioEvents()
        {
            audioEvents.Clear();
        }

        private void Emit(string eventId)
        {
            audioEvents.Add(eventId);
        }
    }
}
