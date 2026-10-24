"use client";

import type { Recommendation } from "@/lib/types";

type Props = {
  rec: Recommendation | null;
};

export default function AgentTrace({ rec }: Props) {
  return (
    <section className="card trace-card">
      <div className="card-head">
        <div>
          <div className="card-title">Agent trace</div>
          <div className="card-meta">The steps behind the recommendation</div>
        </div>
        <span className="map-status">
          <span className={`dot ${rec?.source === "live" ? "dot-green" : "dot-amber"}`} />
          {rec?.source === "live" ? "Live Qloo" : "Cached snapshot"}
        </span>
      </div>

      {!rec ? (
        <div className="loading-block">Waiting for the first stand…</div>
      ) : (
        <div className="trace-list">
          {rec.trace.map((step, index) => (
            <div className="trace-step" key={`${step.label}-${index}`}>
              <div className="trace-index">{String(index + 1).padStart(2, "0")}</div>
              <div>
                <div className="trace-label">
                  <span className={`dot ${step.status === "ok" ? "dot-green" : "dot-amber"}`} />
                  {step.label}
                </div>
                <div className="trace-detail">{step.detail}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
