import { writeFile } from "node:fs/promises";
import path from "node:path";

const TEAM_BRAND_ID = "709D89A7-455A-40E4-A0D3-E77201C1C630";
const LOCALITY = "Concourse";
const BASE = "https://hackathon.api.qloo.com";

const stands = [
  ["s1", "BDA1B73F-10E7-4D09-AC51-B796CCEC5FF3"],
  ["s2", "658495BB-DF77-472E-A6B2-9E37FF248FB3"],
  ["s3", "4BBEF799-A0C4-4110-AB01-39216993C312"],
  ["s4", "1894930C-9D08-485C-8F0F-0E0AC4DFB447"],
  ["s5", "A8A71B45-1FF5-475F-8559-581CECF97563"],
  ["s6", "007C6FE0-7F4B-4F5F-AAEE-6A1133BBE16D"],
  ["s7", "EEE15A04-1AB1-43EA-945E-B93EA6DD920A"],
  ["s8", "59DCDFA8-5082-47D9-B3E5-2B49CF2A778F"],
];

const key = process.env.QLOO_API_KEY?.trim();
if (!key) {
  console.error("QLOO_API_KEY is not set");
  process.exit(1);
}

function toPartner(entity, rank, seedId, effect) {
  const tags = Array.isArray(entity.tags)
    ? entity.tags.map((tag) => (typeof tag === "string" ? tag : tag?.name ?? "")).filter(Boolean)
    : [];
  return {
    name: entity.name ?? "Local partner",
    entityId: entity.entity_id ?? "",
    type: entity.subtype ?? "urn:entity:place",
    rank,
    description: entity.properties?.description ?? "",
    tags,
    priceLevel: entity.properties?.price_level ?? null,
    neighborhood:
      entity.properties?.neighborhood ?? entity.properties?.locality?.city?.name ?? "The Bronx",
    city: entity.properties?.locality?.city?.name ?? "New York",
    imageUrl: entity.properties?.image?.url ?? null,
    evidence: [{ seedId, effect: effect ?? null }],
  };
}

async function fetchStand(standId, seedId) {
  const url = new URL(`${BASE}/v2/insights`);
  url.searchParams.set("filter.type", "urn:entity:place");
  url.searchParams.set("filter.tags", "urn:tag:genre:place:restaurant");
  url.searchParams.set("signal.interests.entities", `${TEAM_BRAND_ID},${seedId}`);
  url.searchParams.set("filter.location.query", LOCALITY);
  url.searchParams.set("take", "8");
  url.searchParams.set("feature.explainability", "true");

  const response = await fetch(url, {
    headers: { "X-Api-Key": key },
    signal: AbortSignal.timeout(15000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) {
    throw new Error(body.errors?.[0]?.message ?? `HTTP ${response.status}`);
  }

  const effects =
    body.query?.explainability?.["signal.interests.entities"]?.effect_on_top3_recs ?? [];
  const entities = body.results?.entities ?? [];
  return entities.map((entity, index) => {
    const evidence = effects.find((item) => item.entity_id === seedId);
    return toPartner(entity, index + 1, seedId, evidence?.avg_score ?? null);
  });
}

const result = {
  generatedAt: new Date().toISOString(),
  locality: LOCALITY,
  teamBrandId: TEAM_BRAND_ID,
  stands: {},
};

for (const [standId, seedId] of stands) {
  try {
    result.stands[standId] = await fetchStand(standId, seedId);
    console.log(`${standId}: ${result.stands[standId].length} partners`);
  } catch (error) {
    result.stands[standId] = [];
    console.error(`${standId}: ${error.message}`);
  }
  await new Promise((resolve) => setTimeout(resolve, 350));
}

const out = path.join(process.cwd(), "data", "qloo-snapshot.json");
await writeFile(out, JSON.stringify(result, null, 2));
console.log(`wrote ${out}`);
