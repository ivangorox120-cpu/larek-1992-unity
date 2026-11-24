using System;
using System.Collections.Generic;

namespace Larek.Systems
{
    /// <summary>Слот старой фотографии в холодильнике «ЗИЛ · МОСКВА».</summary>
    public sealed class FridgePhoto
    {
        public readonly int Slot;
        public string PhotoId;
        public bool IsOccupied { get { return !string.IsNullOrEmpty(PhotoId); } }

        public FridgePhoto(int slot, string photoId = null)
        {
            Slot = slot;
            PhotoId = photoId;
        }
    }

    /// <summary>
    /// Чистая модель холодильника ЗИЛ-Москва КХ-240: дверь, лампочка, термостат,
    /// температура камеры/морозилки и слоты для старых фото. Никаких Unity API.
    /// </summary>
    public sealed class FridgeSystem
    {
        public const int PhotoSlotCount = 3;
        public const double NormalChamberTemp = 4.5;
        public const double NormalFreezerTemp = -12.0;

        private readonly List<FridgePhoto> photos = new List<FridgePhoto>();
        private bool doorOpenTarget;
        private double doorAngle;

        public FridgeSystem()
        {
            for (int i = 0; i < PhotoSlotCount; i++) photos.Add(new FridgePhoto(i));
        }

        public bool DoorOpen
        {
            get { return doorOpenTarget; }
            set { doorOpenTarget = value; }
        }
        public bool IsDoorOpen { get { return doorOpenTarget; } }
        public double DoorAngle { get { return doorAngle; } }
        public double DoorTargetAngle { get { return doorOpenTarget ? 1.55 : 0; } }
        public bool LightOn { get { return doorAngle > 0.15; } }
        public double Temperature { get; private set; } = NormalChamberTemp;
        public double ChamberTemp { get { return Temperature; } }
        public double FreezerTemperature { get; private set; } = NormalFreezerTemp;
        public double FreezerTemp { get { return FreezerTemperature; } }
        public int Thermostat { get; private set; } = 4;
        public bool CompressorRunning { get; private set; } = true;
        public double FrostLevel { get; private set; } = 0.6;
        public IReadOnlyList<FridgePhoto> Photos { get { return photos.AsReadOnly(); } }
        public int PhotoSlots { get { return photos.Count; } }

        /// <summary>Открыть/закрыть дверь (с плавной анимацией в Tick).</summary>
        public bool OpenClose()
        {
            doorOpenTarget = !doorOpenTarget;
            return doorOpenTarget;
        }

        public void SetDoorOpen(bool open) { doorOpenTarget = open; }

        public void SetThermostat(int value)
        {
            Thermostat = SystemMath.Clamp(value, 1, 7);
        }

        public bool PlacePhoto(int slot, string photoId)
        {
            if (slot < 0 || slot >= photos.Count) return false;
            photos[slot].PhotoId = photoId;
            return true;
        }

        public bool RemovePhoto(int slot)
        {
            if (slot < 0 || slot >= photos.Count) return false;
            photos[slot].PhotoId = null;
            return true;
        }

        public string PhotoAt(int slot)
        {
            return slot >= 0 && slot < photos.Count ? photos[slot].PhotoId : null;
        }

        public void Tick(float seconds)
        {
            if (!SystemMath.IsFinite(seconds) || seconds < 0)
                throw new ArgumentOutOfRangeException(nameof(seconds));
            double dt = seconds;

            double target = DoorTargetAngle;
            doorAngle += (target - doorAngle) * SystemMath.Clamp(dt * 6.5, 0, 1);
            if (Math.Abs(target - doorAngle) < 0.001) doorAngle = target;

            // Открытая дверь греет камеру, компрессор медленно возвращает холод.
            double chamberTarget = doorAngle > 0.15
                ? 12.0 - Thermostat * 0.35
                : NormalChamberTemp - (Thermostat - 4) * 0.6;
            double freezerTarget = doorAngle > 0.15 ? -8.5 : NormalFreezerTemp;
            Temperature += (chamberTarget - Temperature) * SystemMath.Clamp(dt * 0.12, 0, 1);
            FreezerTemperature += (freezerTarget - FreezerTemperature) * SystemMath.Clamp(dt * 0.08, 0, 1);

            CompressorRunning = Temperature > chamberTarget + 0.15;
            FrostLevel = SystemMath.Clamp(FrostLevel + (doorAngle > 0.15 ? dt * 0.01 : -dt * 0.002), 0, 1);
        }
    }
}
