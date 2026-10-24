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
          <div className="card-meta">A run log of the tools the agent called</div>
        </div>
        <span className="map-status">
          <span className={`dot ${rec?.source === "live" ? "dot-green" : "dot-amber"}`} />
          {rec?.source === "live" ? "Live Qloo" : rec?.source === "snapshot" ? "Snapshot run" : "Fallback run"}
        </span>
      </div>

      {!rec ? (
        <div className="loading-block">Waiting for the first stand…</div>
      ) : (
        <div className="trace-list">
          {rec.trace.map((event) => (
            <div className="trace-step" key={event.step}>
              <div className="trace-index">{String(event.step).padStart(2, "0")}</div>
              <div>
                <div className="trace-label">
                  <span className={`dot ${event.status === "ok" ? "dot-green" : "dot-amber"}`} />
                  <span className="trace-tool">{event.tool}</span>
                  <span className="trace-duration">{event.durationMs}ms</span>
                </div>
                <div className="trace-io">
                  <span>in</span> {event.input}
                </div>
                <div className="trace-io">
                  <span>out</span> {event.output}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
