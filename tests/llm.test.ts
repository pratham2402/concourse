import { describe, expect, it } from "vitest";
import { getStand } from "../data/venue";
import { applyReview, llmStatus, parseReview } from "../lib/llm";
import { buildRecommendation, getSnapshotPartners } from "../lib/recommend";
import type { Partner } from "../lib/types";

const candidates: Partner[] = [
  {
    name: "Mofongo El Mocano",
    entityId: "abc-123",
    type: "urn:entity:place",
    rank: 1,
    description: "Dominican restaurant with mofongo.",
    tags: ["Mofongo", "Dominican"],
    priceLevel: 2,
    popularity: 0.8,
    neighborhood: "The Bronx",
    city: "New York",
    imageUrl: null,
    evidence: [{ seedId: "seed", effect: 1 }],
  },
  {
    name: "Smokey Island Grille",
    entityId: "def-456",
    type: "urn:entity:place",
    rank: 2,
    description: "Grill and oxtail.",
    tags: ["Grill", "Oxtail"],
    priceLevel: 2,
    popularity: 0.6,
    neighborhood: "The Bronx",
    city: "New York",
    imageUrl: null,
    evidence: [{ seedId: "seed", effect: 1 }],
  },
];

describe("LLM review parsing", () => {
  it("parses a valid switch", () => {
    const result = parseReview(
      JSON.stringify({
        action: "switch",
        partnerId: "def-456",
        dish: "Chopped cheese fries",
        reason: "Grill fit.",
      }),
      candidates,
    );
    expect(result.action).toBe("switch");
    expect(result.partner?.name).toBe("Smokey Island Grille");
    expect(result.dish).toBe("Chopped cheese fries");
  });

  it("parses a keep", () => {
    const result = parseReview(
      JSON.stringify({ action: "keep", reason: "No candidate fits the dish." }),
      candidates,
    );
    expect(result.action).toBe("keep");
    expect(result.partner).toBeNull();
    expect(result.dish).toBeNull();
  });

  it("rejects a partner outside the shortlist", () => {
    expect(() =>
      parseReview(
        JSON.stringify({
          action: "switch",
          partnerId: "not-a-candidate",
          dish: "Fries",
          reason: "Nope.",
        }),
        candidates,
      ),
    ).toThrow();
  });

  it("rejects an invalid action", () => {
    expect(() =>
      parseReview(JSON.stringify({ action: "maybe", reason: "Nope." }), candidates),
    ).toThrow();
  });
});

describe("LLM status", () => {
  it("closes after the disable date", () => {
    const previous = {
      enabled: process.env.LLM_ENABLED,
      key: process.env.NEBIUS_API_KEY,
      disable: process.env.LLM_DISABLE_AFTER,
    };
    process.env.LLM_ENABLED = "true";
    process.env.NEBIUS_API_KEY = "test";
    process.env.LLM_DISABLE_AFTER = "2026-01-01T00:00:00Z";

    try {
      const status = llmStatus(Date.parse("2026-01-02T00:00:00Z"));
      expect(status.ok).toBe(false);
      expect(status.reason).toContain("closed");
    } finally {
      if (previous.enabled === undefined) delete process.env.LLM_ENABLED;
      else process.env.LLM_ENABLED = previous.enabled;
      if (previous.key === undefined) delete process.env.NEBIUS_API_KEY;
      else process.env.NEBIUS_API_KEY = previous.key;
      if (previous.disable === undefined) delete process.env.LLM_DISABLE_AFTER;
      else process.env.LLM_DISABLE_AFTER = previous.disable;
    }
  });
});

describe("agent review application", () => {
  it("keeps the agent step in the trace when the check vetoes a switch", () => {
    const stand = getStand("s8");
    const rec = buildRecommendation({
      standId: "s8",
      daypart: "postgame",
      partners: getSnapshotPartners("s8"),
      source: "snapshot",
    });

    const applied = applyReview({
      rec,
      stand,
      daypart: "postgame",
      review: {
        status: "ok",
        action: "switch",
        partnerName: rec.partner.name,
        partnerEntityId: rec.partner.entityId,
        dish: "Late-night noodles",
        reason: "A late-night noodle dish for limited staffing.",
        model: "test-model",
        latencyMs: 10,
      },
      partner: rec.partner,
    });

    expect(applied.review.accepted).toBe(false);
    expect(applied.recommendation.decision).toBe("keep");
    expect(applied.recommendation.trace.some((event) => event.tool === "llm.review")).toBe(true);
  });
});
