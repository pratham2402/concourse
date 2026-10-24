import type {
  ConstraintResult,
  Daypart,
  ModelResult,
  Partner,
  Stand,
} from "@/lib/types";

const PRICE_ELASTICITY = 0.6;
const LIFT_BASE = 0.02;
const LIFT_BY_RANK = [0.04, 0.03, 0.02, 0.015, 0.01];
const LIFT_BY_EVIDENCE = 0.02;
const LIFT_BY_POPULARITY = 0.02;

function liftFor(partner: Partner): {
  lift: number;
  rankLift: number;
  effect: number;
  popularity: number;
} {
  const rankLift = LIFT_BY_RANK[Math.min(partner.rank - 1, LIFT_BY_RANK.length - 1)] ?? 0.01;
  const effect = partner.evidence[0]?.effect ?? 0.5;
  const popularity = partner.popularity ?? 0.5;
  const lift = Math.min(
    0.1,
    LIFT_BASE + rankLift + LIFT_BY_EVIDENCE * effect + LIFT_BY_POPULARITY * popularity,
  );
  return { lift, rankLift, effect, popularity };
}

function blockedResult(label: string, detail: string): ConstraintResult {
  return { label, status: "blocked", detail };
}

function flagResult(label: string, detail: string): ConstraintResult {
  return { label, status: "flag", detail };
}

function passResult(label: string, detail: string): ConstraintResult {
  return { label, status: "pass", detail };
}

function partnerText(partner: Partner): string {
  return `${partner.name} ${partner.description} ${partner.tags.join(" ")}`.toLowerCase();
}

export function checkConstraints(
  stand: Stand,
  partner: Partner,
  daypart: Daypart,
  capacity: number,
): ConstraintResult[] {
  const text = partnerText(partner);
  const currentUnits = stand.incumbent.units[daypart];

  return stand.constraints.map((constraint) => {
    if (constraint.startsWith("Exclusive beverage")) {
      if (/\b(coca|cola|pepsi|sprite|soda|fountain)\b/.test(text)) {
        return blockedResult(constraint, "Partner profile signals a conflicting beverage brand.");
      }
      return passResult(constraint, "No conflicting beverage signal in the partner profile.");
    }

    if (constraint.startsWith("Family zone")) {
      if (/\b(bar|lounge|brew|beer|wine|cocktail|alcohol|pub|nightclub)\b/.test(text)) {
        return blockedResult(constraint, "Partner profile signals alcohol or a bar format.");
      }
      return passResult(constraint, "No alcohol or bar signal in the partner profile.");
    }

    if (constraint.startsWith("Commissary")) {
      return flagResult(
        constraint,
        "A local partner needs a commissary agreement, menu costing, and approval before it can sell.",
      );
    }

    if (constraint.startsWith("Equipment: no fryers")) {
      if (/\b(fry|fried|fries|fryer)\b/.test(text)) {
        return blockedResult(constraint, "Menu item likely needs a fryer.");
      }
      return passResult(constraint, "No fryer signal in the partner profile.");
    }

    if (constraint.startsWith("Equipment: oven only")) {
      if (/\b(grill|fried|fry|fryer)\b/.test(text)) {
        return blockedResult(constraint, "Menu item likely needs a grill or fryer.");
      }
      return passResult(constraint, "Fits an oven-only stand.");
    }

    if (constraint.startsWith("Throughput")) {
      if (capacity < currentUnits) {
        return flagResult(
          constraint,
          `Model capacity is ${Math.round(capacity).toLocaleString()} units, below current volume.`,
        );
      }
      return passResult(
        constraint,
        `Model caps the recommendation at ${Math.round(capacity).toLocaleString()} units for this daypart.`,
      );
    }

    if (constraint.startsWith("Post-game")) {
      return flagResult(constraint, "Confirm staffing for the post-game window.");
    }

    return passResult(constraint, "No constraint conflict detected.");
  });
}

export function pickPartner(partners: Partner[], stand: Stand, daypart: Daypart): Partner {
  if (partners.length === 0) {
    throw new Error("No partners to rank");
  }

  const capacity = stand.throughputPerHour * stand.hours[daypart];
  for (const partner of partners) {
    const checks = checkConstraints(stand, partner, daypart, capacity);
    if (!checks.some((check) => check.status === "blocked")) {
      return partner;
    }
  }
  return partners[0];
}

export function optimize(stand: Stand, daypart: Daypart, partner: Partner): ModelResult {
  const traffic = stand.traffic[daypart];
  const hours = stand.hours[daypart];
  const currentUnits = stand.incumbent.units[daypart];
  const currentRevenue = currentUnits * stand.incumbent.price;
  const currentPerCap = currentRevenue / traffic;
  const currentMargin = currentUnits * (stand.incumbent.price - stand.incumbent.cost);

  const suggestedPrice = stand.suggestedPrice;
  const suggestedCost = suggestedPrice * (stand.incumbent.cost / stand.incumbent.price);
  const capacity = stand.throughputPerHour * hours;

  const { lift, rankLift, effect, popularity } = liftFor(partner);
  const priceEffect = (stand.incumbent.price / suggestedPrice) ** PRICE_ELASTICITY;

  const scenarios = (
    [
      ["Conservative", 0.5],
      ["Base", 1],
      ["Upside", 1.5],
    ] as const
  ).map(([label, factor]) => {
    const units = Math.min(currentUnits * (1 + lift * factor) * priceEffect, capacity);
    const revenue = units * suggestedPrice;
    const perCap = revenue / traffic;
    const delta = (revenue - currentRevenue) / traffic;
    const margin = units * (suggestedPrice - suggestedCost);
    return {
      label,
      units: Math.round(units),
      revenue,
      perCap,
      delta,
      margin,
      marginDelta: margin - currentMargin,
    };
  });

  const base = scenarios.find((scenario) => scenario.label === "Base") ?? scenarios[0];

  return {
    currentUnits,
    currentRevenue,
    currentPerCap,
    currentMargin,
    suggestedPrice,
    suggestedCost,
    capacity,
    traffic,
    hours,
    scenarios,
    baseDelta: base.delta,
    assumptions: [
      `Lift = ${(LIFT_BASE * 100).toFixed(1)}% base + ${(rankLift * 100).toFixed(1)}% rank + ${(LIFT_BY_EVIDENCE * 100).toFixed(1)}% × ${effect.toFixed(2)} evidence + ${(LIFT_BY_POPULARITY * 100).toFixed(1)}% × ${popularity.toFixed(2)} popularity = ${(lift * 100).toFixed(1)}%.`,
      `Price elasticity: ${PRICE_ELASTICITY}. Units adjust by (current price / suggested price)^${PRICE_ELASTICITY}.`,
      `Throughput cap: ${stand.throughputPerHour.toLocaleString()} units per hour × ${hours} hours = ${Math.round(capacity).toLocaleString()} units.`,
      "Suggested cost uses the incumbent's cost ratio (cost / price).",
      "Stand sales, traffic, and menu costs are illustrative for the demo. The model is a decision aid, not a guarantee.",
    ],
  };
}
