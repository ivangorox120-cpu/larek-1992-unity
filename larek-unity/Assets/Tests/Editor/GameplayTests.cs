using System;
using System.Collections.Generic;
using Larek.Gameplay;
using Larek.Save;
using NUnit.Framework;

public class GameplayTests
{
    [Test]
    public void AdminCodeGateAcceptsOnlyLarek1992()
    {
        var admin = new AdminPanel();
        Assert.AreEqual(false, admin.IsUnlocked);
        Assert.AreEqual("larek1992", AdminPanel.Normalize(" L a r e k 1 9 9 2 "));

        Assert.AreEqual(false, admin.TryUnlock("larek1991"));
        Assert.AreEqual("Неверный код", admin.LastError);
        Assert.AreEqual(false, admin.IsUnlocked);

        Assert.AreEqual(true, admin.TryUnlock("  LAREK  1992  "));
        Assert.AreEqual(true, admin.IsUnlocked);

        var session = GameSession.NewGame(() => 0.5);
        Assert.AreEqual(false, session.TryAdminCode("wrong"));
        Assert.AreEqual("Неверный код", session.Notifications.Peek().Message);
        Assert.AreEqual(true, session.TryAdminCode("larek1992"));
        Assert.AreEqual(true, session.Admin.IsOpen);
    }

    [Test]
    public void InventoryAddsRemovesAndEquipsItems()
    {
        var inventory = new Inventory();

        inventory.Add("cigarettes", 3);
        Assert.AreEqual(3, inventory.Count("cig"));
        Assert.AreEqual(true, inventory.Has("cigarettes"));

        Assert.AreEqual(true, inventory.Remove("cig", 1));
        Assert.AreEqual(2, inventory.Count("cigarettes"));
        Assert.AreEqual(false, inventory.Remove("cig", 5));
        Assert.AreEqual(2, inventory.Count("cigarettes"));

        inventory.Add("guitar", 1);
        Assert.AreEqual(true, inventory.Equip("guitar"));
        Assert.AreEqual("guitar", inventory.Hand);
        Assert.AreEqual(true, inventory.IsHand("guitar"));
        Assert.AreEqual("guitar", inventory.HeldItem);

        inventory.Remove("guitar", 1);
        Assert.AreEqual(true, inventory.IsHandEmpty);
        inventory.Equip("flashlight");
        inventory.ClearHand();
        Assert.AreEqual(false, inventory.IsHand("flashlight"));
    }

    [Test]
    public void NotificationsLiveForTwoSecondsAndStayCappedAtThree()
    {
        var notifications = new NotificationCenter();

        notifications.Show("first");
        Assert.AreEqual(1, notifications.Count);
        notifications.Update(2.0f);
        Assert.AreEqual(1, notifications.Count);
        notifications.Update(0.19f);
        Assert.AreEqual(1, notifications.Count);
        notifications.Update(0.02f);
        Assert.AreEqual(0, notifications.Count);

        notifications.Show("m0");
        notifications.Show("m1");
        notifications.Show("m2");
        notifications.Show("m3");
        Assert.AreEqual(3, notifications.Count);
        Assert.AreEqual("m1", notifications.Messages[0]);
    }

    [Test]
    public void DialoguesOpenSelectAndClose()
    {
        var dialogues = new DialogueSystem();
        int selected = -1;

        dialogues.Show("Телефон", "Кому звонить?", new List<DialogueOption>
        {
            new DialogueOption("opt", "Оптторг", delegate { selected = 0; }),
            new DialogueOption("posyl", "Посылторг", delegate { selected = 1; })
        });

        Assert.AreEqual(true, dialogues.IsOpen);
        Assert.AreEqual("Телефон", dialogues.Name);
        Assert.AreEqual(2, dialogues.Options.Count);

        Assert.AreEqual(true, dialogues.Select(1));
        Assert.AreEqual(1, selected);
        Assert.AreEqual(false, dialogues.IsOpen);
        Assert.AreEqual(false, dialogues.Select(0));
    }

    [Test]
    public void DayCycleIsDeterministicAndAdvancesEconomy()
    {
        var first = new DayCycle(1, 7.5, () => 0.5);
        var second = new DayCycle(1, 7.5, () => 0.5);

        Assert.AreEqual(first.Weather, second.Weather);
        Assert.AreEqual(first.Kind, second.Kind);

        first.Update(1200f);
        second.Update(1200f);
        Assert.AreEqual(first.Day, second.Day);
        Assert.AreEqual(first.Hour, second.Hour, 0.0001);
        Assert.AreEqual(first.Snow, second.Snow, 0.0001);
        Assert.AreEqual(2, first.Day);
        Assert.AreEqual(3.5, first.Hour, 0.0001);

        var session = GameSession.NewGame(() => 0.5);
        int startDay = session.Economy.Day;
        session.Days.NextDay();
        Assert.AreEqual(startDay + 1, session.Economy.Day);
        Assert.AreEqual(session.Economy.Day, session.Days.Day);
    }

    [Test]
    public void ProgressionTracksFlagsAndVisits()
    {
        var progression = new Progression();

        Assert.AreEqual(true, progression.HasFlag(Progression.KeyGiven));
        Assert.AreEqual(true, progression.HasVisited("kiosk"));
        Assert.AreEqual(false, progression.HasFlag("custom"));

        Assert.AreEqual(true, progression.Mark("custom"));
        Assert.AreEqual(false, progression.Mark("custom"));
        Assert.AreEqual(true, progression.HasFlag("custom"));
        Assert.AreEqual(true, progression.ClearFlag("custom"));
        Assert.AreEqual(false, progression.HasFlag("custom"));

        Assert.AreEqual(true, progression.MarkVisited("garages"));
        Assert.AreEqual(true, progression.IsVisited("garages"));
        Assert.AreEqual(true, progression.AddMark("map_x"));
        Assert.AreEqual(true, progression.HasMark("map_x"));
    }

    [Test]
    public void SessionSaveAndExtrasRoundTrip()
    {
        var session = GameSession.NewGame(() => 0.4);
        session.Inventory.Add("guitar", 2);
        session.Inventory.Equip("guitar");
        session.Progression.Mark("customFlag");
        session.Progression.MarkVisited("garages");
        session.Progression.AddMark("map_x");
        session.Notifications.Show("Привет", "good");
        session.Days.NextDay();
        session.Admin.Open();
        session.ApartmentUnlocked = true;
        session.ApartmentOpen = true;
        session.Player.SetPosition(42, 0, 76);

        LarekSave save = session.Capture();
        string extras = session.SerializeExtras();

        var restored = GameSession.NewGame(() => 0.1);
        restored.Restore(save);
        restored.DeserializeExtras(extras);

        Assert.AreEqual(session.Economy.Day, restored.Economy.Day);
        Assert.AreEqual(session.Economy.Money, restored.Economy.Money);
        Assert.AreEqual(42, restored.Player.Position.X, 0.0001);
        Assert.AreEqual(76, restored.Player.Position.Z, 0.0001);
        Assert.AreEqual(2, restored.Inventory.Count("guitar"));
        Assert.AreEqual("guitar", restored.Inventory.Hand);
        Assert.AreEqual(session.Days.Day, restored.Days.Day);
        Assert.AreEqual(session.Days.Hour, restored.Days.Hour, 0.0001);
        Assert.AreEqual(session.Days.Weather, restored.Days.Weather);
        Assert.AreEqual(true, restored.Admin.IsUnlocked);
        Assert.AreEqual(true, restored.Progression.HasFlag("customFlag"));
        Assert.AreEqual(true, restored.Progression.HasVisited("garages"));
        Assert.AreEqual(true, restored.Progression.HasMark("map_x"));
        Assert.AreEqual(true, restored.ApartmentUnlocked);
        Assert.AreEqual("Привет", restored.Notifications.Peek().Message);
    }

    [Test]
    public void RestoreNeverForcesApartmentUnlock()
    {
        var session = GameSession.NewGame(() => 0.2);
        LarekSave save = session.Capture();
        save.ApartmentUnlocked = false;
        save.ApartmentOpen = false;

        var restored = GameSession.NewGame(() => 0.3);
        restored.Progression.Mark("aptUnlocked");
        restored.Restore(save);

        Assert.AreEqual(false, restored.ApartmentUnlocked);
        Assert.AreEqual(false, restored.Progression.HasFlag("aptUnlocked"));
    }

    [Test]
    public void DeserializeExtrasIgnoresMissingAndUnknownKeys()
    {
        var session = GameSession.NewGame(() => 0.5);
        session.Inventory.Add("guitar", 1);
        session.Progression.Mark("customFlag");
        string before = session.SerializeExtras();

        session.DeserializeExtras("# comment\nunknown=42\nday=9\n");

        Assert.AreEqual(9, session.Days.Day);
        Assert.AreEqual(1, session.Inventory.Count("guitar"));
        Assert.AreEqual(true, session.Progression.HasFlag("customFlag"));
        Assert.IsNotEmpty(before);
    }
}
