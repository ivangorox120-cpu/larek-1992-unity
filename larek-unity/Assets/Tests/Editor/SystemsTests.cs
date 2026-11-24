using System;
using System.Collections.Generic;
using Larek.Interactions;
using Larek.Systems;
using NUnit.Framework;

public class SystemsTests
{
    [Test]
    public void TransportStopsKeepOriginalOrderAndPockets()
    {
        Assert.AreEqual(8, TransportSystem.Stops.Count);
        string[] expected =
        {
            "kiosk", "factory", "bakery_return", "sizo",
            "rovd", "kiosk_return", "lvz_return", "garages"
        };
        for (int i = 0; i < expected.Length; i++)
            Assert.AreEqual(expected[i], TransportSystem.Stops[i].Id);

        IReadOnlyList<string> problems;
        Assert.IsTrue(TransportSystem.ValidateStops(out problems));
        Assert.AreEqual(0, problems.Count);

        foreach (TransportStop stop in TransportSystem.Stops)
        {
            Assert.IsTrue(stop.PocketOffset != 0, stop.Id + " без кармана");
            Assert.IsTrue(stop.PocketAxis == "x" || stop.PocketAxis == "z");
            Assert.IsTrue(stop.ShelterOutsideRoadway(), stop.Id + " на проезжей части");
        }
        Assert.IsNull(TransportSystem.StopById("lenin_square"));
        Assert.IsNull(TransportSystem.StopById("площадь_ленина"));
    }

    [Test]
    public void BusOpensDoorsAndLeavesPocketSmoothly()
    {
        var bus = new TransportSystem();
        bus.DwellSeconds = 2.0;
        Assert.IsTrue(bus.Arrive("kiosk"));
        Assert.AreEqual(BusState.AtStop, bus.State);
        Assert.AreEqual("kiosk", bus.CurrentStopId);
        Assert.Greater(Math.Abs(bus.PocketOffset), 0.1);

        bus.Tick(0.5f);
        Assert.AreEqual(BusState.AtStop, bus.State);
        Assert.Greater(bus.DoorOpen, 0);

        bus.Tick(0.6f);
        Assert.AreEqual(BusState.Boarding, bus.State);
        Assert.AreEqual(1, bus.DoorOpen, 0.001);

        bus.Tick(1.0f);
        Assert.AreEqual(BusState.LeavingPocket, bus.State);
        BusVector before = bus.BusPosition;
        bus.Tick(0.25f);
        Assert.Less(before.HorizontalDistanceTo(bus.BusPosition), 5.0);
        Assert.Greater(bus.DistanceAlongRoute, 0);
    }

    [Test]
    public void PhoneAccepts1992OnlyAndExpiresAfterSixSeconds()
    {
        var phone = new PhoneSystem();
        Assert.IsFalse(phone.Submit("1234"));
        Assert.AreEqual(PhoneSystem.PromptRejected, phone.Prompt);
        Assert.IsFalse(phone.IsUnlocked);

        Assert.IsTrue(phone.Submit("1992"));
        Assert.AreEqual(PhoneSystem.PromptAccepted, phone.Prompt);
        Assert.AreEqual(PhoneSystem.UnlockSeconds, phone.UnlockSecondsRemaining, 0.001f);
        Assert.AreEqual(0, phone.DigitCount);
        Assert.AreEqual(2, phone.HistoryCount);
        Assert.IsTrue(phone.LastCall.Accepted);

        Assert.AreEqual(DoorResult.Opened, phone.Intercom.UseHandle(true, 0.5f));
        Assert.AreEqual(DoorResult.Closed, phone.Intercom.UseHandle(true, 0.5f));
        phone.Tick(5.99f);
        Assert.IsTrue(phone.IsUnlocked);
        phone.Tick(0.02f);
        Assert.IsFalse(phone.IsUnlocked);
        Assert.AreEqual(DoorResult.Locked, phone.Intercom.UseHandle(true, 0.5f));
    }

    [Test]
    public void PhoneRequiresCodeOnEachEntry()
    {
        var phone = new PhoneSystem();
        Assert.IsTrue(phone.RequireCodeEveryEntry);
        Assert.IsTrue(phone.Submit("1992"));
        phone.Tick(PhoneSystem.UnlockSeconds + 0.1f);
        Assert.IsFalse(phone.IsUnlocked);
        Assert.IsFalse(phone.Submit("0000"));
        Assert.IsTrue(phone.Submit("1992"));
        Assert.AreEqual(3, phone.HistoryCount);
    }

    [Test]
    public void WeaponReloadsTwoShellsAndRespectsFireCooldown()
    {
        var weapon = new WeaponSystem();
        Assert.IsTrue(weapon.Reload(2));
        Assert.AreEqual(2, weapon.Shells);
        Assert.AreEqual(2, weapon.Ammo);
        Assert.AreEqual(0, weapon.Reserve);
        Assert.AreEqual(WeaponState.Loaded, weapon.State);
        CollectionAssert.Contains(weapon.AudioEvents, WeaponSystem.EventOpen);
        CollectionAssert.Contains(weapon.AudioEvents, WeaponSystem.EventShell);
        CollectionAssert.Contains(weapon.AudioEvents, WeaponSystem.EventClose);

        int shots = 0;
        Assert.IsTrue(weapon.Fire(() => shots++));
        Assert.AreEqual(1, shots);
        Assert.AreEqual(1, weapon.Shells);
        Assert.AreEqual(1, weapon.SpentShells);
        Assert.AreEqual(WeaponSystem.EventShot, weapon.LastAudioEvent);
        Assert.IsFalse(weapon.Fire(), "второй выстрел раньше задержки невозможен");

        weapon.Tick((float)WeaponSystem.FireCooldownSeconds + 0.02f);
        Assert.IsTrue(weapon.Fire());
        Assert.AreEqual(0, weapon.Shells);
        Assert.AreEqual(2, weapon.ShotsFired);
        weapon.Tick((float)WeaponSystem.FireCooldownSeconds + 0.02f);
        Assert.AreEqual(WeaponState.InHand, weapon.State);
    }

    [Test]
    public void WeaponCanAddReserveAndReloadAgain()
    {
        var weapon = new WeaponSystem(1);
        Assert.AreEqual(1, weapon.Shells);
        weapon.Fire();
        weapon.Tick(0.4f);
        weapon.AddRounds(3);
        Assert.AreEqual(3, weapon.Reserve);
        Assert.IsTrue(weapon.Reload(0));
        Assert.AreEqual(2, weapon.Shells);
        Assert.AreEqual(1, weapon.Reserve);
        Assert.AreEqual(3, weapon.TotalShells);
    }

    [Test]
    public void GuitarHidesInventoryAndShowsHintForThreeSeconds()
    {
        var hand = new HandSystem();
        Assert.IsTrue(hand.InventoryButtonVisible);
        Assert.IsTrue(hand.Equip("guitar"));
        Assert.AreEqual(HandPose.Guitar, hand.CurrentPose);
        Assert.IsTrue(hand.PlayingGuitar);
        Assert.IsFalse(hand.InventoryButtonVisible);
        Assert.AreEqual(HandSystem.GuitarHintSeconds, hand.GuitarHintRemaining, 0.001f);
        Assert.IsTrue(hand.GuitarHintVisible);

        hand.Tick(2.99f);
        Assert.IsTrue(hand.GuitarHintVisible);
        hand.Tick(0.02f);
        Assert.IsFalse(hand.GuitarHintVisible);
        Assert.IsTrue(hand.PlayingGuitar);

        hand.Unequip();
        Assert.IsFalse(hand.PlayingGuitar);
        Assert.IsTrue(hand.InventoryButtonVisible);
    }

    [Test]
    public void HandPoseAliasesUnderstandOriginalItemIds()
    {
        Assert.AreEqual(HandPose.Gun, HandSystem.PoseFor("weapon"));
        Assert.AreEqual(HandPose.Key, HandSystem.PoseFor("apartment_key"));
        Assert.AreEqual(HandPose.Phone, HandSystem.PoseFor("domofon"));
        Assert.AreEqual(HandPose.Drink, HandSystem.PoseFor("vodka"));
        Assert.AreEqual(HandPose.None, HandSystem.PoseFor("unknown"));
    }

    [Test]
    public void RopeClimbsUpAndDownWithJoystick()
    {
        var rope = new RopeSystem(3.5);
        Assert.IsTrue(rope.Attach());
        Assert.AreEqual(RopeClimbState.AtBottom, rope.State);

        rope.SetJoystick(1);
        rope.Tick(1f);
        Assert.AreEqual(RopeSystem.LadderClimbSpeed, rope.Height, 0.0001);
        Assert.AreEqual(RopeClimbState.Climbing, rope.State);

        rope.SetOriginalLadderInput(-1); // в world.js отрицательное my означает подъём
        rope.Tick(1f);
        Assert.AreEqual(RopeSystem.LadderClimbSpeed * 2, rope.Height, 0.0001);

        rope.SetJoystick(-1);
        rope.Tick(10f);
        Assert.AreEqual(RopeClimbState.AtBottom, rope.State);
        Assert.AreEqual(0, rope.Height, 0.0001);

        rope.SetJoystick(1);
        rope.Tick(10f);
        Assert.AreEqual(RopeClimbState.AtTop, rope.State);
        Assert.AreEqual(rope.MaxHeight, rope.Height, 0.0001);
    }

    [Test]
    public void FridgeDoorControlsLightAndPhotoSlots()
    {
        var fridge = new FridgeSystem();
        Assert.IsFalse(fridge.DoorOpen);
        Assert.IsFalse(fridge.LightOn);
        Assert.AreEqual(FridgeSystem.PhotoSlotCount, fridge.PhotoSlots);

        Assert.IsTrue(fridge.OpenClose());
        fridge.Tick(0.3f);
        Assert.Greater(fridge.DoorAngle, 0);
        Assert.IsTrue(fridge.LightOn);

        Assert.IsFalse(fridge.OpenClose());
        fridge.Tick(1.5f);
        Assert.AreEqual(0, fridge.DoorAngle, 0.001);
        Assert.IsFalse(fridge.LightOn);

        Assert.IsTrue(fridge.PlacePhoto(1, "photo_1992"));
        Assert.AreEqual("photo_1992", fridge.PhotoAt(1));
        Assert.IsTrue(fridge.RemovePhoto(1));
        Assert.IsNull(fridge.PhotoAt(1));
        Assert.IsFalse(fridge.PlacePhoto(7, "photo"));

        fridge.SetThermostat(99);
        Assert.AreEqual(7, fridge.Thermostat);
        fridge.SetThermostat(-5);
        Assert.AreEqual(1, fridge.Thermostat);
    }

    [Test]
    public void ControlsHaveRussianDefaultsAndSettingsTabs()
    {
        CollectionAssert.AreEqual(
            new[] { "Графика", "Геймплей", "Звук", "Система" },
            ControlsSystem.SettingsTabs);

        var controls = new ControlsSystem();
        Assert.AreEqual(ControlsSystem.DefaultProfile, controls.Profile);
        Assert.AreEqual("KeyE", controls.GetBinding("interact"));
        Assert.AreEqual("JoystickUp", controls.LadderUpBinding);
        Assert.AreEqual("JoystickDown", controls.LadderDownBinding);
        Assert.GreaterOrEqual(controls.ElementCount, 24);
        Assert.IsNotNull(controls.FindElement("in"));
        Assert.AreEqual("Действие", controls.FindElement("in").Label);

        Assert.IsTrue(controls.SetSettingsTab("Звук"));
        Assert.AreEqual("Звук", controls.SelectedTabName);
        Assert.IsTrue(controls.SetSettingsTab("gfx"));
        Assert.AreEqual(SettingsTab.Graphics, controls.SelectedTab);
        Assert.IsFalse(controls.SetSettingsTab("нет такой вкладки"));
    }

    [Test]
    public void ControlsBindAndSerializationRoundTrip()
    {
        var controls = new ControlsSystem();
        Assert.IsTrue(controls.Bind("interact", "KeyF"));
        controls.LookSensitivity = 1.75;
        controls.InvertY = true;
        controls.SetScreenJoystick(0, -0.8);
        Assert.IsTrue(controls.LadderUpPressed);
        Assert.IsTrue(controls.MoveElement("in", 0.7, 0.8));

        string data = controls.Serialize();
        Assert.IsNotEmpty(data);
        StringAssert.Contains("version=1", data);
        StringAssert.Contains("KeyF", data);

        var restored = new ControlsSystem();
        Assert.IsTrue(restored.Deserialize(data));
        Assert.AreEqual("KeyF", restored.GetBinding("interact"));
        Assert.AreEqual(controls.GetBinding("ladder_up"), restored.GetBinding("ladder_up"));
        Assert.AreEqual(1.75, restored.LookSensitivity, 0.0001);
        Assert.IsTrue(restored.InvertY);
        Assert.IsTrue(restored.LadderUpPressed);
        Assert.AreEqual(0.7, restored.FindElement("in").X, 0.0001);
        Assert.AreEqual("Действие", restored.FindElement("in").Label);

        Assert.IsFalse(restored.Deserialize(null));
        Assert.IsFalse(restored.Deserialize("это не сохранение"));

        restored.ResetDefaults();
        Assert.AreEqual("KeyE", restored.GetBinding("interact"));
        Assert.AreEqual(1, restored.LookSensitivity, 0.0001);
        Assert.IsFalse(restored.InvertY);
    }

    [Test]
    public void ControlsTranslateBothJoystickConventionsForLadder()
    {
        var controls = new ControlsSystem();
        controls.SetScreenJoystick(0, 0.8);
        Assert.IsTrue(controls.LadderDownPressed);
        Assert.IsFalse(controls.LadderUpPressed);

        controls.SetOriginalLadderInput(1);
        Assert.IsTrue(controls.LadderDownPressed);

        controls.SetOriginalLadderInput(-1);
        Assert.IsTrue(controls.LadderUpPressed);
        Assert.AreEqual(1, controls.LadderDirection);

        controls.SetScreenJoystick(0, 0.05);
        Assert.AreEqual(0, controls.LadderDirection);
    }

    [Test]
    public void AudioCatalogueMapsAllOriginalFiles()
    {
        Assert.AreEqual(27, AudioSystem.Count);
        Assert.AreEqual(27, AudioSystem.Clips.Count);
        foreach (AudioClipInfo clip in AudioSystem.Clips)
        {
            Assert.IsNotEmpty(clip.Id);
            Assert.IsNotEmpty(clip.FileName);
            Assert.AreEqual(clip.Id, AudioSystem.EventFor(clip.FileName), clip.FileName);
            Assert.AreEqual("Game/audio/" + clip.FileName, clip.StreamingPath);
        }

        Assert.AreEqual("shot", AudioSystem.EventFor("gunshot"));
        Assert.AreEqual("shot", AudioSystem.EventFor("gun_shot.mp3"));
        Assert.AreEqual("anthem", AudioSystem.EventFor("anthem1992.mp3"));
        Assert.AreEqual("stuk", AudioSystem.EventFor("magnet_click"));
        Assert.AreEqual("stuk", AudioSystem.EventFor("beep"));
        Assert.AreEqual("walk_snow", AudioSystem.EventFor("footsteps_snow"));
        Assert.AreEqual("tv_ch10", AudioSystem.EventFor("tv_ch10.mp3"));
        Assert.IsNull(AudioSystem.EventFor("нет_такого_звука"));
        Assert.AreEqual("Game/audio/shot.mp3", AudioSystem.Find("shot").StreamingPath);
        Assert.IsTrue(AudioSystem.Find("city").Loop);
    }

    [Test]
    public void NpcRosterDisablesSellerAndCompetitors()
    {
        Assert.IsFalse(NpcSystem.SellerEnabled);
        Assert.IsFalse(NpcSystem.CompetitorsEnabled);
        Assert.IsFalse(NpcSystem.TryHireSeller());

        var npcs = new NpcSystem();
        Assert.IsNull(npcs.Register("seller_1"));
        Assert.IsNull(npcs.Register("competitor_1"));
        Assert.IsTrue(npcs.Contains("marat"));
        Assert.IsTrue(npcs.Contains("olya"));
        Assert.AreEqual("factory_meat", NpcSystem.DialogueFor("fw_meat_2"));

        Assert.IsTrue(npcs.ApplyHit("marat", NpcSystem.StrongHitForce, 0, 0));
        Assert.IsTrue(npcs.Find("marat").Ragdolled);
        Assert.IsTrue(npcs.Revive("marat"));
        Assert.IsFalse(npcs.Find("marat").Ragdolled);
    }

    [Test]
    public void RagdollTopplesAndSettlesOnFloor()
    {
        var ragdoll = new RagdollSystem();
        RagdollObject chair = ragdoll.Register("chair", RagdollObjectKind.Chair, 0, 1, 0, 20);
        Assert.IsTrue(ragdoll.ApplyHit("chair", 320, 0, 0));
        ragdoll.Tick(2f);
        Assert.IsTrue(ragdoll.IsToppled("chair"));
        Assert.IsTrue(ragdoll.IsSettled("chair"));
        Assert.AreEqual(chair.FloorY, chair.Position.Y, 0.0001);
        Assert.AreEqual(0, chair.Velocity.X, 0.0001);
    }
}
