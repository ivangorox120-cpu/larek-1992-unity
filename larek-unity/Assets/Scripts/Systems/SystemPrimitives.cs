using System;

namespace Larek.Systems
{
    /// <summary>
    /// Простая трёхмерная координата без зависимостей от UnityEngine.
    /// Используется чистыми моделями систем (автобус, NPC, ragdoll).
    /// </summary>
    public struct BusVector
    {
        public double X;
        public double Y;
        public double Z;

        // Псевдонимы в стиле Three.js — удобно при портировании старого кода.
        public double x { get { return X; } set { X = value; } }
        public double y { get { return Y; } set { Y = value; } }
        public double z { get { return Z; } set { Z = value; } }

        public BusVector(double x, double y, double z)
        {
            X = x;
            Y = y;
            Z = z;
        }

        public double DistanceTo(BusVector other)
        {
            double dx = X - other.X, dy = Y - other.Y, dz = Z - other.Z;
            return Math.Sqrt(dx * dx + dy * dy + dz * dz);
        }

        public double HorizontalDistanceTo(BusVector other)
        {
            double dx = X - other.X, dz = Z - other.Z;
            return Math.Sqrt(dx * dx + dz * dz);
        }

        public override string ToString()
        {
            return "(" + X.ToString("F2") + ", " + Y.ToString("F2") + ", " + Z.ToString("F2") + ")";
        }
    }

    /// <summary>Математические помощники, не зависящие от движка.</summary>
    public static class SystemMath
    {
        public static double Clamp(double value, double min, double max)
        {
            return Math.Max(min, Math.Min(max, value));
        }

        public static float Clamp(float value, float min, float max)
        {
            return Math.Max(min, Math.Min(max, value));
        }

        public static int Clamp(int value, int min, int max)
        {
            return Math.Max(min, Math.Min(max, value));
        }

        public static double Lerp(double from, double to, double t)
        {
            return from + (to - from) * Clamp(t, 0, 1);
        }

        /// <summary>Плавная S-кривая (smoothstep) для заезда в карман остановки.</summary>
        public static double SmoothStep(double t)
        {
            double u = Clamp(t, 0, 1);
            return u * u * (3 - 2 * u);
        }

        /// <summary>Более плавная S-кривая (quintic), также используется для колёс.</summary>
        public static double SmootherStep(double t)
        {
            double u = Clamp(t, 0, 1);
            return u * u * u * (u * (u * 6 - 15) + 10);
        }

        public static bool IsFinite(double value)
        {
            return !double.IsNaN(value) && !double.IsInfinity(value);
        }

        public static bool IsFinite(float value)
        {
            return !float.IsNaN(value) && !float.IsInfinity(value);
        }

        public static double Wrap(double value, double period)
        {
            if (period <= 0) return 0;
            double result = value % period;
            return result < 0 ? result + period : result;
        }
    }
}
