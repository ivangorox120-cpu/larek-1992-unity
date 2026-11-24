using Larek.Interactions;
using NUnit.Framework;

public class DoorTests
{
    [Test]
    public void EntranceCodeUnlocksForSixSecondsButDoesNotOpenDoor()
    {
        var door = new EntranceDoor();
        Assert.IsFalse(door.EnterCode("0000"));
        Assert.AreEqual(DoorResult.Locked, door.UseHandle(true, 1));
        Assert.IsTrue(door.EnterCode("1992"));
        Assert.IsFalse(door.IsOpen);
        door.Tick(5.99f);
        Assert.AreEqual(DoorResult.Opened, door.UseHandle(true, 1));
        Assert.AreEqual(DoorResult.Closed, door.UseHandle(true, 1));
        door.Tick(0.02f);
        Assert.AreEqual(DoorResult.Locked, door.UseHandle(true, 1));
    }

    [Test]
    public void ExitButtonReleasesLock()
    {
        var door = new EntranceDoor();
        door.PressExitButton();
        Assert.AreEqual(DoorResult.Opened, door.UseHandle(true, 0.5f));
    }

    [Test]
    public void ApartmentStaysLockedOnRestoreAndNeedsKeyOutside()
    {
        var door = new ApartmentDoor(false, false);
        Assert.AreEqual(DoorResult.KeyRequired, door.UseHandle(true, 0.5f, false, false));
        Assert.AreEqual(DoorResult.Opened, door.UseHandle(true, 0.5f, false, true));
        Assert.AreEqual(DoorResult.Closed, door.UseHandle(true, 0.5f, false, false));
        Assert.IsFalse(door.IsUnlocked);
        Assert.AreEqual(DoorResult.KeyRequired, door.UseHandle(true, 0.5f, false, false));
        Assert.AreEqual(DoorResult.Opened, door.UseHandle(true, 0.5f, true, false));
    }

    [Test]
    public void HandlesRequireAimAndReach()
    {
        var door = new ApartmentDoor(false, true);
        Assert.AreEqual(DoorResult.TooFar, door.UseHandle(true, 1.01f, false, false));
        Assert.AreEqual(DoorResult.NotAimingAtHandle, door.UseHandle(false, 0.5f, false, false));
        Assert.AreEqual(DoorResult.Opened, door.UseHandle(true, 1f, false, false));
    }
}
