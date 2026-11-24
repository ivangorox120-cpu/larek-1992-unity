using System.Collections.Generic;
using Larek.Porting;
using NUnit.Framework;

public class PortCoverageTests
{
    [Test]
    public void EveryRegistryMechanicHasAnImplementationTarget()
    {
        var expected = new List<string>();
        for (int i = 1; i <= 43; i++) expected.Add("M" + i.ToString("00"));
        expected.Add("M90");

        Assert.AreEqual(expected.Count, MechanicsCoverage.All.Count);
        foreach (string code in expected)
        {
            MechanicEntry entry = MechanicsCoverage.Find(code);
            Assert.IsNotNull(entry, "Missing registry entry " + code);
            Assert.IsNotEmpty(entry.Behaviour, code + " has no description");
            Assert.IsNotEmpty(entry.Implementation, code + " has no implementation target");
        }
    }

    [Test]
    public void NoDuplicateMechanicCodes()
    {
        var seen = new HashSet<string>();
        foreach (MechanicEntry entry in MechanicsCoverage.All)
            Assert.IsTrue(seen.Add(entry.Code), "Duplicate code " + entry.Code);
    }
}
