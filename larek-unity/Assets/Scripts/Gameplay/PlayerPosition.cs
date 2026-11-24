using System;
using System.Globalization;

namespace Larek.Gameplay
{
    /// <summary>
    /// Простая трёхмерная координата игрока без зависимостей от UnityEngine.
    /// Поля оставлены открытыми, чтобы позицию можно было править напрямую.
    /// </summary>
    public struct PlayerPosition
    {
        public double X;
        public double Y;
        public double Z;
        public double Heading;

        // Псевдонимы в стиле Three.js — удобно при портировании старого кода.
        public double x { get { return X; } set { X = value; } }
        public double y { get { return Y; } set { Y = value; } }
        public double z { get { return Z; } set { Z = value; } }

        public PlayerPosition(double x, double z)
        {
            X = x;
            Y = 0;
            Z = z;
            Heading = 0;
        }

        public PlayerPosition(double x, double y, double z)
        {
            X = x;
            Y = y;
            Z = z;
            Heading = 0;
        }

        public PlayerPosition(double x, double y, double z, double heading)
        {
            X = x;
            Y = y;
            Z = z;
            Heading = heading;
        }

        public double DistanceTo(PlayerPosition other)
        {
            double dx = X - other.X, dy = Y - other.Y, dz = Z - other.Z;
            return Math.Sqrt(dx * dx + dy * dy + dz * dz);
        }

        public double HorizontalDistanceTo(PlayerPosition other)
        {
            double dx = X - other.X, dz = Z - other.Z;
            return Math.Sqrt(dx * dx + dz * dz);
        }

        public PlayerPosition Offset(double dx, double dy, double dz)
        {
            return new PlayerPosition(X + dx, Y + dy, Z + dz, Heading);
        }

        public override string ToString()
        {
            return "(" + X.ToString("R", CultureInfo.InvariantCulture) + ", " +
                   Y.ToString("R", CultureInfo.InvariantCulture) + ", " +
                   Z.ToString("R", CultureInfo.InvariantCulture) + ")";
        }
    }

    /// <summary>Состояние героя: позиция, тела и базовые Meeting-флаги.</summary>
    public sealed class PlayerState
    {
        public PlayerPosition Position;
        public double Yaw;
        public int Health = 100;
        public int MaxHealth = 100;
        public double Stamina = 100;
        public double Hunger = 80;
        public bool Crouching;
        public bool Locked;
        public bool InKiosk;
        public bool CarryingGuitar;

        public double X { get { return Position.X; } set { Position.X = value; } }
        public double Y { get { return Position.Y; } set { Position.Y = value; } }
        public double Z { get { return Position.Z; } set { Position.Z = value; } }

        public void SetPosition(double x, double y, double z)
        {
            Position = new PlayerPosition(x, y, z, Yaw);
        }

        public void SetPosition(PlayerPosition position)
        {
            Position = position;
            Yaw = position.Heading;
        }

        public void Move(double dx, double dy, double dz)
        {
            Position = Position.Offset(dx, dy, dz);
        }

        public void Reset()
        {
            Position = new PlayerPosition(0, 0, 0);
            Yaw = 0;
            Health = MaxHealth;
            Stamina = 100;
            Hunger = 80;
            Crouching = false;
            Locked = false;
            InKiosk = false;
            CarryingGuitar = false;
        }
    }
}
