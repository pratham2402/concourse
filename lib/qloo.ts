import type { Partner } from "@/lib/types";

const BASE_URL =
  process.env.QLOO_BASE_URL?.replace(/\/$/, "") ?? "https://hackathon.api.qloo.com";

type QlooEntity = {
  name?: string;
  entity_id?: string;
  subtype?: string;
  popularity?: number;
  properties?: {
    description?: string;
    price_level?: number | null;
    neighborhood?: string;
    city?: string;
    image?: { url?: string };
    locality?: { city?: { name?: string } };
  };
  tags?: ({ name?: string } | string)[];
  query?: {
    distance?: number;
    measurements?: Record<string, number>;
  };
};

type QlooResponse = {
  success?: boolean;
  results?: { entities?: QlooEntity[] };
  query?: {
    explainability?: {
      "signal.interests.entities"?: {
        effect_on_top3_recs?: { entity_id?: string; avg_score?: number }[];
      };
    };
  };
  errors?: { message?: string }[];
};

export class QlooError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QlooError";
  }
}

function apiKey(): string {
  const key = process.env.QLOO_API_KEY?.trim();
  if (!key) throw new QlooError("QLOO_API_KEY is not set");
  return key;
}

async function qlooGet(path: string, params: Record<string, string>): Promise<QlooResponse> {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    headers: { "X-Api-Key": apiKey() },
    cache: "no-store",
    signal: AbortSignal.timeout(9000),
  });

  const body = (await response.json().catch(() => ({}))) as QlooResponse;
  if (!response.ok || body.success === false) {
    const detail = body.errors?.[0]?.message ?? `Qloo returned ${response.status}`;
    throw new QlooError(detail);
  }
  return body;
}

function toPartner(entity: QlooEntity, rank: number, seedId: string, effect: number | null): Partner {
  return {
    name: entity.name ?? "Local partner",
    entityId: entity.entity_id ?? "",
    type: entity.subtype ?? "urn:entity:place",
    rank,
    description: entity.properties?.description ?? "",
    tags: (entity.tags ?? [])
      .map((tag) => (typeof tag === "string" ? tag : tag.name ?? ""))
      .filter(Boolean),
    priceLevel: entity.properties?.price_level ?? null,
    popularity: entity.popularity ?? null,
    neighborhood:
      entity.properties?.neighborhood ??
      entity.properties?.locality?.city?.name ??
      "The Bronx",
    city: entity.properties?.locality?.city?.name ?? "New York",
    imageUrl: entity.properties?.image?.url ?? null,
    evidence: [{ seedId, effect }],
  };
}

export async function getLocalPartners({
  teamBrandId,
  seedEntityId,
  locality,
  take = 8,
}: {
  teamBrandId: string;
  seedEntityId: string;
  locality: string;
  take?: number;
}): Promise<Partner[]> {
  const body = await qlooGet("/v2/insights", {
    "filter.type": "urn:entity:place",
    "filter.tags": "urn:tag:genre:place:restaurant",
    "signal.interests.entities": `${teamBrandId},${seedEntityId}`,
    "filter.location.query": locality,
    take: String(take),
    "feature.explainability": "true",
  });

  const effects =
    body.query?.explainability?.["signal.interests.entities"]?.effect_on_top3_recs ?? [];

  return (body.results?.entities ?? []).map((entity, index) => {
    const evidence = effects.find((item) => item.entity_id === seedEntityId);
    return toPartner(entity, index + 1, seedEntityId, evidence?.avg_score ?? null);
  });
}

export function isQlooConfigured(): boolean {
  return Boolean(process.env.QLOO_API_KEY?.trim());
}
