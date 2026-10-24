import { getPick } from "@/data/picks";
import { getStand, venue } from "@/data/venue";
import { checkConstraints, optimize } from "@/lib/model";
import { getLocalPartners, isQlooConfigured } from "@/lib/qloo";
import {
  choosePartner,
  fallbackPartner,
  getSnapshotPartners,
} from "@/lib/recommend";
import type {
  Daypart,
  Partner,
  Recommendation,
  TraceEvent,
} from "@/lib/types";

type RunInput = {
  standId: string;
  daypart: Daypart;
  live: boolean;
};

function event({
  step,
  tool,
  input,
  output,
  startedAt,
  status = "ok",
}: {
  step: number;
  tool: string;
  input: string;
  output: string;
  startedAt: number;
  status?: TraceEvent["status"];
}): TraceEvent {
  return {
    step,
    tool,
    input,
    output,
    durationMs: Math.max(0, Date.now() - startedAt),
    status,
  };
}

export async function runAgent({ standId, daypart, live }: RunInput): Promise<Recommendation> {
  const stand = getStand(standId);
  const pick = getPick(stand.id, daypart);
  const trace: TraceEvent[] = [];
  let step = 1;

  const scopeStart = Date.now();
  trace.push(
    event({
      step: step++,
      tool: "scope.read",
      input: `${venue.name} / ${stand.label} / ${daypart}`,
      output: `${stand.section}, ${stand.zone}; ${stand.traffic[daypart].toLocaleString()} fans; ${Math.round(stand.throughputPerHour * stand.hours[daypart]).toLocaleString()} unit capacity.`,
      startedAt: scopeStart,
    }),
  );

  let partners: Partner[] = [];
  let source: Recommendation["source"] = "snapshot";
  let liveFailed = false;

  if (live && isQlooConfigured()) {
    const liveStart = Date.now();
    try {
      partners = await getLocalPartners({
        teamBrandId: venue.teamBrandId,
        seedEntityId: stand.seedEntityId,
        locality: venue.locality,
        take: 8,
      });
      source = "live";
      trace.push(
        event({
          step: step++,
          tool: "qloo.insights",
          input: `team=${venue.team}; seed=${stand.seedArtist}; locality=${venue.locality}; tag=restaurant`,
          output: `${partners.length} partners ranked; top=${partners[0]?.name ?? "none"}.`,
          startedAt: liveStart,
        }),
      );
    } catch (error) {
      liveFailed = true;
      trace.push(
        event({
          step: step++,
          tool: "qloo.insights",
          input: `team=${venue.team}; seed=${stand.seedArtist}; locality=${venue.locality}`,
          output: `Live call failed: ${error instanceof Error ? error.message : "unknown error"}. Falling back to the snapshot.`,
          startedAt: liveStart,
          status: "warn",
        }),
      );
    }
  } else {
    trace.push(
      event({
        step: step++,
        tool: "qloo.snapshot",
        input: `team=${venue.team}; seed=${stand.seedArtist}; locality=${venue.locality}`,
        output: "Live call not requested. Using the committed Qloo snapshot.",
        startedAt: Date.now(),
      }),
    );
  }

  if (partners.length === 0) {
    const cacheStart = Date.now();
    partners = getSnapshotPartners(stand.id);
    source = partners.length ? "snapshot" : "fallback";
    trace.push(
      event({
        step: step++,
        tool: "cache.read",
        input: `stand=${stand.id}`,
        output: partners.length
          ? `${partners.length} cached partners loaded.`
          : "No cached partners for this stand.",
        startedAt: cacheStart,
        status: partners.length ? "ok" : "warn",
      }),
    );
  }

  if (partners.length === 0) {
    partners = [fallbackPartner(stand)];
    source = "fallback";
    trace.push(
      event({
        step: step++,
        tool: "fallback.read",
        input: `stand=${stand.id}`,
        output: "Curated fallback partner loaded so the demo can continue.",
        startedAt: Date.now(),
        status: "warn",
      }),
    );
  }

  const rankStart = Date.now();
  const { partner, adjusted, matched } = choosePartner(partners, stand, daypart);
  const isTop = partner.name === partners[0]?.name;
  const matchNote = matched
    ? isTop
      ? `; the top result also matches the ${pick.tagMatch} tag`
      : `; moved past the top result for the ${pick.tagMatch} match`
    : `; no ${pick.tagMatch} match in this list, so the top Qloo partner is shown`;
  trace.push(
    event({
      step: step++,
      tool: "rank.choose",
      input: `${partners.length} partners; top=${partners[0]?.name ?? "none"}; match=${pick.tagMatch}`,
      output: `${partner.name} selected at rank ${partner.rank}${matchNote}.`,
      startedAt: rankStart,
      status: adjusted ? "warn" : "ok",
    }),
  );

  const modelStart = Date.now();
  const modelStand = { ...stand, suggestedItem: pick.item, suggestedPrice: pick.price };
  const model = optimize(modelStand, daypart, partner);
  trace.push(
    event({
      step: step++,
      tool: "model.revenue",
      input: `units=${model.currentUnits}; price=${stand.incumbent.price}->${pick.price}; elasticity=0.6; capacity=${Math.round(model.capacity)}`,
      output: `Base delta ${model.baseDelta.toFixed(2)} per fan; range ${model.scenarios[0].delta.toFixed(2)} to ${model.scenarios[2].delta.toFixed(2)}.`,
      startedAt: modelStart,
    }),
  );

  const constraintStart = Date.now();
  const constraints = checkConstraints(modelStand, partner, daypart, model.capacity);
  const blocked = constraints.filter((item) => item.status === "blocked").length;
  const flagged = constraints.filter((item) => item.status === "flag").length;
  trace.push(
    event({
      step: step++,
      tool: "constraints.check",
      input: `${stand.constraints.length} venue rules`,
      output: `${blocked} blocked; ${flagged} need approval.`,
      startedAt: constraintStart,
      status: blocked > 0 ? "warn" : "ok",
    }),
  );

  trace.push(
    event({
      step: step++,
      tool: "brief.compose",
      input: `stand=${stand.id}; partner=${partner.name}`,
      output: `Menu idea: ${pick.item} at ${pick.price.toFixed(2)}. Vendor brief ready.`,
      startedAt: Date.now(),
      status: liveFailed ? "warn" : "ok",
    }),
  );

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
    trace,
  };
}
