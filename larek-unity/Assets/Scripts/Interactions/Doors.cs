using System;

namespace Larek.Interactions
{
    public enum DoorResult { Opened, Closed, TooFar, NotAimingAtHandle, Locked, KeyRequired }

    public static class DoorReach
    {
        public static DoorResult? Check(bool aimingAtHandle, float distanceMeters)
        {
            if (float.IsNaN(distanceMeters) || float.IsInfinity(distanceMeters) || distanceMeters < 0 || distanceMeters > 1f)
                return DoorResult.TooFar;
            if (!aimingAtHandle) return DoorResult.NotAimingAtHandle;
            return null;
        }
    }

    public sealed class EntranceDoor
    {
        public bool IsOpen { get; private set; }
        public float UnlockSecondsRemaining { get; private set; }

        public bool EnterCode(string code)
        {
            if (code != "1992") return false;
            UnlockSecondsRemaining = 6f;
            return true;
        }

        public void PressExitButton() => UnlockSecondsRemaining = 6f;

        public void Tick(float seconds)
        {
            if (float.IsNaN(seconds) || float.IsInfinity(seconds) || seconds < 0)
                throw new ArgumentOutOfRangeException(nameof(seconds));
            UnlockSecondsRemaining = Math.Max(0f, UnlockSecondsRemaining - seconds);
        }

        public DoorResult UseHandle(bool aimingAtHandle, float distanceMeters)
        {
            DoorResult? reach = DoorReach.Check(aimingAtHandle, distanceMeters);
            if (reach.HasValue) return reach.Value;
            if (IsOpen) { IsOpen = false; return DoorResult.Closed; }
            if (UnlockSecondsRemaining <= 0f) return DoorResult.Locked;
            IsOpen = true;
            return DoorResult.Opened;
        }
    }

    public sealed class ApartmentDoor
    {
        public bool IsOpen { get; private set; }
        public bool IsUnlocked { get; private set; }

        public ApartmentDoor(bool isOpen, bool isUnlocked)
        {
            IsOpen = isOpen;
            IsUnlocked = isUnlocked;
        }

        public DoorResult UseHandle(bool aimingAtHandle, float distanceMeters, bool inside, bool holdingKey)
        {
            DoorResult? reach = DoorReach.Check(aimingAtHandle, distanceMeters);
            if (reach.HasValue) return reach.Value;
            if (IsOpen)
            {
                IsOpen = false;
                if (!inside) IsUnlocked = false;
                return DoorResult.Closed;
            }
            if (!IsUnlocked && !inside && !holdingKey) return DoorResult.KeyRequired;
            IsUnlocked = true;
            IsOpen = true;
            return DoorResult.Opened;
        }
    }
}
