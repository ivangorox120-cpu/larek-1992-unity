using System;
using System.Collections.Generic;

namespace Larek.Porting
{
    public sealed class MechanicEntry
    {
        public readonly string Code;
        public readonly string Behaviour;
        public readonly string Implementation;

        public MechanicEntry(string code, string behaviour, string implementation)
        {
            Code = code;
            Behaviour = behaviour;
            Implementation = implementation;
        }
    }

    public static class MechanicsCoverage
    {
        public static readonly IReadOnlyList<MechanicEntry> All = Array.AsReadOnly(new[]
        {
            new MechanicEntry("M01", "Админ-панель открывается только по коду larek1992", "Larek.Gameplay.AdminPanel.TryUnlock"),
            new MechanicEntry("M02", "В меню героя убраны курс валюты, долг заводским, «Торговля без разрешения» и «(в цифрах)»", "Larek.UI.HudController (by omission)"),
            new MechanicEntry("M03", "Найм продавца отключён", "Larek.Systems.NpcSystem (seller disabled)"),
            new MechanicEntry("M04", "Площадь Ленина и телепорт удалены", "Larek.Systems.TransportSystem (route without square)"),
            new MechanicEntry("M05", "Конкуренты отсутствуют", "Larek.Systems.NpcSystem (no competitors)"),
            new MechanicEntry("M06", "Дверь открывается только прицелом на ручку не дальше 1 м", "Larek.Interactions.DoorReach.Check"),
            new MechanicEntry("M07", "Во время игры на гитаре кнопка инвентаря скрыта", "Larek.Systems.HandSystem.PlayingGuitar"),
            new MechanicEntry("M08", "Подсказка гитары видна 3 с", "Larek.Systems.HandSystem guitar hint"),
            new MechanicEntry("M09", "У всех 8 остановок есть заездной карман, автобус плавно заезжает и выезжает", "Larek.Systems.TransportSystem"),
            new MechanicEntry("M10", "Текстуры с текстом имеют мип-карты и не мерцают", "Larek.World.WorldBuilder"),
            new MechanicEntry("M11", "Загрузка сохранения не отпирает дверь квартиры насильно", "Larek.Interactions.ApartmentDoor"),
            new MechanicEntry("M12", "Английский замок: захлопнутую снаружи дверь открывает только ключ", "Larek.Interactions.ApartmentDoor.UseHandle"),
            new MechanicEntry("M20", "Снаружи дверь подъезда заперта магнитным замком", "Larek.Interactions.EntranceDoor"),
            new MechanicEntry("M21", "Домофон: код набирается при каждом входе", "Larek.Systems.PhoneSystem"),
            new MechanicEntry("M22", "Домофон: код 1992 отпускает замок на 6 с", "Larek.Systems.PhoneSystem.Submit"),
            new MechanicEntry("M23", "Домофон: после таймаута ручка снова заперта", "Larek.Interactions.EntranceDoor.Tick"),
            new MechanicEntry("M24", "Изнутри выход только через кнопку «ВЫХОД»", "Larek.Interactions.EntranceDoor.PressExitButton"),
            new MechanicEntry("M25", "Кнопка «ВЫХОД» подаёт сигнал", "Larek.Systems.AudioSystem (beep)"),
            new MechanicEntry("M26", "Кнопка «ВЫХОД» щёлкает магнитом", "Larek.Systems.AudioSystem (magnet click)"),
            new MechanicEntry("M30", "Захлопнул дверь снаружи — нужен ключ в руке", "Larek.Interactions.ApartmentDoor.UseHandle"),
            new MechanicEntry("M31", "С ключом в руке доступен «открыть ключом»", "Larek.Systems.HandSystem + Larek.Gameplay.Inventory"),
            new MechanicEntry("M32", "Ручка дальше ~1 м не срабатывает", "Larek.Interactions.DoorReach.Check"),
            new MechanicEntry("M33", "Подъём и спуск к люку джойстиком вверх/вниз", "Larek.Systems.RopeSystem + Larek.World.WorldInteractions"),
            new MechanicEntry("M40", "Лампа ларька горит, пока ларёк в кадре", "Larek.World.WorldBuilder"),
            new MechanicEntry("M41", "Ни один павильон не стоит на проезжей части", "Larek.Systems.TransportSystem.ValidateStops"),
            new MechanicEntry("M42", "Всё попадающее в кадр рисуется; расхождение с отсечением <0.1%", "Larek.World.WorldBuilder"),
            new MechanicEntry("M43", "ПАЗ-652: ровные резиновые уплотнители плоских окон", "Larek.World.WorldBuilder"),
            new MechanicEntry("M90", "Нет ошибок при загрузке и прогоне проверок", "Larek.Porting.PortValidator")
        });

        public static bool Contains(string code)
        {
            if (code == null) return false;
            foreach (MechanicEntry entry in All)
                if (entry.Code == code) return true;
            return false;
        }

        public static MechanicEntry Find(string code)
        {
            foreach (MechanicEntry entry in All)
                if (entry.Code == code) return entry;
            return null;
        }
    }
}
