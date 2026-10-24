import snapshot from "@/data/qloo-snapshot.json";
import { getPick } from "@/data/picks";
import { getStand, venue } from "@/data/venue";
import { checkConstraints, optimize, pickPartner } from "@/lib/model";
import type {
  Daypart,
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

export function getSnapshotPartners(standId: string): Partner[] {
  return snapshotData.stands[standId] ?? [];
}

export function fallbackPartner(stand: Stand): Partner {
  return {
    name: "Local partner",
    entityId: "",
    type: "urn:entity:place",
    rank: 5,
    description: "Curated local partner from the demo dataset. Live Qloo data was unavailable.",
    tags: ["local", "restaurant"],
    priceLevel: 2,
    popularity: 0.5,
    neighborhood: venue.neighborhood,
    city: "New York",
    imageUrl: null,
    evidence: [{ seedId: stand.seedEntityId, effect: null }],
  };
}

export function choosePartner(
  partners: Partner[],
  stand: Stand,
  daypart: Daypart,
): { partner: Partner; adjusted: boolean; matched: boolean } {
  const pick = getPick(stand.id, daypart);
  const capacity = stand.throughputPerHour * stand.hours[daypart];
  const valid = partners.filter(
    (partner) =>
      !checkConstraints(stand, partner, daypart, capacity).some(
        (check) => check.status === "blocked",
      ),
  );
  const category = pick.tagMatch.toLowerCase();
  const matched = valid.find((partner) =>
    `${partner.name} ${partner.tags.join(" ")} ${partner.description}`
      .toLowerCase()
      .includes(category),
  );
  const selected = matched ?? valid[0] ?? pickPartner(partners, stand, daypart);
  return {
    partner: selected,
    adjusted: selected.name !== partners[0]?.name,
    matched: Boolean(matched),
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
  const { partner, matched } = choosePartner(partners, stand, daypart);
  const modelStand = { ...stand, suggestedItem: pick.item, suggestedPrice: pick.price };
  const model = optimize(modelStand, daypart, partner);
  const constraints = checkConstraints(modelStand, partner, daypart, model.capacity);

  return {
    standId: stand.id,
    daypart,
    partner,
    menuItem: pick.item,
    menuPrice: pick.price,
    pickNote: pick.note,
    pickTagMatch: pick.tagMatch,
    categoryMatched: matched,
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
    const { partner } = choosePartner(
      partners.length ? partners : [fallbackPartner(stand)],
      stand,
      daypart,
    );
    const pick = getPick(stand.id, daypart);
    const modelStand = {
      ...stand,
      suggestedItem: pick.item,
      suggestedPrice: pick.price,
    };
    const model = optimize(modelStand, daypart, partner);
    return {
      standId: stand.id,
      baseDelta: model.baseDelta,
      partnerName: partner.name,
      source,
    };
  });
}
