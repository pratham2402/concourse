import { NextResponse } from "next/server";
import { getStand, venue } from "@/data/venue";
import { runAgent } from "@/lib/agent";
import {
  applyReview,
  buildPrompt,
  callNebius,
  consumeLlmCall,
  getCachedReview,
  llmStatus,
  NebiusError,
  parseReview,
  setCachedReview,
} from "@/lib/llm";
import { getAgentPreset } from "@/lib/presets";
import { getLocalPartners } from "@/lib/qloo";
import {
  fallbackPartner,
  getLocalCandidates,
  getSnapshotPartners,
} from "@/lib/recommend";
import type {
  AgentResponse,
  Daypart,
  LLMReview,
  Partner,
  Recommendation,
  Stand,
} from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function json(data: AgentResponse | { error: string }, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

function llmErrorMessage(error: unknown): string {
  if (error instanceof NebiusError) {
    if (error.status === 401 || error.status === 403) {
      return "The agent key cannot use this model";
    }
    if (error.status === 402) {
      return "The agent budget is unavailable";
    }
    if (error.status === 429) {
      return "The agent is busy. Try again later";
    }
    if (error.status === 404) {
      return "The agent model is not available";
    }
    if (error.status === 400 || error.status === 422) {
      return "The agent model rejected the request";
    }
    if (error.status >= 500) {
      return "The agent provider is unavailable";
    }
    return "The agent is unavailable right now";
  }

  const message = error instanceof Error ? error.message : "";
  if (/429|rate/i.test(message)) {
    return "The agent is busy. Try again later";
  }
  if (/timeout|abort/i.test(message)) {
    return "The agent timed out. Try again";
  }
  if (/empty response/i.test(message)) {
    return "The agent returned no answer";
  }
  if (/fetch|network|econn|enotfound/i.test(message)) {
    return "The agent network call failed";
  }
  return "The agent is unavailable right now";
}

async function loadPartners(
  stand: Stand,
  source: Recommendation["source"],
): Promise<Partner[]> {
  if (source === "live") {
    try {
      return await getLocalPartners({
        teamBrandId: venue.teamBrandId,
        seedEntityId: stand.seedEntityId,
        locality: venue.locality,
        take: 8,
      });
    } catch {
      return getSnapshotPartners(stand.id);
    }
  }
  if (source === "snapshot") return getSnapshotPartners(stand.id);
  return [fallbackPartner(stand)];
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { presetId?: unknown } | null;
  const preset =
    body && typeof body.presetId === "string" ? getAgentPreset(body.presetId) : undefined;
  if (!preset) {
    return json({ error: "Unknown agent preset." }, 400);
  }

  const stand = getStand(preset.standId);
  const daypart: Daypart = preset.daypart;
  const rec = await runAgent({ standId: stand.id, daypart, live: true });
  const status = llmStatus();

  if (!status.ok) {
    const review: LLMReview = {
      status: "disabled",
      reason: status.reason,
      model: status.config.model,
    };
    return json({
      standId: stand.id,
      daypart,
      recommendation: rec,
      review,
    });
  }

  const partners = await loadPartners(stand, rec.source);
  const { candidates } = getLocalCandidates(partners, stand, daypart);
  const cacheKey = `${preset.id}:${stand.id}:${daypart}:${candidates
    .map((partner) => partner.entityId)
    .join(",")}`;

  const cached = getCachedReview(cacheKey);
  if (cached) {
    return json({
      standId: stand.id,
      daypart,
      recommendation: cached.recommendation,
      review: cached.review,
    });
  }

  if (candidates.length === 0) {
    const review: LLMReview = {
      status: "ok",
      action: "keep",
      reason: "No local candidate passed the venue rules.",
      model: status.config.model,
      latencyMs: 0,
    };
    const applied = applyReview({ rec, stand, daypart, review, partner: null });
    setCachedReview(cacheKey, applied);
    return json({
      standId: stand.id,
      daypart,
      recommendation: applied.recommendation,
      review: applied.review,
    });
  }

  const limit = consumeLlmCall(clientIp(request));
  if (!limit.ok) {
    const review: LLMReview = {
      status: "limit",
      reason: limit.reason,
      model: status.config.model,
    };
    return json({
      standId: stand.id,
      daypart,
      recommendation: rec,
      review,
    });
  }

  const prompt = buildPrompt({
    rec,
    stand,
    daypart,
    request: preset.request,
    candidates,
  });

  let result;
  try {
    result = await callNebius({
      config: status.config,
      system: prompt.system,
      user: prompt.user,
    });
  } catch (error) {
    console.error("agent review failed", {
      model: status.config.model,
      error: error instanceof Error ? error.message : String(error),
    });
    const review: LLMReview = {
      status: "error",
      reason: llmErrorMessage(error),
      model: status.config.model,
    };
    return json({
      standId: stand.id,
      daypart,
      recommendation: rec,
      review,
    });
  }

  let parsed;
  try {
    parsed = parseReview(result.content, candidates);
  } catch {
    const review: LLMReview = {
      status: "invalid",
      reason: "The agent returned an unusable answer.",
      model: result.model,
      latencyMs: result.latencyMs,
    };
    return json({
      standId: stand.id,
      daypart,
      recommendation: rec,
      review,
    });
  }

  const review: LLMReview = {
    status: "ok",
    action: parsed.action,
    partnerName: parsed.partner?.name,
    partnerEntityId: parsed.partner?.entityId,
    dish: parsed.dish ?? undefined,
    reason: parsed.reason,
    model: result.model,
    latencyMs: result.latencyMs,
  };
  const applied = applyReview({ rec, stand, daypart, review, partner: parsed.partner });
  setCachedReview(cacheKey, applied);

  return json({
    standId: stand.id,
    daypart,
    recommendation: applied.recommendation,
    review: applied.review,
  });
}
