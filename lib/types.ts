export type Daypart = "pregame" | "midgame" | "postgame";

export interface MenuItem {
  name: string;
  price: number;
  cost: number;
  category: string;
  units: Record<Daypart, number>;
}

export interface Stand {
  id: string;
  label: string;
  section: string;
  zone: string;
  x: number;
  y: number;
  w: number;
  h: number;
  traffic: Record<Daypart, number>;
  throughputPerHour: number;
  hours: Record<Daypart, number>;
  incumbent: MenuItem;
  constraints: string[];
  seedArtist: string;
  seedEntityId: string;
  suggestedItem: string;
  suggestedPrice: number;
}

export interface Venue {
  id: string;
  name: string;
  team: string;
  teamBrandId: string;
  city: string;
  locality: string;
  neighborhood: string;
  capacity: number;
  stands: Stand[];
}

export interface Partner {
  name: string;
  entityId: string;
  type: string;
  rank: number;
  description: string;
  tags: string[];
  priceLevel: number | null;
  popularity: number | null;
  neighborhood: string;
  city: string;
  imageUrl: string | null;
  evidence: {
    seedId: string;
    effect: number | null;
  }[];
}

export interface Scenario {
  label: "Conservative" | "Base" | "Upside";
  units: number;
  revenue: number;
  perCap: number;
  delta: number;
  margin: number;
  marginDelta: number;
}

export interface ModelResult {
  currentUnits: number;
  currentRevenue: number;
  currentPerCap: number;
  currentMargin: number;
  suggestedPrice: number;
  suggestedCost: number;
  capacity: number;
  traffic: number;
  hours: number;
  scenarios: Scenario[];
  baseDelta: number;
  capacityBound: boolean;
  capacityNote: string | null;
  assumptions: string[];
}

export interface ConstraintResult {
  label: string;
  status: "pass" | "flag" | "blocked";
  detail: string;
}

export interface TraceEvent {
  step: number;
  tool: string;
  input: string;
  output: string;
  durationMs: number;
  status: "ok" | "warn" | "error";
}

export interface Recommendation {
  standId: string;
  daypart: Daypart;
  partner: Partner;
  menuItem: string;
  menuPrice: number;
  pickNote: string;
  pickTagMatch: string;
  pickMatchTerm: string | null;
  categoryMatched: boolean;
  localCount: number;
  chainCount: number;
  decision: "switch" | "keep";
  decisionReason: string;
  model: ModelResult;
  constraints: ConstraintResult[];
  source: "live" | "snapshot" | "fallback";
  trace: TraceEvent[];
}

export interface OverviewStand {
  standId: string;
  baseDelta: number;
  partnerName: string;
  decision: "switch" | "keep";
  source: "live" | "snapshot" | "fallback";
}

export type LLMReview = {
  status: "ok" | "disabled" | "limit" | "error" | "invalid";
  action?: "switch" | "keep";
  partnerName?: string;
  partnerEntityId?: string;
  dish?: string;
  reason?: string;
  model?: string;
  latencyMs?: number;
  accepted?: boolean;
  vetoReason?: string;
  baseDelta?: number;
  capacityNote?: string | null;
};

export type AgentResponse = {
  standId: string;
  daypart: Daypart;
  recommendation: Recommendation;
  review: LLMReview;
};

export const DAYPARTS: { key: Daypart; label: string; short: string }[] = [
  { key: "pregame", label: "Pre-game", short: "PRE" },
  { key: "midgame", label: "Mid-game", short: "MID" },
  { key: "postgame", label: "Post-game", short: "POST" },
];

export function money(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

export function compact(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}
