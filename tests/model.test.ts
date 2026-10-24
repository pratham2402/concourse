import { describe, expect, it } from "vitest";
import { venue } from "../data/venue";
import { getPick } from "../data/picks";
import { checkConstraints, optimize, pickPartner } from "../lib/model";
import { choosePartner } from "../lib/recommend";
import type { Partner } from "../lib/types";

const stand = venue.stands[0];
const familyStand = venue.stands.find((item) => item.id === "s3")!;

function partner(overrides: Partial<Partner> = {}): Partner {
  return {
    name: "Mofongo El Mocano",
    entityId: "test",
    type: "urn:entity:place",
    rank: 1,
    description: "Local restaurant",
    tags: ["restaurant", "takeout"],
    priceLevel: 2,
    popularity: 0.8,
    neighborhood: "The Bronx",
    city: "New York",
    imageUrl: null,
    evidence: [{ seedId: stand.seedEntityId, effect: 1 }],
    ...overrides,
  };
}

describe("revenue model", () => {
  it("respects the stand throughput cap", () => {
    const model = optimize(stand, "midgame", partner());
    expect(model.capacity).toBe(5600);
    expect(model.scenarios).toHaveLength(3);
    for (const scenario of model.scenarios) {
      expect(scenario.units).toBeLessThanOrEqual(model.capacity);
    }
  });

  it("keeps the cost ratio and returns a range", () => {
    const model = optimize(stand, "midgame", partner());
    expect(model.suggestedCost).toBeCloseTo(12 * (1.8 / 6.5), 5);
    expect(model.scenarios[0].delta).toBeLessThan(model.scenarios[2].delta);
  });

  it("uses the Qloo rank and popularity in the lift", () => {
    const top = optimize(stand, "midgame", partner({ rank: 1, popularity: 0.9 }));
    const lower = optimize(stand, "midgame", partner({ rank: 4, popularity: 0.4 }));
    expect(top.baseDelta).toBeGreaterThan(lower.baseDelta);
  });
});

describe("constraints", () => {
  it("blocks a bar in a family zone", () => {
    const bar = partner({ name: "G Bar", tags: ["Bar service", "Pizza"] });
    const checks = checkConstraints(familyStand, bar, "midgame", 2600);
    expect(checks.some((item) => item.status === "blocked")).toBe(true);
  });

  it("does not block Barbecue on the substring bar", () => {
    const barbecue = partner({ name: "Barbecue Pit", tags: ["Barbecue", "Takeout"] });
    const checks = checkConstraints(familyStand, barbecue, "midgame", 2600);
    expect(checks.some((item) => item.status === "blocked")).toBe(false);
  });

  it("picks the first non-blocked partner", () => {
    const bar = partner({ name: "G Bar", tags: ["Bar service"] });
    const barbecue = partner({ name: "Barbecue Pit", tags: ["Barbecue"] });
    const selected = pickPartner([bar, barbecue], familyStand, "midgame");
    expect(selected.name).toBe("Barbecue Pit");
  });

  it("uses the top Qloo partner when it passes", () => {
    const top = partner({ name: "Top Qloo Pick", rank: 1 });
    const second = partner({ name: "Second Qloo Pick", rank: 2 });
    const result = choosePartner([top, second], stand, "midgame");
    expect(result.partner.name).toBe("Top Qloo Pick");
    expect(result.adjusted).toBe(false);
  });

  it("prefers a Qloo partner that matches the menu category", () => {
    const s2 = venue.stands.find((item) => item.id === "s2")!;
    const mofongo = partner({ name: "Mofongo El Mocano", tags: ["Mofongo with chicken"], rank: 1 });
    const pizza = partner({ name: "G Bar", tags: ["Pizza", "Bar service"], rank: 2 });
    const result = choosePartner([mofongo, pizza], s2, "midgame");
    expect(result.partner.name).toBe("G Bar");
    expect(result.adjusted).toBe(true);
    expect(result.matched).toBe(true);
  });

  it("re-ranks when the top partner is blocked", () => {
    const bar = partner({ name: "G Bar", tags: ["Bar service"] });
    const barbecue = partner({ name: "Barbecue Pit", tags: ["Barbecue"] });
    const result = choosePartner([bar, barbecue], familyStand, "midgame");
    expect(result.partner.name).toBe("Barbecue Pit");
    expect(result.adjusted).toBe(true);
  });
});

describe("daypart picks", () => {
  it("changes the menu idea for the post-game window", () => {
    expect(getPick("s1", "midgame").item).toBe("Mofongo bowl");
    expect(getPick("s1", "postgame").item).toBe("Cake slice");
  });

  it("changes the menu idea for the pre-game window", () => {
    expect(getPick("s8", "pregame").item).toBe("Iced coffee");
  });
});
