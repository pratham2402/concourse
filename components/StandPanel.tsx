"use client";

import { venue } from "@/data/venue";
import type { Daypart, Recommendation, Stand } from "@/lib/types";
import { DAYPARTS, compact, money } from "@/lib/types";

type Props = {
  rec: Recommendation | null;
  stand: Stand;
  daypart: Daypart;
  loading: boolean;
  liveLoading: boolean;
  liveError: string | null;
  onRefreshLive: () => void;
};

function signed(value: number): string {
  return `${value >= 0 ? "+" : "−"}${money(Math.abs(value))}`;
}

function sourceLabel(source: Recommendation["source"]): string {
  if (source === "live") return "Live Qloo";
  if (source === "snapshot") return "Cached snapshot";
  return "Fallback data";
}

function sourceClass(source: Recommendation["source"]): string {
  if (source === "live") return "source-live";
  if (source === "snapshot") return "source-snapshot";
  return "source-fallback";
}

function downloadBrief(rec: Recommendation, stand: Stand, daypart: Daypart) {
  const daypartLabel = DAYPARTS.find((item) => item.key === daypart)?.label ?? daypart;
  const base = rec.model.scenarios.find((item) => item.label === "Base") ?? rec.model.scenarios[1];
  const lines = [
    `# Concourse vendor brief`,
    ``,
    `**Venue:** ${venue.name}, ${venue.city}`,
    `**Stand:** ${stand.label}, ${stand.section}, ${stand.zone}`,
    `**Daypart:** ${daypartLabel}`,
    `**Partner:** ${rec.partner.name} (Qloo rank ${rec.partner.rank})`,
    `**Menu idea:** ${rec.menuItem} at ${money(rec.menuPrice)}`,
    `**Current item:** ${stand.incumbent.name} at ${money(stand.incumbent.price)}`,
    ``,
    `## The switch`,
    ``,
    `Modeled base per-cap delta: **${signed(base.delta)} per fan**.`,
    `Conservative to upside: ${signed(rec.model.scenarios[0].delta)} to ${signed(rec.model.scenarios[2].delta)}.`,
    `Traffic for this daypart: ${compact(rec.model.traffic)} fans.`,
    `Current per-cap: ${money(rec.model.currentPerCap)}.`,
    ``,
    `## Why this partner`,
    ``,
    `${rec.partner.description || "Local partner ranked by Qloo for this section."}`,
    ``,
    `Audience seed: ${stand.seedArtist} plus ${venue.team}. Locality: ${venue.locality}.`,
    `Tags: ${rec.partner.tags.slice(0, 10).join(", ") || "not listed"}.`,
    ``,
    `## Constraints`,
    ``,
    ...rec.constraints.map((item) => `- ${item.label}: ${item.status.toUpperCase()} — ${item.detail}`),
    ``,
    `## Model`,
    ``,
    ...rec.model.assumptions.map((item) => `- ${item}`),
    ``,
    `## Note`,
    ``,
    `This brief uses illustrative stand sales and a deterministic model. It is a decision aid, not a guarantee of lift. Qloo data is used to rank local partners, not to set the revenue numbers.`,
    ``,
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `concourse-${stand.id}-${daypart}.md`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function StandPanel({
  rec,
  stand,
  daypart,
  loading,
  liveLoading,
  liveError,
  onRefreshLive,
}: Props) {
  if (loading || !rec) {
    return (
      <div className="panel">
        <section className="card stand-card">
          <div className="loading-block">Reading the concourse…</div>
          <div className="skeleton" style={{ width: "55%" }} />
          <div className="skeleton" style={{ width: "80%" }} />
          <div className="skeleton" style={{ width: "70%" }} />
          <div className="skeleton" style={{ width: "45%" }} />
        </section>
      </div>
    );
  }

  const base = rec.model.scenarios.find((item) => item.label === "Base") ?? rec.model.scenarios[1];
  const low = rec.model.scenarios[0];
  const high = rec.model.scenarios[2];
  const blocked = rec.constraints.filter((item) => item.status === "blocked").length;
  const flagged = rec.constraints.filter((item) => item.status === "flag").length;
  const seedEffect = rec.partner.evidence[0]?.effect;

  return (
    <div className="panel">
      <section className="card stand-card">
        <div className="stand-head">
          <div>
            <div className="stand-title">{stand.label}</div>
            <div className="stand-sub">
              {stand.section} · {stand.zone} · {compact(rec.model.traffic)} fans this daypart
            </div>
          </div>
          <span className={`source-pill ${sourceClass(rec.source)}`}>
            <span className={`dot ${rec.source === "live" ? "dot-green" : rec.source === "snapshot" ? "dot-amber" : "dot-red"}`} />
            {sourceLabel(rec.source)}
          </span>
        </div>

        <div className="metric-row">
          <div className="metric">
            <div className="metric-label">On the menu now</div>
            <div className="metric-value" style={{ fontSize: 16 }}>
              {stand.incumbent.name}
            </div>
            <div className="metric-label" style={{ marginTop: 5 }}>
              {money(stand.incumbent.price)}
            </div>
          </div>
          <div className="metric">
            <div className="metric-label">Current per-cap</div>
            <div className="metric-value">{money(rec.model.currentPerCap)}</div>
            <div className="metric-label" style={{ marginTop: 5 }}>
              this stand
            </div>
          </div>
          <div className="metric">
            <div className="metric-label">Fans in window</div>
            <div className="metric-value">{compact(rec.model.traffic)}</div>
            <div className="metric-label" style={{ marginTop: 5 }}>
              {daypart}
            </div>
          </div>
        </div>

        <div className="recommend">
          <div className="recommend-top">
            <div>
              <div className="recommend-label">Recommended switch · Qloo rank #{rec.partner.rank}</div>
              <div className="recommend-title">{rec.menuItem}</div>
              <div className="recommend-partner">
                {rec.partner.name} · {money(rec.menuPrice)}
              </div>
            </div>
            <div className="delta-block">
              <div className={`delta-value ${base.delta < 0 ? "negative" : ""}`}>{signed(base.delta)}</div>
              <div className="delta-label">modeled per fan</div>
              <div className="delta-range">
                {signed(low.delta)} to {signed(high.delta)}
              </div>
            </div>
          </div>

          <div className="switch-row">
            <div className="switch-item">
              <div className="k">Current</div>
              <div className="v">{stand.incumbent.name}</div>
              <div className="p">{money(stand.incumbent.price)} · {compact(stand.incumbent.units[daypart])} units</div>
            </div>
            <div className="switch-arrow">→</div>
            <div className="switch-item">
              <div className="k">Qloo pick</div>
              <div className="v">{rec.menuItem}</div>
              <div className="p">{money(rec.menuPrice)} · {compact(base.units)} units</div>
            </div>
          </div>
        </div>

        <div className="section">
          <div className="section-title">
            <span>Why this partner</span>
            <span>Qloo evidence</span>
          </div>
          <div className="why-row">
            <div className="why-key">Partner</div>
            <div className="why-val">
              {rec.partner.name}
              {rec.partner.neighborhood ? ` · ${rec.partner.neighborhood}` : ""}
            </div>
          </div>
          <div className="why-row">
            <div className="why-key">Audience</div>
            <div className="why-val">
              Fans of {stand.seedArtist} and {venue.team}, scoped to {venue.locality}.
              {seedEffect !== null && seedEffect !== undefined ? ` Seed effect ${seedEffect.toFixed(2)}.` : ""}
            </div>
          </div>
          <div className="why-row">
            <div className="why-key">Menu fit</div>
            <div className="why-val">
              {rec.pickNote}{" "}
              {rec.categoryMatched
                ? `Category match: ${rec.pickTagMatch}.`
                : `No ${rec.pickTagMatch} match in this Qloo list; the top partner is shown.`}
            </div>
          </div>
          <div className="why-row">
            <div className="why-key">Profile</div>
            <div className="why-val">
              {rec.partner.description
                ? `${rec.partner.description.slice(0, 230)}${rec.partner.description.length > 230 ? "…" : ""}`
                : "Local partner ranked by the Qloo taste graph for this section."}
            </div>
          </div>
          <div className="tag-list">
            {rec.partner.tags.slice(0, 8).map((tag) => (
              <span className="tag" key={tag}>
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="section">
          <div className="section-title">
            <span>Constraints</span>
            <span>
              {blocked} blocked · {flagged} need approval
            </span>
          </div>
          {rec.constraints.map((item) => (
            <div className="constraint" key={item.label}>
              <span className={`dot ${item.status === "pass" ? "status-pass" : item.status === "flag" ? "status-flag" : "status-blocked"}`} />
              <div>
                <div className="constraint-label">{item.label}</div>
                <div className="constraint-detail">{item.detail}</div>
              </div>
            </div>
          ))}
        </div>

        <details open>
          <summary>Switch case</summary>
          <table className="case-table">
            <thead>
              <tr>
                <th>Scenario</th>
                <th>Units</th>
                <th>Revenue</th>
                <th>Per-cap</th>
                <th>Δ / fan</th>
                <th>Δ margin</th>
              </tr>
            </thead>
            <tbody>
              {rec.model.scenarios.map((scenario) => (
                <tr key={scenario.label} className={scenario.label === "Base" ? "base" : undefined}>
                  <td>{scenario.label}</td>
                  <td>{Math.round(scenario.units).toLocaleString()}</td>
                  <td>{money(scenario.revenue)}</td>
                  <td>{money(scenario.perCap)}</td>
                  <td className={scenario.delta >= 0 ? "pos" : "neg"}>{signed(scenario.delta)}</td>
                  <td className={scenario.marginDelta >= 0 ? "pos" : "neg"}>{signed(scenario.marginDelta)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>

        <details>
          <summary>Model assumptions</summary>
          <ul className="assumptions">
            {rec.model.assumptions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </details>

        <div className="actions">
          <button className="btn btn-primary" type="button" onClick={() => downloadBrief(rec, stand, daypart)}>
            Download brief
          </button>
          <button className="btn btn-ghost" type="button" onClick={onRefreshLive} disabled={liveLoading}>
            {liveLoading ? "Refreshing…" : "Refresh live Qloo"}
          </button>
        </div>

        {liveError ? <div className="error-banner">{liveError}</div> : null}
      </section>
    </div>
  );
}
