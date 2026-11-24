using System;
using System.Collections.Generic;

namespace Larek.Systems
{
    public enum RagdollObjectKind
    {
        Chair,
        Stool,
        Table,
        Body,
        Other
    }

    /// <summary>Физическое состояние опрокидываемого предмета или тела.</summary>
    public sealed class RagdollObject
    {
        public readonly string Id;
        public readonly RagdollObjectKind Kind;
        public double Mass;
        public BusVector Position;
        public BusVector Velocity;
        public double Tilt;
        public double TiltVelocity;
        public double FloorY;
        public bool Toppled;
        public bool Settled;
        public double ToppleTilt = 0.85;

        public RagdollObject(string id, RagdollObjectKind kind, double x, double y, double z, double mass)
        {
            Id = id;
            Kind = kind;
            Position = new BusVector(x, y, z);
            Velocity = new BusVector(0, 0, 0);
            FloorY = Math.Max(0, y - 0.45);
            Mass = mass > 0 ? mass : 1;
        }
    }

    /// <summary>
    /// Упрощённый verlet-подобный интегратор для стульев, табуреток, столов и тел (js/ragdoll.js).
    /// Чистая модель: никаких Unity API, только импульсы, трение и укладка в устойчивую позу.
    /// </summary>
    public sealed class RagdollSystem
    {
        private readonly List<RagdollObject> objects = new List<RagdollObject>();
        private readonly Dictionary<string, RagdollObject> byId = new Dictionary<string, RagdollObject>(StringComparer.OrdinalIgnoreCase);

        public IReadOnlyList<RagdollObject> Objects { get { return objects.AsReadOnly(); } }
        public int Count { get { return objects.Count; } }
        public double Gravity { get; set; } = 13.5;
        public double Damping { get; set; } = 0.92;
        public double GroundFriction { get; set; } = 0.48;
        public double SettleSeconds { get; set; } = 0.8;

        public RagdollObject Register(string id, RagdollObjectKind kind, double x, double y, double z, double mass = 20)
        {
            if (string.IsNullOrEmpty(id)) throw new ArgumentException("Пустой идентификатор объекта", nameof(id));
            if (byId.ContainsKey(id)) return byId[id];
            RagdollObject obj = new RagdollObject(id, kind, x, y, z, mass);
            objects.Add(obj);
            byId[id] = obj;
            return obj;
        }

        public RagdollObject Register(string id, string kind, double x, double y, double z, double mass = 20)
        {
            return Register(id, ParseKind(kind), x, y, z, mass);
        }

        public RagdollObject Find(string id)
        {
            if (id == null) return null;
            RagdollObject result;
            return byId.TryGetValue(id, out result) ? result : null;
        }

        public bool Contains(string id) { return Find(id) != null; }

        /// <summary>Приложение импульса. Возвращает true, если предмет опрокинут.</summary>
        public bool ApplyHit(string id, double forceX, double forceY, double forceZ)
        {
            RagdollObject obj = Find(id);
            if (obj == null) return false;
            if (!SystemMath.IsFinite(forceX) || !SystemMath.IsFinite(forceY) || !SystemMath.IsFinite(forceZ))
                throw new ArgumentException("Некорректный импульс", nameof(forceX));

            double invMass = 1 / Math.Max(0.1, obj.Mass);
            obj.Velocity.X += forceX * invMass * 0.55;
            obj.Velocity.Y += forceY * invMass * 0.35;
            obj.Velocity.Z += forceZ * invMass * 0.55;
            double horizontal = Math.Sqrt(forceX * forceX + forceZ * forceZ);
            obj.TiltVelocity += (forceX >= 0 ? 1 : -1) * horizontal * invMass * 0.45;
            obj.Settled = false;

            if (Math.Abs(obj.Tilt) >= obj.ToppleTilt || Math.Abs(obj.Tilt + obj.TiltVelocity * 0.5) >= obj.ToppleTilt)
                obj.Toppled = true;
            return obj.Toppled;
        }

        public bool ApplyHit(string id, BusVector force)
        {
            return ApplyHit(id, force.X, force.Y, force.Z);
        }

        /// <summary>Интеграция движения и затухания до неподвижной («улегшейся») позы.</summary>
        public void Tick(float seconds)
        {
            if (!SystemMath.IsFinite(seconds) || seconds < 0)
                throw new ArgumentOutOfRangeException(nameof(seconds));

            double remaining = seconds;
            const double step = 1.0 / 60.0;
            while (remaining > 0)
            {
                double dt = Math.Min(remaining, step);
                Step(dt);
                remaining -= dt;
            }
        }

        private void Step(double dt)
        {
            foreach (RagdollObject obj in objects)
            {
                if (obj.Settled) continue;

                double damping = Math.Pow(Damping, dt * 60);
                obj.Velocity.X *= damping;
                obj.Velocity.Z *= damping;
                obj.Velocity.Y -= Gravity * dt;
                obj.Position.X += obj.Velocity.X * dt;
                obj.Position.Y += obj.Velocity.Y * dt;
                obj.Position.Z += obj.Velocity.Z * dt;

                obj.Tilt += obj.TiltVelocity * dt;
                obj.TiltVelocity *= Math.Pow(0.86, dt * 60);

                if (Math.Abs(obj.Tilt) >= obj.ToppleTilt) obj.Toppled = true;
                if (obj.Position.Y <= obj.FloorY)
                {
                    obj.Position.Y = obj.FloorY;
                    obj.Velocity.Y = 0;
                    obj.Velocity.X *= GroundFriction;
                    obj.Velocity.Z *= GroundFriction;
                    obj.TiltVelocity *= 0.7;
                }

                double speed = Math.Sqrt(obj.Velocity.X * obj.Velocity.X
                    + obj.Velocity.Y * obj.Velocity.Y + obj.Velocity.Z * obj.Velocity.Z);
                if (speed < 0.02 && Math.Abs(obj.TiltVelocity) < 0.02)
                {
                    SettlePose(obj);
                }
            }
        }

        /// <summary>Мгновенно укладывает предмет/тело в конечную позу.</summary>
        public bool SettlePose(string id)
        {
            RagdollObject obj = Find(id);
            if (obj == null) return false;
            SettlePose(obj);
            return true;
        }

        private static void SettlePose(RagdollObject obj)
        {
            obj.Velocity = new BusVector(0, 0, 0);
            obj.TiltVelocity = 0;
            obj.Position.Y = obj.FloorY;
            obj.Tilt = obj.Toppled ? Math.Sign(obj.Tilt == 0 ? 1 : obj.Tilt) * Math.Max(obj.ToppleTilt, 1.2) : 0;
            obj.Settled = true;
        }

        public bool IsToppled(string id)
        {
            RagdollObject obj = Find(id);
            return obj != null && obj.Toppled;
        }

        public bool IsSettled(string id)
        {
            RagdollObject obj = Find(id);
            return obj != null && obj.Settled;
        }

        public static RagdollObjectKind ParseKind(string kind)
        {
            if (string.IsNullOrEmpty(kind)) return RagdollObjectKind.Other;
            if (kind.IndexOf("chair", StringComparison.OrdinalIgnoreCase) >= 0
                || kind.IndexOf("стул", StringComparison.OrdinalIgnoreCase) >= 0) return RagdollObjectKind.Chair;
            if (kind.IndexOf("stool", StringComparison.OrdinalIgnoreCase) >= 0
                || kind.IndexOf("табурет", StringComparison.OrdinalIgnoreCase) >= 0) return RagdollObjectKind.Stool;
            if (kind.IndexOf("table", StringComparison.OrdinalIgnoreCase) >= 0
                || kind.IndexOf("стол", StringComparison.OrdinalIgnoreCase) >= 0) return RagdollObjectKind.Table;
            if (kind.IndexOf("body", StringComparison.OrdinalIgnoreCase) >= 0
                || kind.IndexOf("тело", StringComparison.OrdinalIgnoreCase) >= 0) return RagdollObjectKind.Body;
            return RagdollObjectKind.Other;
        }
    }
}
