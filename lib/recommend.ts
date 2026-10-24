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
  const pick = getPick(stand.id, "midgame");
  return {
    name: pick?.partner ?? "Local partner",
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
): { partner: Partner; adjusted: boolean } {
  const pick = getPick(stand.id, daypart);
  const preferred = partners.find((partner) => partner.name === pick.partner);

  if (preferred) {
    const checks = checkConstraints(
      stand,
      preferred,
      daypart,
      stand.throughputPerHour * stand.hours[daypart],
    );
    if (!checks.some((check) => check.status === "blocked")) {
      return { partner: preferred, adjusted: false };
    }
  }

  return { partner: pickPartner(partners, stand, daypart), adjusted: Boolean(preferred) };
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
  const { partner } = choosePartner(partners, stand, daypart);
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
