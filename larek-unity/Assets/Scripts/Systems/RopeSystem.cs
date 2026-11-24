using System;

namespace Larek.Systems
{
    public enum RopeClimbState
    {
        Detached,
        Ready,
        Climbing,
        AtTop,
        AtBottom
    }

    /// <summary>
    /// Вертикальная лестница/верёвка к чердачному люку (M33). джойстик вверх — подъём,
    /// вниз — спуск; состояние и длина с провисанием хранятся без Unity API.
    /// </summary>
    public sealed class RopeSystem
    {
        public const double LadderClimbSpeed = 0.62; // м/с — как в world.js: -iz * .62

        private double length = 3.5;
        private double slack = 0.25;
        private double height;
        private double minHeight;
        private double maxHeight = 3.5;
        private double joystick;
        private RopeClimbState state = RopeClimbState.Detached;

        public double Length
        {
            get { return length; }
            set
            {
                if (!SystemMath.IsFinite(value) || value < 0)
                    throw new ArgumentOutOfRangeException(nameof(value));
                length = value;
                if (state == RopeClimbState.Detached) maxHeight = value;
                if (height > maxHeight) height = maxHeight;
            }
        }

        /// <summary>Провисание верёвки (м).</summary>
        public double Slack
        {
            get { return slack; }
            set { slack = Math.Max(0, value); }
        }

        public double Height { get { return height; } }
        public double ClimbHeight { get { return height; } }
        public double MinHeight { get { return minHeight; } }
        public double MaxHeight { get { return maxHeight; } }
        public double RemainingSlack { get { return Math.Max(0, length - (height - minHeight)); } }
        public RopeClimbState State { get { return state; } }
        public RopeClimbState ClimbState { get { return state; } }
        public bool IsClimbing { get { return state == RopeClimbState.Climbing; } }
        public bool IsAttached { get { return state != RopeClimbState.Detached; } }
        public bool AtTop { get { return state == RopeClimbState.AtTop; } }
        public bool AtBottom { get { return state == RopeClimbState.AtBottom; } }
        public int ClimbDirection { get { return joystick > 0 ? 1 : joystick < 0 ? -1 : 0; } }
        public double Joystick { get { return joystick; } }
        public bool HatchOpen { get; private set; }

        public RopeSystem()
        {
        }

        public RopeSystem(double length)
        {
            Length = length;
        }

        /// <summary>Присоединение к лестнице: по умолчанию от 0 до Length метров.</summary>
        public bool Attach(double bottomHeight = 0, double topHeight = -1)
        {
            if (!SystemMath.IsFinite(bottomHeight)) return false;
            double top = topHeight < 0 ? length : topHeight;
            if (top <= bottomHeight) return false;
            minHeight = bottomHeight;
            maxHeight = top;
            height = bottomHeight;
            joystick = 0;
            state = RopeClimbState.AtBottom;
            return true;
        }

        public void Detach()
        {
            state = RopeClimbState.Detached;
            joystick = 0;
            height = minHeight;
        }

        /// <summary>Положительное значение — вверх (джойстик вверх), отрицательное — вниз.</summary>
        public void SetJoystick(double vertical)
        {
            if (!SystemMath.IsFinite(vertical)) return;
            joystick = SystemMath.Clamp(vertical, -1, 1);
            if (state == RopeClimbState.Detached) return;
            if (Math.Abs(joystick) < 0.2)
            {
                joystick = 0;
                if (state == RopeClimbState.Climbing) state = RopeClimbState.Ready;
                return;
            }
            state = RopeClimbState.Climbing;
        }

        public void SetJoystick(double horizontal, double vertical)
        {
            SetJoystick(vertical);
        }

        /// <summary>Преобразование старого ввода world.js (input.my &lt; 0 означает «вверх»).</summary>
        public void SetOriginalLadderInput(double moveY)
        {
            SetJoystick(-moveY);
        }

        public bool ClimbUp(float seconds)
        {
            if (!IsAttached) return false;
            SetJoystick(1);
            Tick(seconds);
            SetJoystick(0);
            return height >= maxHeight - 1e-6;
        }

        public bool ClimbDown(float seconds)
        {
            if (!IsAttached) return false;
            SetJoystick(-1);
            Tick(seconds);
            SetJoystick(0);
            return height <= minHeight + 1e-6;
        }

        public void Tick(float seconds)
        {
            if (!SystemMath.IsFinite(seconds) || seconds < 0)
                throw new ArgumentOutOfRangeException(nameof(seconds));
            if (!IsAttached || joystick == 0) return;

            height = SystemMath.Clamp(height + joystick * LadderClimbSpeed * seconds, minHeight, maxHeight);
            if (height >= maxHeight - 1e-9)
            {
                height = maxHeight;
                state = RopeClimbState.AtTop;
                joystick = 0;
            }
            else if (height <= minHeight + 1e-9)
            {
                height = minHeight;
                state = RopeClimbState.AtBottom;
                joystick = 0;
            }
            else
            {
                state = RopeClimbState.Climbing;
            }
        }

        public bool ToggleHatch()
        {
            HatchOpen = !HatchOpen;
            return HatchOpen;
        }
    }
}
