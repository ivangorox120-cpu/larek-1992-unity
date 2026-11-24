using System;
using System.Collections.Generic;

namespace Larek.Systems
{
    public enum NpcOutfit
    {
        Winter,
        Summer,
        Mid
    }

    public enum NpcActivity
    {
        Idle,
        Patrol,
        Talk,
        Ragdoll
    }

    /// <summary>Чистая модель прохожего: поза, маршрут, диалог, состояние ragdoll.</summary>
    public sealed class NpcPerson
    {
        public readonly string Id;
        public string DisplayName;
        public bool IsFemale;
        public NpcOutfit Outfit;
        public NpcActivity Activity = NpcActivity.Idle;
        public BusVector Position;
        public readonly List<BusVector> Waypoints = new List<BusVector>();
        public int WaypointIndex;
        public double MoveSpeed = 1.25;
        public double TalkRemaining;
        public string DialogueId;
        public double HitForce;

        public bool Ragdolled { get { return Activity == NpcActivity.Ragdoll; } }
        public bool Talking { get { return Activity == NpcActivity.Talk && TalkRemaining > 0; } }

        public NpcPerson(string id, string displayName, bool female, NpcOutfit outfit, double x, double z)
        {
            Id = id;
            DisplayName = displayName;
            IsFemale = female;
            Outfit = outfit;
            Position = new BusVector(x, 0, z);
        }
    }

    /// <summary>
    /// Реестр NPC. Женщины из PEOPLE_FEMALE и оригинальные id из npc.js/world.js.
    /// Конкуренты и наём продавца отключены (M03/M05).
    /// </summary>
    public sealed class NpcSystem
    {
        public const double StrongHitForce = 8.0;

        private static readonly string[] FemaleIds =
        {
            "Anna", "Galina", "Elena", "Irina"
        };

        private static readonly string[] OriginalIds =
        {
            "lvz_petrovich", "fw_meat_1", "fw_meat_2", "fw_meat_3", "fw_meat_4",
            "fw_bread_1", "fw_bread_2", "fw_lvz_1", "fw_lvz_2",
            "mihalych", "olya", "serega", "nyura", "marat"
        };

        private readonly List<NpcPerson> people = new List<NpcPerson>();
        private readonly Dictionary<string, NpcPerson> byId = new Dictionary<string, NpcPerson>(StringComparer.OrdinalIgnoreCase);

        /// <summary>Найм продавца отключён в оригинале: S.seller = false.</summary>
        public static bool SellerEnabled { get { return false; } }
        /// <summary>Конкурентов в игре нет.</summary>
        public static bool CompetitorsEnabled { get { return false; } }
        public static bool TryHireSeller() { return false; }

        public NpcOutfit Outfit { get; private set; }
        public IReadOnlyList<NpcPerson> People { get { return people.AsReadOnly(); } }
        public IReadOnlyList<NpcPerson> Npcs { get { return people.AsReadOnly(); } }
        public int Count { get { return people.Count; } }
        public double StrongHitThreshold { get; set; } = StrongHitForce;
        public double TalkSeconds { get; set; } = 4.0;

        public NpcSystem() : this(NpcOutfit.Winter, true)
        {
        }

        public NpcSystem(NpcOutfit outfit, bool seedRoster = true)
        {
            Outfit = outfit;
            if (seedRoster) SeedRoster();
        }

        public static IReadOnlyList<string> FemaleNames
        {
            get { return Array.AsReadOnly(FemaleIds); }
        }

        public static IReadOnlyList<string> OriginalNpcIds
        {
            get { return Array.AsReadOnly(OriginalIds); }
        }

        public static bool IsFemaleName(string id)
        {
            if (string.IsNullOrEmpty(id)) return false;
            foreach (string name in FemaleIds)
                if (string.Equals(name, id, StringComparison.OrdinalIgnoreCase)) return true;
            return false;
        }

        /// <summary>Диалог, который выдаёт разговор с NPC (идентификатор для Larek.Gameplay.Dialogues).</summary>
        public static string DialogueFor(string id)
        {
            if (string.IsNullOrEmpty(id)) return string.Empty;
            if (string.Equals(id, "olya", StringComparison.OrdinalIgnoreCase)
                || string.Equals(id, "nyura", StringComparison.OrdinalIgnoreCase)
                || string.Equals(id, "serega", StringComparison.OrdinalIgnoreCase)
                || string.Equals(id, "mihalych", StringComparison.OrdinalIgnoreCase))
                return "reg_" + id.ToLowerInvariant();
            if (id.IndexOf("fw_meat", StringComparison.OrdinalIgnoreCase) >= 0) return "factory_meat";
            if (id.IndexOf("fw_bread", StringComparison.OrdinalIgnoreCase) >= 0) return "factory_bread";
            if (id.IndexOf("fw_lvz", StringComparison.OrdinalIgnoreCase) >= 0
                || string.Equals(id, "lvz_petrovich", StringComparison.OrdinalIgnoreCase)) return "factory_lvz";
            return "dialog_" + id;
        }

        /// <summary>Регистрация NPC. Продавцы и конкуренты отклоняются (M03/M05).</summary>
        public bool Register(NpcPerson person)
        {
            if (person == null || string.IsNullOrEmpty(person.Id)) return false;
            if (IsSeller(person.Id) || IsCompetitor(person.Id)) return false;
            if (byId.ContainsKey(person.Id)) return false;
            person.Outfit = Outfit;
            people.Add(person);
            byId[person.Id] = person;
            return true;
        }

        public NpcPerson Register(string id, string displayName = null, bool? female = null,
            NpcOutfit? outfit = null, double x = 0, double z = 0)
        {
            if (string.IsNullOrEmpty(id) || IsSeller(id) || IsCompetitor(id) || byId.ContainsKey(id)) return null;
            bool isFemale = female.HasValue ? female.Value : IsFemaleName(id);
            NpcPerson person = new NpcPerson(id, displayName ?? id, isFemale,
                outfit.HasValue ? outfit.Value : Outfit, x, z);
            person.DialogueId = DialogueFor(id);
            Register(person);
            return person;
        }

        public NpcPerson Find(string id)
        {
            if (id == null) return null;
            NpcPerson result;
            return byId.TryGetValue(id, out result) ? result : null;
        }

        public bool Contains(string id) { return Find(id) != null; }

        public void SetOutfit(NpcOutfit outfit)
        {
            Outfit = outfit;
            foreach (NpcPerson person in people) person.Outfit = outfit;
        }

        public void AddWaypoint(string id, double x, double z)
        {
            NpcPerson person = Find(id);
            if (person == null) return;
            person.Waypoints.Add(new BusVector(x, 0, z));
            if (person.Waypoints.Count == 1) person.Activity = NpcActivity.Patrol;
        }

        /// <summary>Разговор: возвращает идентификатор диалога или пустую строку, если NPC нет.</summary>
        public string TalkTo(string id)
        {
            NpcPerson person = Find(id);
            if (person == null || person.Ragdolled) return string.Empty;
            string dialogue = string.IsNullOrEmpty(person.DialogueId) ? DialogueFor(person.Id) : person.DialogueId;
            person.DialogueId = dialogue;
            person.Activity = NpcActivity.Talk;
            person.TalkRemaining = TalkSeconds;
            return dialogue;
        }

        /// <summary>Сильный удар переводит тело в ragdoll; слабый — только запоминает силу.</summary>
        public bool ApplyHit(string id, double forceX, double forceY, double forceZ)
        {
            NpcPerson person = Find(id);
            if (person == null) return false;
            double magnitude = Math.Sqrt(forceX * forceX + forceY * forceY + forceZ * forceZ);
            person.HitForce = magnitude;
            if (magnitude < StrongHitThreshold || person.Ragdolled) return false;
            person.Activity = NpcActivity.Ragdoll;
            person.TalkRemaining = 0;
            return true;
        }

        public bool TriggerRagdoll(string id, double force)
        {
            return ApplyHit(id, force, 0, 0);
        }

        public bool Revive(string id)
        {
            NpcPerson person = Find(id);
            if (person == null || !person.Ragdolled) return false;
            person.Activity = person.Waypoints.Count > 0 ? NpcActivity.Patrol : NpcActivity.Idle;
            person.HitForce = 0;
            return true;
        }

        /// <summary>Простой патруль по waypoint-ам и таймер реплики.</summary>
        public void Tick(float seconds)
        {
            if (!SystemMath.IsFinite(seconds) || seconds < 0)
                throw new ArgumentOutOfRangeException(nameof(seconds));

            double dt = seconds;
            foreach (NpcPerson person in people)
            {
                if (person.TalkRemaining > 0)
                {
                    person.TalkRemaining = Math.Max(0, person.TalkRemaining - dt);
                    if (person.TalkRemaining == 0 && person.Activity == NpcActivity.Talk)
                        person.Activity = person.Waypoints.Count > 0 ? NpcActivity.Patrol : NpcActivity.Idle;
                }
                if (person.Activity != NpcActivity.Patrol || person.Waypoints.Count == 0) continue;

                if (person.WaypointIndex >= person.Waypoints.Count) person.WaypointIndex = 0;
                BusVector target = person.Waypoints[person.WaypointIndex];
                double dx = target.X - person.Position.X, dz = target.Z - person.Position.Z;
                double remaining = Math.Sqrt(dx * dx + dz * dz);
                double step = Math.Max(0, person.MoveSpeed) * dt;
                if (remaining <= step || remaining < 0.01)
                {
                    person.Position = target;
                    person.WaypointIndex = (person.WaypointIndex + 1) % person.Waypoints.Count;
                    continue;
                }
                person.Position = new BusVector(
                    person.Position.X + dx / remaining * step,
                    0,
                    person.Position.Z + dz / remaining * step);
            }
        }

        private static bool IsSeller(string id)
        {
            return id.IndexOf("seller", StringComparison.OrdinalIgnoreCase) >= 0
                || id.IndexOf("продав", StringComparison.OrdinalIgnoreCase) >= 0;
        }

        private static bool IsCompetitor(string id)
        {
            return id.IndexOf("competitor", StringComparison.OrdinalIgnoreCase) >= 0
                || id.IndexOf("rival", StringComparison.OrdinalIgnoreCase) >= 0
                || id.IndexOf("конкурент", StringComparison.OrdinalIgnoreCase) >= 0;
        }

        private void SeedRoster()
        {
            Register(new NpcPerson("Anna", "Анна", true, Outfit, 8, 12));
            Register(new NpcPerson("Galina", "Галина", true, Outfit, 203, -28.6));
            Register(new NpcPerson("Elena", "Елена", true, Outfit, 159.8, 29.8));
            Register(new NpcPerson("Irina", "Ирина", true, Outfit, 21, 64));
            foreach (string id in OriginalIds) Register(id, null, IsFemaleName(id), Outfit, 0, 0);

            // Небольшие патрульные маршруты у ларька и остановок.
            NpcPerson anna = Find("Anna");
            if (anna != null)
            {
                anna.Waypoints.Add(new BusVector(8, 0, 12));
                anna.Waypoints.Add(new BusVector(12, 0, 8.4));
                anna.Activity = NpcActivity.Patrol;
            }
            NpcPerson nyura = Find("nyura");
            if (nyura != null)
            {
                nyura.Waypoints.Add(new BusVector(8, 0, 10));
                nyura.Waypoints.Add(new BusVector(4, 0, 14));
                nyura.Activity = NpcActivity.Patrol;
            }
            foreach (NpcPerson person in people)
                if (string.IsNullOrEmpty(person.DialogueId)) person.DialogueId = DialogueFor(person.Id);
        }
    }
}
