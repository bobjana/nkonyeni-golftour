import { describe, expect, it } from "vitest";
import { buildChecklist, fmtDate, roundMinutes, shiftTime, type ChecklistInput } from "./checklist";

const input: ChecklistInput = {
  days: [
    {
      id: "d1",
      number: 1,
      date: "2026-11-13",
      course: "Royal Swazi Spa",
      sessions: [{ id: "s1", slot: "PM", format: "better_ball", holes: 18, teeTime: "12:30", pairingDeadline: null }],
    },
    {
      id: "d2",
      number: 2,
      date: "2026-11-14",
      course: "Nkonyeni",
      sessions: [
        { id: "s2", slot: "AM", format: "better_ball", holes: 18, teeTime: "07:30", pairingDeadline: "06:30" },
        { id: "s3", slot: "PM", format: "foursomes", holes: 9, teeTime: "13:00", pairingDeadline: null },
      ],
    },
  ],
};

describe("shiftTime", () => {
  it("adds and subtracts minutes, wrapping past midnight", () => {
    expect(shiftTime("12:30", -90)).toBe("11:00");
    expect(shiftTime("07:30", -30)).toBe("07:00");
    expect(shiftTime("13:00", 270)).toBe("17:30");
    expect(shiftTime("13:00", 180)).toBe("16:00");
    expect(shiftTime("00:15", -30)).toBe("23:45");
  });
});

describe("fmtDate", () => {
  it("formats a date string", () => {
    expect(fmtDate("2026-11-13")).toBe("Fri, 13 Nov");
  });
});

describe("roundMinutes", () => {
  it("estimates 4h30 for 18 holes and 2h30 for 9", () => {
    expect(roundMinutes(18)).toBe(270);
    expect(roundMinutes(9)).toBe(150);
  });
});

describe("buildChecklist", () => {
  const sections = buildChecklist(input);

  it("starts with the timeless setup section", () => {
    expect(sections[0].id).toBe("setup");
    expect(sections[0].items.every((i) => i.at === null)).toBe(true);
  });

  it("orders each day after setup with one item per schedule step", () => {
    const d1 = sections.find((s) => s.id === "d1")!;
    expect(d1.title).toBe("Day 1");
    expect(d1.subtitle).toBe("Fri, 13 Nov · Royal Swazi Spa");
    expect(d1.items.map((i) => i.label)).toEqual([
      "Open pairings to captains — afternoon",
      "Publish draw & go live — afternoon",
      "Tee-off — afternoon",
      "Scores in — afternoon complete (estimate)",
      "Resolve score checks & Reveal to everyone",
    ]);
  });

  it("derives times from tee-off and the pairing deadline, in run-of-show order", () => {
    const d1 = sections.find((s) => s.id === "d1")!;
    expect(d1.items.map((i) => i.at?.time)).toEqual(["11:00", "12:00", "12:30", "17:00", "17:30"]);
    const d2 = sections.find((s) => s.id === "d2")!;
    // AM open uses the session's own pairing deadline
    expect(d2.items[0].at?.time).toBe("06:30");
    // PM open falls back to tee − 90, and sorts before the AM "scores in"
    expect(d2.items[3].at?.time).toBe("11:30");
    // 9-hole PM round: tee + 2h30, reveal + 30
    expect(d2.items[8].at?.time).toBe("16:00");
  });

  it("links items to their admin pages", () => {
    const d1 = sections.find((s) => s.id === "d1")!;
    expect(d1.items[0].href).toBe("/admin/sessions/s1");
    expect(d1.items.at(-1)!.href).toBe("/admin/reveal?day=d1");
    expect(sections[0].items[0].href).toBe("/admin/teams");
  });

  it("has no reveal item for a day with no sessions", () => {
    const empty = buildChecklist({ days: [{ id: "d9", number: 9, date: "2026-11-20", course: "X", sessions: [] }] });
    const d9 = empty.find((s) => s.id === "d9")!;
    expect(d9.items).toHaveLength(0);
  });
});
