using System;
using System.Collections.Generic;

namespace Larek.Systems
{
    /// <summary>Состояния автобуса ПАЗ-3205 маршрута № 7.</summary>
    public enum BusState
    {
        EnRoute,
        EnteringPocket,
        AtStop,
        Boarding,
        LeavingPocket
    }

    /// <summary>Описание остановки из js/transport.js (STOPS) с параметрами заездного кармана.</summary>
    public sealed class TransportStop
    {
        public readonly string Id;
        public readonly string Name;
        public readonly double X;
        public readonly double StopX;
        public readonly double StopZ;
        public readonly double ShelterX;
        public readonly double ShelterZ;
        public readonly double ShelterRotation;
        public readonly double SideZ;
        public readonly double LaneZ;
        public readonly bool North;
        public readonly string Orientation;

        /// <summary>Ось дороги: 'x' — дорога вдоль X (смещение кармана по Z), 'z' — вдоль Z (смещение по X).</summary>
        public readonly string PocketAxis;
        /// <summary>Смещение автобуса к бордюру в кармане (м).</summary>
        public readonly double PocketOffset;
        /// <summary>Длина «полной» части кармана (м).</summary>
        public readonly double PocketFullLength;
        /// <summary>Длина S-образного съезда в карман (м).</summary>
        public readonly double PocketRampLength;

        /// <summary>Положение остановки на замкнутом маршруте (заполняется конструктором маршрута).</summary>
        public double RouteDistance { get; internal set; }

        public TransportStop(string id, string name, double x, double stopX, double stopZ,
            double shelterX, double shelterZ, double shelterRotation, double sideZ, double laneZ,
            bool north, string orientation, string pocketAxis, double pocketOffset,
            double pocketFullLength = 4.5, double pocketRampLength = 8.5)
        {
            Id = id;
            Name = name;
            X = x;
            StopX = stopX;
            StopZ = stopZ;
            ShelterX = shelterX;
            ShelterZ = shelterZ;
            ShelterRotation = shelterRotation;
            SideZ = sideZ;
            LaneZ = laneZ;
            North = north;
            Orientation = orientation;
            PocketAxis = pocketAxis;
            PocketOffset = pocketOffset;
            PocketFullLength = pocketFullLength;
            PocketRampLength = pocketRampLength;
        }

        /// <summary>Проверка M41: павильон не стоит на проезжей части.</summary>
        public bool ShelterOutsideRoadway(double roadwayHalfWidth = 2.2)
        {
            double lateral = PocketAxis == "z"
                ? Math.Abs(ShelterX - StopX)
                : Math.Abs(ShelterZ - LaneZ);
            return lateral >= roadwayHalfWidth + 1.0;
        }

        public BusVector ShelterPosition { get { return new BusVector(ShelterX, 0, ShelterZ); } }
        public BusVector StopPosition { get { return new BusVector(StopX, 0, StopZ); } }
    }

    /// <summary>
    /// Чистая модель городского маршрута № 7 с восемью остановками (M09), заездными карманами
    /// и плавным движением без телепортов и без площади Ленина (M04). Нет зависимостей от Unity.
    /// </summary>
    public sealed class TransportSystem
    {
        public const double MaxSpeed = 12.5;
        public const double Acceleration = 1.5;
        public const double BrakeAcceleration = 6.0;
        public const double StopBrake = 1.6;
        public const double StopTriggerDistance = 0.6;
        public const double DefaultDwellSeconds = 8.0;
        public const double DefaultPocketSeconds = 4.0;

        private const double Pi = Math.PI;

        private static readonly TransportStop[] StopsInternal = new[]
        {
            new TransportStop("kiosk", "Ул. Советская (Ларёк)", 8, 6.8, 8.4, 8.0, 3.55, -Pi / 2, 5.2, 8.4, false, "S", "x", -1.85),
            new TransportStop("factory", "Краснозаводский Мясокомбинат", 219, 219.0, 3.4, 219.0, -0.85, -Pi / 2, 0.2, 3.4, false, "S", "x", -1.35),
            new TransportStop("bakery_return", "Краснозаводский Хлебозавод", 169.6, 169.6, 30.8, 174.55, 29.6, Pi, 29.6, 29.6, true, "W", "z", 1.75),
            new TransportStop("sizo", "СИЗО № 1 («Кресты») · ул. Ленина", 60.4, 60.4, 89.5, 55.45, 89.5, 0, 89.5, 89.5, false, "E", "z", -1.75, 1.6, 4.4),
            new TransportStop("rovd", "Участок милиции · ул. Советская", -30, -31.2, 61.6, -30.0, 66.5, Pi / 2, 64.8, 61.6, true, "N", "x", 1.5),
            new TransportStop("kiosk_return", "Квартира героя (Ул. Советская, 14)", 21, 19.8, 61.6, 21.0, 66.5, Pi / 2, 64.4, 61.6, true, "N", "x", 1.5),
            new TransportStop("lvz_return", "Краснозаводский Ликёро-водочный", 63.6, 63.6, 46.5, 68.55, 46.5, Pi, 46.5, 46.5, true, "W", "z", 1.75),
            new TransportStop("garages", "ГСК «Советский» (Гаражи / Марат)", 36, 34.8, 8.4, 36.0, 3.55, -Pi / 2, 5.2, 8.4, false, "S", "x", -1.85),
        };

        // Маршрут 1 из js/world.js: полное кольцо города и промзоны, 8 остановок, без площади Ленина.
        private static readonly double[][] BusRoute = new[]
        {
            new double[] { 56, 8.4 }, new double[] { 34.8, 8.4 }, new double[] { 6.8, 8.4 },
            new double[] { -74.0, 8.4 }, new double[] { -81.0, 8.9 }, new double[] { -84.4, 11.2 },
            new double[] { -85.6, 15.0 }, new double[] { -85.6, 46.8 }, new double[] { -85.6, 56.0 },
            new double[] { -84.2, 59.8 }, new double[] { -80.5, 61.6 }, new double[] { -31.2, 61.6 },
            new double[] { 19.8, 61.6 }, new double[] { 40.8, 61.6 }, new double[] { 55.0, 61.6 },
            new double[] { 58.6, 63.0 }, new double[] { 60.4, 66.5 }, new double[] { 60.4, 93.8 },
            new double[] { 60.4, 96.0 }, new double[] { 61.8, 99.0 }, new double[] { 65.5, 99.6 },
            new double[] { 164.0, 99.6 }, new double[] { 168.2, 98.2 }, new double[] { 169.6, 94.5 },
            new double[] { 169.6, 30.8 }, new double[] { 169.6, 11.5 }, new double[] { 171.0, 8.4 },
            new double[] { 174.5, 7.0 }, new double[] { 236.0, 7.0 }, new double[] { 240.5, 5.2 },
            new double[] { 236.0, 3.4 }, new double[] { 219.0, 3.4 }, new double[] { 175.0, 3.4 },
            new double[] { 170.6, 4.8 }, new double[] { 167.6, 7.5 }, new double[] { 166.4, 11.5 },
            new double[] { 166.4, 55.0 }, new double[] { 165.2, 57.6 }, new double[] { 162.0, 58.4 },
            new double[] { 66.0, 58.4 }, new double[] { 64.2, 56.6 }, new double[] { 63.6, 53.0 },
            new double[] { 63.6, 46.5 }, new double[] { 63.6, 16.0 }, new double[] { 62.2, 11.2 },
            new double[] { 59.5, 9.0 }
        };

        private readonly List<double[]> routePoints = new List<double[]>();
        private readonly double[] cumulative;
        private readonly double routeLength;
        private readonly HashSet<int> served = new HashSet<int>();

        private BusState state = BusState.EnRoute;
        private int currentStopIndex = -1;
        private int nextStopIndex = -1;
        private double distance;
        private double speed;
        private double heading;
        private double pocketPhase;
        private double stopTimer;
        private double doorOpen;
        private BusVector busPosition;
        private double elapsed;

        public double DwellSeconds { get; set; } = DefaultDwellSeconds;
        public double PocketSeconds { get; set; } = DefaultPocketSeconds;
        public Action<int> OnArrive { get; set; }
        public Action<int> OnDepart { get; set; }

        public TransportSystem()
        {
            BuildRoute();
            cumulative = new double[routePoints.Count + 1];
            for (int i = 0; i < routePoints.Count; i++)
            {
                double[] a = routePoints[i];
                double[] b = routePoints[(i + 1) % routePoints.Count];
                double dx = b[0] - a[0], dz = b[1] - a[1];
                cumulative[i + 1] = cumulative[i] + Math.Sqrt(dx * dx + dz * dz);
            }
            routeLength = cumulative[routePoints.Count];

            // Положения остановок и порядок объезда вычисляются по замкнутому маршруту, без телепортов.
            for (int i = 0; i < StopsInternal.Length; i++)
                StopsInternal[i].RouteDistance = NearestRouteDistance(StopsInternal[i].StopX, StopsInternal[i].StopZ);

            distance = 120; // как в оригинале: B_.s = 120
            nextStopIndex = FindNextStopIndex(false);
            busPosition = PositionAt(distance, 0);
            heading = HeadingAt(distance);
        }

        /// <summary>Восемь остановок в порядке из STOPS оригинальной игры.</summary>
        public static IReadOnlyList<TransportStop> Stops
        {
            get { return Array.AsReadOnly(StopsInternal); }
        }

        public int StopCount { get { return StopsInternal.Length; } }
        public double RouteLength { get { return routeLength; } }
        public double DistanceAlongRoute { get { return distance; } }
        public double Speed { get { return speed; } }
        public double Heading { get { return heading; } }
        public double DoorOpen { get { return doorOpen; } }
        public double Elapsed { get { return elapsed; } }
        public BusState State { get { return state; } }

        /// <summary>Индекс текущей остановки (совпадает с индексом в Stops) или -1 в пути.</summary>
        public int CurrentStop { get { return currentStopIndex; } }
        public int CurrentStopIndex { get { return currentStopIndex; } }
        public TransportStop CurrentStopInfo
        {
            get { return currentStopIndex >= 0 && currentStopIndex < StopsInternal.Length ? StopsInternal[currentStopIndex] : null; }
        }
        public string CurrentStopId { get { return CurrentStopInfo == null ? string.Empty : CurrentStopInfo.Id; } }
        public string CurrentStopName { get { return CurrentStopInfo == null ? string.Empty : CurrentStopInfo.Name; } }
        public int NextStopIndex { get { return nextStopIndex; } }
        public TransportStop NextStopInfo
        {
            get { return nextStopIndex >= 0 && nextStopIndex < StopsInternal.Length ? StopsInternal[nextStopIndex] : null; }
        }

        /// <summary>Позиция автобуса (X/Y/Z, двойная точность).</summary>
        public BusVector BusPosition { get { return busPosition; } }
        public BusVector Position { get { return busPosition; } }
        public double BusX { get { return busPosition.X; } }
        public double BusY { get { return busPosition.Y; } }
        public double BusZ { get { return busPosition.Z; } }

        /// <summary>Текущее боковое смещение в заездном кармане (м).</summary>
        public double PocketOffset { get; private set; }
        public double PocketPhase { get { return pocketPhase; } }
        public double StopTimer { get { return stopTimer; } }

        /// <summary>Проверка M41: ни один павильон не выходит на проезжую часть.</summary>
        public static bool ValidateStops()
        {
            IReadOnlyList<string> unused;
            return ValidateStops(out unused);
        }

        public static bool ValidateStops(out IReadOnlyList<string> problems)
        {
            List<string> list = new List<string>();
            if (StopsInternal.Length != 8)
                list.Add("Ожидалось 8 остановок, фактически " + StopsInternal.Length);

            HashSet<string> ids = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (TransportStop stop in StopsInternal)
            {
                if (string.IsNullOrEmpty(stop.Id)) list.Add("Пустой идентификатор остановки");
                else if (!ids.Add(stop.Id)) list.Add("Повтор идентификатора остановки: " + stop.Id);
                if (stop.PocketAxis != "x" && stop.PocketAxis != "z")
                    list.Add("Неизвестная ось кармана у " + stop.Id);
                if (stop.PocketOffset == 0)
                    list.Add("Нет заездного кармана у " + stop.Id);
                if (!stop.ShelterOutsideRoadway())
                    list.Add("Павильон на проезжей части: " + stop.Id);
            }
            problems = list.AsReadOnly();
            return list.Count == 0;
        }

        public static IReadOnlyList<string> ValidateStopOffsets()
        {
            IReadOnlyList<string> problems;
            ValidateStops(out problems);
            return problems;
        }

        public static TransportStop StopById(string id)
        {
            if (id == null) return null;
            foreach (TransportStop stop in StopsInternal)
                if (string.Equals(stop.Id, id, StringComparison.OrdinalIgnoreCase)) return stop;
            return null;
        }

        public static bool IsValidStopIndex(int index)
        {
            return index >= 0 && index < StopsInternal.Length;
        }

        public bool Arrive(int stop)
        {
            if (!IsValidStopIndex(stop)) throw new ArgumentOutOfRangeException(nameof(stop));
            TransportStop target = StopsInternal[stop];
            distance = target.RouteDistance;
            speed = 0;
            state = BusState.AtStop;
            currentStopIndex = stop;
            nextStopIndex = stop;
            pocketPhase = 1;
            stopTimer = 0;
            doorOpen = 0;
            served.Add(stop);
            RefreshPosition();
            if (OnArrive != null) OnArrive(stop);
            return true;
        }

        public bool Arrive(string stopId)
        {
            TransportStop stop = StopById(stopId);
            if (stop == null) return false;
            return Arrive(Array.IndexOf(StopsInternal, stop));
        }

        /// <summary>Отправление от остановки: дверь закрывается, автобус плавно выезжает из кармана.</summary>
        public bool Depart()
        {
            if (state != BusState.AtStop && state != BusState.Boarding && state != BusState.EnteringPocket)
                return false;
            state = BusState.LeavingPocket;
            stopTimer = 0;
            if (OnDepart != null) OnDepart(currentStopIndex);
            currentStopIndex = -1;
            return true;
        }

        /// <summary>Плавное моделирование с фиксированным внутренним шагом (без телепортов).</summary>
        public void Tick(float seconds)
        {
            if (!SystemMath.IsFinite(seconds) || seconds < 0)
                throw new ArgumentOutOfRangeException(nameof(seconds));

            double remaining = seconds;
            const double step = 1.0 / 60.0;
            while (remaining > 0)
            {
                double h = Math.Min(remaining, step);
                Step(h);
                remaining -= h;
            }
            RefreshPosition();
        }

        private void Step(double dt)
        {
            elapsed += dt;
            double ahead = DistanceToNextStop();

            switch (state)
            {
                case BusState.EnRoute:
                {
                    double target = TargetSpeed(ahead);
                    speed += SystemMath.Clamp(target - speed, -BrakeAcceleration * dt, Acceleration * dt);
                    distance = SystemMath.Wrap(distance + speed * dt, routeLength);
                    ahead = DistanceToNextStop();
                    double reach = PocketReach(nextStopIndex);
                    if (ahead <= reach && speed > 0.05)
                    {
                        state = BusState.EnteringPocket;
                        pocketPhase = 0;
                    }
                    if (ahead <= StopTriggerDistance && speed < 0.3)
                        ReachStop();
                    break;
                }
                case BusState.EnteringPocket:
                {
                    double target = TargetSpeed(ahead);
                    speed += SystemMath.Clamp(target - speed, -BrakeAcceleration * dt, Acceleration * dt);
                    distance = SystemMath.Wrap(distance + speed * dt, routeLength);
                    pocketPhase = SystemMath.Clamp(pocketPhase + dt / Math.Max(0.1, PocketSeconds), 0, 1);
                    ahead = DistanceToNextStop();
                    if (ahead <= StopTriggerDistance && speed < 0.3)
                        ReachStop();
                    else if (ahead > PocketReach(nextStopIndex) + 1)
                        state = BusState.EnRoute;
                    break;
                }
                case BusState.AtStop:
                {
                    speed = 0;
                    stopTimer += dt;
                    doorOpen = SystemMath.SmoothStep(stopTimer / 1.0);
                    if (stopTimer >= 1.0)
                    {
                        doorOpen = 1;
                        state = BusState.Boarding;
                    }
                    break;
                }
                case BusState.Boarding:
                {
                    speed = 0;
                    stopTimer += dt;
                    doorOpen = 1;
                    if (stopTimer >= Math.Max(1.0, DwellSeconds))
                        state = BusState.LeavingPocket;
                    break;
                }
                case BusState.LeavingPocket:
                {
                    speed += SystemMath.Clamp(4.5 - speed, -BrakeAcceleration * dt, Acceleration * dt);
                    distance = SystemMath.Wrap(distance + speed * dt, routeLength);
                    pocketPhase -= dt / Math.Max(0.1, PocketSeconds);
                    doorOpen = Math.Max(0.0, doorOpen - dt * 1.25);
                    if (pocketPhase <= 0)
                    {
                        pocketPhase = 0;
                        state = BusState.EnRoute;
                        nextStopIndex = FindNextStopIndex(false);
                    }
                    break;
                }
            }
        }

        private void ReachStop()
        {
            int stop = nextStopIndex;
            if (stop < 0)
            {
                served.Clear();
                stop = FindNextStopIndex(false);
                if (stop < 0) return;
            }
            distance = StopsInternal[stop].RouteDistance;
            speed = 0;
            currentStopIndex = stop;
            state = BusState.AtStop;
            stopTimer = 0;
            doorOpen = 0;
            pocketPhase = 1;
            served.Add(stop);
            if (OnArrive != null) OnArrive(stop);
        }

        private double TargetSpeed(double ahead)
        {
            double target = MaxSpeed;
            if (ahead < 40)
                target = Math.Min(target, Math.Sqrt(2 * StopBrake * Math.Max(0, ahead - 0.3)));
            return target;
        }

        private double PocketReach(int stopIndex)
        {
            if (!IsValidStopIndex(stopIndex)) return 13;
            TransportStop stop = StopsInternal[stopIndex];
            return stop.PocketFullLength + stop.PocketRampLength;
        }

        private double DistanceToNextStop()
        {
            if (!IsValidStopIndex(nextStopIndex)) return routeLength;
            return SystemMath.Wrap(StopsInternal[nextStopIndex].RouteDistance - distance, routeLength);
        }

        private int FindNextStopIndex(bool ignoreServed)
        {
            int best = -1;
            double bestDistance = double.MaxValue;
            for (int i = 0; i < StopsInternal.Length; i++)
            {
                if (!ignoreServed && served.Contains(i)) continue;
                double ds = SystemMath.Wrap(StopsInternal[i].RouteDistance - distance, routeLength);
                if (ds <= 1.0) continue;
                if (ds < bestDistance)
                {
                    bestDistance = ds;
                    best = i;
                }
            }
            if (best < 0 && !ignoreServed)
            {
                served.Clear();
                return FindNextStopIndex(true);
            }
            return best;
        }

        private void RefreshPosition()
        {
            busPosition = PositionAt(distance, pocketPhase);
            heading = HeadingAt(distance);
        }

        /// <summary>Координаты точки маршрута по пройденному расстоянию.</summary>
        public BusVector RoutePointAt(double s)
        {
            if (routePoints.Count == 0) return new BusVector(0, 0, 0);
            double d = SystemMath.Wrap(s, routeLength);
            int lo = 0, hi = routePoints.Count - 1;
            while (lo < hi)
            {
                int mid = (lo + hi) >> 1;
                if (cumulative[mid + 1] < d) lo = mid + 1;
                else hi = mid;
            }
            double[] a = routePoints[lo];
            double[] b = routePoints[(lo + 1) % routePoints.Count];
            double segLength = cumulative[lo + 1] - cumulative[lo];
            double t = segLength > 0 ? (d - cumulative[lo]) / segLength : 0;
            return new BusVector(a[0] + (b[0] - a[0]) * t, 0, a[1] + (b[1] - a[1]) * t);
        }

        private double HeadingAt(double s)
        {
            BusVector a = RoutePointAt(s);
            BusVector b = RoutePointAt(s + 2.8);
            double dx = b.X - a.X, dz = b.Z - a.Z;
            if (Math.Abs(dx) + Math.Abs(dz) < 1e-6) return heading;
            return Math.Atan2(dz, dx);
        }

        /// <summary>Боковое смещение кармана в точке маршрута (S-кривая, как в оригинале).</summary>
        public double PocketOffsetAt(double s)
        {
            BusVector p = RoutePointAt(s);
            for (int i = 0; i < StopsInternal.Length; i++)
            {
                TransportStop stop = StopsInternal[i];
                double lat, lon;
                if (stop.PocketAxis == "z")
                {
                    lat = Math.Abs(p.X - stop.StopX);
                    lon = Math.Abs(p.Z - stop.StopZ);
                }
                else
                {
                    lat = Math.Abs(p.Z - stop.StopZ);
                    lon = Math.Abs(p.X - stop.StopX);
                }
                if (lat > 2.2 || lon >= stop.PocketFullLength + stop.PocketRampLength) continue;
                double u = SystemMath.Clamp(1 - Math.Max(0, lon - stop.PocketFullLength) / stop.PocketRampLength, 0, 1);
                return stop.PocketOffset * SystemMath.SmoothStep(u);
            }
            return 0;
        }

        private BusVector PositionAt(double s, double phase)
        {
            BusVector p = RoutePointAt(s);
            double offset = PocketOffsetAt(s) * SystemMath.Clamp(phase, 0, 1);
            PocketOffset = offset;
            if (StopsInternal.Length > 0)
            {
                for (int i = 0; i < StopsInternal.Length; i++)
                {
                    TransportStop stop = StopsInternal[i];
                    double lat = stop.PocketAxis == "z" ? Math.Abs(p.X - stop.StopX) : Math.Abs(p.Z - stop.StopZ);
                    double lon = stop.PocketAxis == "z" ? Math.Abs(p.Z - stop.StopZ) : Math.Abs(p.X - stop.StopX);
                    if (lat > 2.2 || lon >= stop.PocketFullLength + stop.PocketRampLength) continue;
                    if (stop.PocketAxis == "z") p.X += offset;
                    else p.Z += offset;
                    break;
                }
            }
            return p;
        }

        private double NearestRouteDistance(double x, double z)
        {
            double best = 0, bestDistance = double.MaxValue;
            for (double s = 0; s < routeLength; s += 0.5)
            {
                BusVector p = RoutePointAt(s);
                double dx = p.X - x, dz = p.Z - z;
                double d = dx * dx + dz * dz;
                if (d < bestDistance)
                {
                    bestDistance = d;
                    best = s;
                }
            }
            return best;
        }

        private void BuildRoute()
        {
            routePoints.Clear();
            int n = BusRoute.Length;
            for (int i = 0; i < n; i++)
            {
                double[] prev = BusRoute[(i - 1 + n) % n];
                double[] cur = BusRoute[i];
                double[] next = BusRoute[(i + 1) % n];
                double v1x = prev[0] - cur[0], v1z = prev[1] - cur[1];
                double v2x = next[0] - cur[0], v2z = next[1] - cur[1];
                double l1 = Math.Sqrt(v1x * v1x + v1z * v1z);
                double l2 = Math.Sqrt(v2x * v2x + v2z * v2z);
                if (l1 < 1e-9) l1 = 1;
                if (l2 < 1e-9) l2 = 1;
                double dot = (v1x * v2x + v1z * v2z) / (l1 * l2);
                if (dot > -0.985 && l1 > 1.2 && l2 > 1.2)
                {
                    double radius = Math.Min(4.5, Math.Min(l1 * 0.38, l2 * 0.38));
                    double ax = cur[0] + v1x / l1 * radius, az = cur[1] + v1z / l1 * radius;
                    double bx = cur[0] + v2x / l2 * radius, bz = cur[1] + v2z / l2 * radius;
                    const int segments = 6;
                    for (int k = 0; k <= segments; k++)
                    {
                        double t = (double)k / segments, u = 1 - t;
                        routePoints.Add(new double[]
                        {
                            u * u * ax + 2 * u * t * cur[0] + t * t * bx,
                            u * u * az + 2 * u * t * cur[1] + t * t * bz
                        });
                    }
                }
                else
                {
                    routePoints.Add(new double[] { cur[0], cur[1] });
                }
            }
        }
    }
}
