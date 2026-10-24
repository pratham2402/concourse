import { getPick } from "@/data/picks";
import { checkConstraints, optimize } from "@/lib/model";
import type {
  Daypart,
  LLMReview,
  Partner,
  Recommendation,
  Stand,
  TraceEvent,
} from "@/lib/types";

const BASE_URL =
  process.env.NEBIUS_BASE_URL?.replace(/\/$/, "") ?? "https://api.tokenfactory.nebius.com/v1";
const DEFAULT_MODEL = "nvidia/nemotron-3-super-120b-a12b";
const DEFAULT_DISABLE_AFTER = "2026-11-06T00:00:00Z";
const CACHE_MS = 10 * 60 * 1000;

function envInt(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

export function llmConfig() {
  return {
    enabled: process.env.LLM_ENABLED === "true",
    key: process.env.NEBIUS_API_KEY?.trim() ?? "",
    model: process.env.LLM_MODEL?.trim() || DEFAULT_MODEL,
    disableAt: Date.parse(process.env.LLM_DISABLE_AFTER || DEFAULT_DISABLE_AFTER),
    totalLimit: envInt("LLM_TOTAL_CALL_LIMIT", 200),
    dailyLimit: envInt("LLM_DAILY_CALL_LIMIT", 50),
    perIpLimit: envInt("LLM_PER_IP_HOURLY_LIMIT", 6),
    maxTokens: envInt("LLM_MAX_TOKENS", 2500),
    timeoutMs: envInt("LLM_TIMEOUT_MS", 20000),
    baseUrl: BASE_URL,
  };
}

export function llmStatus(now = Date.now()): {
  ok: boolean;
  reason?: string;
  config: ReturnType<typeof llmConfig>;
} {
  const config = llmConfig();
  if (!config.enabled) {
    return { ok: false, reason: "The agent is turned off.", config };
  }
  if (!config.key) {
    return { ok: false, reason: "The agent key is not set.", config };
  }
  if (Number.isFinite(config.disableAt) && now >= config.disableAt) {
    return { ok: false, reason: "The agent window has closed.", config };
  }
  return { ok: true, config };
}

export class NebiusError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(`Nebius ${status}: ${detail}`);
    this.name = "NebiusError";
    this.status = status;
    this.detail = detail;
  }
}

type Usage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

type CallResult = {
  content: string;
  model: string;
  usage: Usage | null;
  latencyMs: number;
};

export async function callNebius({
  config,
  system,
  user,
}: {
  config: ReturnType<typeof llmConfig>;
  system: string;
  user: string;
}): Promise<CallResult> {
  const started = Date.now();
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0,
      max_tokens: config.maxTokens,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(config.timeoutMs),
  });

  const body = (await response.json().catch(() => ({}))) as {
    choices?: { message?: { content?: string; reasoning_content?: string } }[];
    model?: string;
    usage?: Usage;
    error?: { message?: string };
    detail?: unknown;
  };

  if (!response.ok) {
    const raw = body.error?.message ?? body.detail;
    const detail =
      typeof raw === "string"
        ? raw
        : raw
          ? JSON.stringify(raw).slice(0, 200)
          : `HTTP ${response.status}`;
    throw new NebiusError(response.status, detail);
  }

  const message = body.choices?.[0]?.message;
  const content = message?.content || message?.reasoning_content;
  if (!content) throw new Error("Nebius returned an empty response");

  return {
    content,
    model: body.model ?? config.model,
    usage: body.usage ?? null,
    latencyMs: Date.now() - started,
  };
}

function cleanJson(content: string): string {
  const trimmed = content
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }
  return trimmed;
}

export type ParsedReview = {
  action: "switch" | "keep";
  partner: Partner | null;
  dish: string | null;
  reason: string;
};

export function parseReview(content: string, candidates: Partner[]): ParsedReview {
  const parsed = JSON.parse(cleanJson(content)) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Response is not a JSON object");
  }
  const raw = parsed as {
    action?: unknown;
    partnerId?: unknown;
    partnerName?: unknown;
    dish?: unknown;
    reason?: unknown;
  };
  const action = typeof raw.action === "string" ? raw.action.toLowerCase() : "";
  if (action !== "switch" && action !== "keep") {
    throw new Error("Invalid action");
  }
  const reason = typeof raw.reason === "string" ? raw.reason.trim().slice(0, 240) : "";
  if (!reason) throw new Error("Missing reason");

  if (action === "keep") {
    return { action: "keep", partner: null, dish: null, reason };
  }

  const id = typeof raw.partnerId === "string" ? raw.partnerId.trim() : "";
  const name = typeof raw.partnerName === "string" ? raw.partnerName.trim().toLowerCase() : "";
  const partner =
    candidates.find((candidate) => id && candidate.entityId.toLowerCase() === id.toLowerCase()) ??
    candidates.find((candidate) => name && candidate.name.toLowerCase() === name) ??
    candidates.find((candidate) => name && candidate.name.toLowerCase().includes(name));
  if (!partner) throw new Error("Unknown partner");

  const dish = typeof raw.dish === "string" ? raw.dish.trim().slice(0, 80) : "";
  if (!dish) throw new Error("Missing dish");

  return { action: "switch", partner, dish, reason };
}

export function buildPrompt({
  rec,
  stand,
  daypart,
  request,
  candidates,
}: {
  rec: Recommendation;
  stand: Stand;
  daypart: Daypart;
  request: string;
  candidates: Partner[];
}): { system: string; user: string } {
  const pick = getPick(stand.id, daypart);
  const payload = {
    operator_request: request,
    stand: {
      label: stand.label,
      section: stand.section,
      zone: stand.zone,
      constraints: stand.constraints,
      incumbent: { name: stand.incumbent.name, price: stand.incumbent.price },
    },
    daypart,
    menu_idea: {
      item: pick.item,
      price: pick.price,
      category: pick.tagMatch,
      match_terms: pick.matchTerms,
    },
    deterministic: {
      decision: rec.decision,
      reason: rec.decisionReason,
      base_delta_per_fan: Number(rec.model.baseDelta.toFixed(2)),
      capacity_note: rec.model.capacityNote,
      constraints: rec.constraints.map((item) => ({
        label: item.label,
        status: item.status,
      })),
    },
    candidates: candidates.map((partner) => ({
      id: partner.entityId,
      name: partner.name,
      rank: partner.rank,
      popularity: partner.popularity,
      tags: partner.tags.slice(0, 14),
      description: partner.description.slice(0, 240),
    })),
  };

  const system = [
    "You are a stadium concession analyst.",
    "Choose a partner only from the supplied candidates, or keep the incumbent.",
    "If action is switch, choose a dish that the selected partner plausibly sells, based on its name, tags, and description.",
    "Do not invent a partner. Do not calculate revenue. Do not change the venue rules.",
    "Return only one JSON object with keys: action ('switch' or 'keep'), partnerId (a candidate id or null), dish (string or null), reason (one short sentence).",
    "Do not include analysis, prose, or markdown.",
    "A constraint status of 'flag' means an approval or operational step is required; it does not disqualify a partner. Only a 'blocked' status disqualifies.",
    "If no candidate fits the dish or the operator request, or every candidate is blocked, return keep.",
  ].join(" ");

  return { system, user: JSON.stringify(payload) };
}

type LimitState = {
  day: string;
  daily: number;
  total: number;
  perIp: Map<string, number[]>;
};

const limitState: LimitState = {
  day: new Date().toISOString().slice(0, 10),
  daily: 0,
  total: 0,
  perIp: new Map(),
};

export function consumeLlmCall(
  ip: string,
  now = Date.now(),
): { ok: boolean; reason?: string } {
  const config = llmConfig();
  const day = new Date(now).toISOString().slice(0, 10);
  if (limitState.day !== day) {
    limitState.day = day;
    limitState.daily = 0;
    limitState.perIp.clear();
  }

  if (limitState.total >= config.totalLimit) {
    return { ok: false, reason: "The demo agent total limit has been reached." };
  }
  if (limitState.daily >= config.dailyLimit) {
    return { ok: false, reason: "The demo agent daily limit has been reached." };
  }

  const recent = (limitState.perIp.get(ip) ?? []).filter(
    (at) => now - at < 60 * 60 * 1000,
  );
  if (recent.length >= config.perIpLimit) {
    return { ok: false, reason: "Too many agent requests from this address. Try again later." };
  }

  recent.push(now);
  limitState.perIp.set(ip, recent);
  limitState.daily += 1;
  limitState.total += 1;
  return { ok: true };
}

export type CachedReview = {
  review: LLMReview;
  recommendation: Recommendation;
};

const reviewCache = new Map<string, { at: number; value: CachedReview }>();

export function getCachedReview(key: string): CachedReview | null {
  const cached = reviewCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.at >= CACHE_MS) {
    reviewCache.delete(key);
    return null;
  }
  return cached.value;
}

export function setCachedReview(key: string, value: CachedReview): void {
  reviewCache.set(key, { at: Date.now(), value });
}

function withLlmTrace(trace: TraceEvent[], event: TraceEvent): TraceEvent[] {
  const copy = [...trace];
  const at = copy.findIndex((item) => item.tool === "brief.compose");
  copy.splice(at >= 0 ? at : copy.length, 0, event);
  return copy.map((item, index) => ({ ...item, step: index + 1 }));
}

export function applyReview({
  rec,
  stand,
  daypart,
  review,
  partner,
}: {
  rec: Recommendation;
  stand: Stand;
  daypart: Daypart;
  review: LLMReview;
  partner: Partner | null;
}): { recommendation: Recommendation; review: LLMReview } {
  if (review.status !== "ok" || !review.action) {
    return { recommendation: rec, review };
  }

  const event: TraceEvent = {
    step: 0,
    tool: "llm.review",
    input: `action=${review.action}; model=${review.model ?? "unknown"}`,
    output:
      review.action === "keep"
        ? `Keep: ${review.reason ?? "No switch."}`
        : `${review.partnerName} with ${review.dish}: ${review.reason ?? ""}`,
    durationMs: review.latencyMs ?? 0,
    status: "ok",
  };
  const trace = withLlmTrace(rec.trace, event);

  if (review.action === "keep") {
    return {
      recommendation: {
        ...rec,
        decision: "keep",
        decisionReason: review.reason ?? "The agent recommends keeping the incumbent.",
        agentReviewed: false,
        trace,
      },
      review: {
        ...review,
        accepted: true,
        baseDelta: rec.model.baseDelta,
        capacityNote: rec.model.capacityNote,
      },
    };
  }

  if (!partner) {
    return {
      recommendation: { ...rec, trace },
      review: { ...review, status: "invalid", reason: "The agent chose no partner." },
    };
  }

  const dish = review.dish ?? rec.menuItem;
  const modelStand = {
    ...stand,
    suggestedItem: dish,
    suggestedPrice: rec.menuPrice,
  };
  const chosenModel = optimize(modelStand, daypart, partner);
  const chosenConstraints = checkConstraints(modelStand, partner, daypart, chosenModel.capacity);
  const blocked = chosenConstraints.some((item) => item.status === "blocked");
  const accepted = !blocked && chosenModel.baseDelta > 0;
  const vetoReason = accepted
    ? undefined
    : blocked
      ? "A venue rule blocks the partner."
      : "The base case does not beat the incumbent.";

  const nextReview: LLMReview = {
    ...review,
    accepted,
    vetoReason,
    baseDelta: chosenModel.baseDelta,
    capacityNote: chosenModel.capacityNote,
  };

  if (!accepted) {
    return { recommendation: rec, review: nextReview };
  }

  return {
    recommendation: {
      ...rec,
      partner,
      menuItem: dish,
      pickNote: review.reason ?? rec.pickNote,
      pickMatchTerm: dish,
      categoryMatched: true,
      decision: "switch",
      decisionReason: review.reason ?? rec.decisionReason,
      agentReviewed: true,
      model: chosenModel,
      constraints: chosenConstraints,
      trace,
    },
    review: nextReview,
  };
}
