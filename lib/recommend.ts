import snapshot from "@/data/qloo-snapshot.json";
import { picks } from "@/data/picks";
import { getStand, venue } from "@/data/venue";
import { checkConstraints, optimize, pickPartner } from "@/lib/model";
import type {
  Daypart,
  OverviewStand,
  Partner,
  Recommendation,
  Stand,
  TraceStep,
} from "@/lib/types";
import { money } from "@/lib/types";

type Snapshot = {
  generatedAt: string;
  stands: Record<string, Partner[]>;
};

const snapshotData = snapshot as Snapshot;

export function getSnapshotPartners(standId: string): Partner[] {
  return snapshotData.stands[standId] ?? [];
}

export function fallbackPartner(stand: Stand): Partner {
  const pick = picks[stand.id];
  return {
    name: pick?.partner ?? "Local partner",
    entityId: "",
    type: "urn:entity:place",
    rank: 5,
    description: "Curated local partner from the demo dataset. Live Qloo data was unavailable.",
    tags: ["local", "restaurant"],
    priceLevel: 2,
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
  const pick = picks[stand.id];
  const preferred = pick ? partners.find((partner) => partner.name === pick.partner) : null;

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
  const pick = picks[stand.id] ?? {
    partner: partners[0]?.name ?? "Local partner",
    item: stand.suggestedItem,
    price: stand.suggestedPrice,
    note: "",
  };
  const { partner, adjusted } = choosePartner(partners, stand, daypart);
  const modelStand = { ...stand, suggestedItem: pick.item, suggestedPrice: pick.price };
  const model = optimize(modelStand, daypart, partner);
  const constraints = checkConstraints(modelStand, partner, daypart, model.capacity);

  const blocked = constraints.filter((item) => item.status === "blocked").length;
  const flagged = constraints.filter((item) => item.status === "flag").length;

  const trace: TraceStep[] = [
    {
      label: "Venue and daypart",
      detail: `${venue.name}, ${stand.label}, ${daypart}.`,
      status: "ok",
    },
    {
      label: "Team brand",
      detail: `${venue.team} resolved to a Qloo brand entity.`,
      status: "ok",
    },
    {
      label: "Section pulse",
      detail: `${stand.seedArtist} plus the team brand, scoped to ${venue.locality}.`,
      status: "ok",
    },
    {
      label: "Local partners",
      detail: `${partners.length} restaurants ranked. ${partner.name} sits at rank ${partner.rank}.${adjusted ? " The preferred pick was blocked, so the next valid partner was used." : ""}`,
      status: "ok",
    },
    {
      label: "Revenue model",
      detail: `Base per-cap delta ${money(model.baseDelta)}. Capacity ${Math.round(model.capacity).toLocaleString()} units. Elasticity 0.6.`,
      status: "ok",
    },
    {
      label: "Constraints",
      detail: `${blocked} blocked, ${flagged} need approval.`,
      status: blocked > 0 ? "warn" : "ok",
    },
    {
      label: "Source",
      detail:
        source === "live"
          ? "Live Qloo response."
          : source === "snapshot"
            ? "Cached Qloo snapshot. Use Refresh live to call the API."
            : "Fallback dataset. Live and cached Qloo data were unavailable.",
      status: source === "fallback" ? "warn" : "ok",
    },
  ];

  return {
    standId: stand.id,
    daypart,
    partner,
    menuItem: pick.item,
    menuPrice: pick.price,
    model,
    constraints,
    source,
    trace,
  };
}

export function buildOverview(daypart: Daypart): OverviewStand[] {
  return venue.stands.map((stand) => {
    const partners = getSnapshotPartners(stand.id);
    const source: OverviewStand["source"] = partners.length ? "snapshot" : "fallback";
    const { partner } = choosePartner(partners.length ? partners : [fallbackPartner(stand)], stand, daypart);
    const pick = picks[stand.id];
    const modelStand = {
      ...stand,
      suggestedItem: pick?.item ?? stand.suggestedItem,
      suggestedPrice: pick?.price ?? stand.suggestedPrice,
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
