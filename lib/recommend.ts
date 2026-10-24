import snapshot from "@/data/qloo-snapshot.json";
import { getPick } from "@/data/picks";
import { getStand, venue } from "@/data/venue";
import { checkConstraints, optimize, pickPartner } from "@/lib/model";
import { money } from "@/lib/types";
import type {
  Daypart,
  ModelResult,
  OverviewStand,
  Partner,
  Recommendation,
  Stand,
} from "@/lib/types";

type Snapshot = {
  generatedAt: string;
  stands: Record<string, Partner[]>;
};

const snapshotData = snapshot as Snapshot;

// A demo filter, not a complete chain detector. The brief and the UI call the
// remaining candidates "partner restaurants" so a missed chain is not mislabelled.
const NATIONAL_CHAINS = [
  "popeyes",
  "domino",
  "mcdonald",
  "burger king",
  "wendy",
  "taco bell",
  "kfc",
  "subway",
  "dunkin",
  "starbucks",
  "pizza hut",
  "papa john",
  "little caesars",
  "chipotle",
  "panera",
  "five guys",
  "shake shack",
  "chick-fil-a",
  "sonic",
  "arby",
  "jack in the box",
  "carl's jr",
  "hardee",
  "dairy queen",
  "baskin",
  "cold stone",
  "auntie anne",
  "wetzel",
  "pretzelmaker",
  "häagen",
  "blimpie",
];

export function isNationalChain(partner: Partner): boolean {
  const name = partner.name.toLowerCase();
  if (NATIONAL_CHAINS.some((chain) => name.includes(chain))) return true;
  return partner.tags.some((tag) => /\bchain\b/i.test(tag));
}

export function getSnapshotPartners(standId: string): Partner[] {
  return snapshotData.stands[standId] ?? [];
}

export function fallbackPartner(stand: Stand): Partner {
  return {
    name: "Local partner",
    entityId: "",
    type: "urn:entity:place",
    rank: 5,
    description: "Curated partner from the demo dataset. Live Qloo data was unavailable.",
    tags: ["local", "restaurant"],
    priceLevel: 2,
    popularity: 0.5,
    neighborhood: venue.neighborhood,
    city: "New York",
    imageUrl: null,
    evidence: [{ seedId: stand.seedEntityId, effect: null }],
  };
}

export type PartnerChoice = {
  partner: Partner;
  adjusted: boolean;
  matched: boolean;
  matchTerm: string | null;
  localCount: number;
  chainCount: number;
};

export function choosePartner(
  partners: Partner[],
  stand: Stand,
  daypart: Daypart,
): PartnerChoice {
  const pick = getPick(stand.id, daypart);
  const capacity = stand.throughputPerHour * stand.hours[daypart];
  const local = partners.filter((partner) => !isNationalChain(partner));
  const chainCount = partners.length - local.length;
  const valid = local.filter(
    (partner) =>
      !checkConstraints(stand, partner, daypart, capacity).some(
        (check) => check.status === "blocked",
      ),
  );

  let matchTerm: string | null = null;
  const matched = valid.find((partner) => {
    const text = `${partner.name} ${partner.tags.join(" ")} ${partner.description}`.toLowerCase();
    const term = pick.matchTerms.find((candidate) => text.includes(candidate.toLowerCase()));
    if (term) {
      matchTerm = term;
      return true;
    }
    return false;
  });

  const selected = matched ?? valid[0] ?? local[0] ?? partners[0] ?? pickPartner(partners, stand, daypart);
  return {
    partner: selected,
    adjusted: selected.name !== partners[0]?.name,
    matched: Boolean(matched),
    matchTerm,
    localCount: valid.length,
    chainCount,
  };
}

export function decideSwitch(
  model: ModelResult,
  matched: boolean,
  tag: string,
  localCount: number,
): { decision: "switch" | "keep"; reason: string } {
  if (localCount === 0) {
    return {
      decision: "keep",
      reason: "No local candidate passed the venue rules.",
    };
  }
  if (!matched) {
    return {
      decision: "keep",
      reason: `No coherent ${tag} partner in this Qloo list.`,
    };
  }
  if (model.baseDelta < 0) {
    return {
      decision: "keep",
      reason: `The base case loses ${money(Math.abs(model.baseDelta))} per fan.`,
    };
  }
  if (model.baseDelta === 0) {
    return {
      decision: "keep",
      reason: "The base case only breaks even.",
    };
  }
  return {
    decision: "switch",
    reason: `The base case gains ${money(model.baseDelta)} per fan.`,
  };
}

export function buildRecommendation({
  standId,
  daypart,
  partners,
  source,
}: {
  standId: string;
  daypart: Daypart;
  partners: Partner[];
  source: Recommendation["source"];
}): Recommendation {
  const stand = getStand(standId);
  const pick = getPick(stand.id, daypart);
  const { partner, matched, matchTerm, localCount, chainCount } = choosePartner(
    partners,
    stand,
    daypart,
  );
  const modelStand = { ...stand, suggestedItem: pick.item, suggestedPrice: pick.price };
  const model = optimize(modelStand, daypart, partner);
  const constraints = checkConstraints(modelStand, partner, daypart, model.capacity);
  const { decision, reason } = decideSwitch(model, matched, pick.tagMatch, localCount);

  return {
    standId: stand.id,
    daypart,
    partner,
    menuItem: pick.item,
    menuPrice: pick.price,
    pickNote: pick.note,
    pickTagMatch: pick.tagMatch,
    pickMatchTerm: matchTerm,
    categoryMatched: matched,
    localCount,
    chainCount,
    decision,
    decisionReason: reason,
    model,
    constraints,
    source,
    trace: [],
  };
}

export function buildOverview(daypart: Daypart): OverviewStand[] {
  return venue.stands.map((stand) => {
    const partners = getSnapshotPartners(stand.id);
    const source: OverviewStand["source"] = partners.length ? "snapshot" : "fallback";
    const pick = getPick(stand.id, daypart);
    const { partner, matched, localCount } = choosePartner(
      partners.length ? partners : [fallbackPartner(stand)],
      stand,
      daypart,
    );
    const modelStand = {
      ...stand,
      suggestedItem: pick.item,
      suggestedPrice: pick.price,
    };
    const model = optimize(modelStand, daypart, partner);
    const { decision } = decideSwitch(model, matched, pick.tagMatch, localCount);
    return {
      standId: stand.id,
      baseDelta: model.baseDelta,
      partnerName: partner.name,
      decision,
      source,
    };
  });
}
