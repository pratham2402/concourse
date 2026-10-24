"use client";

import { useCallback, useEffect, useState } from "react";
import AgentTrace from "@/components/AgentTrace";
import ConcourseMap from "@/components/ConcourseMap";
import StandPanel from "@/components/StandPanel";
import { getStand, venue } from "@/data/venue";
import type { Daypart, OverviewStand, Recommendation } from "@/lib/types";
import { DAYPARTS, compact } from "@/lib/types";

export default function Home() {
  const [daypart, setDaypart] = useState<Daypart>("midgame");
  const [selectedId, setSelectedId] = useState("s1");
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [overview, setOverview] = useState<OverviewStand[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);

  const stand = getStand(selectedId);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch(`/api/overview?daypart=${daypart}`).then((response) => response.json()),
      fetch(`/api/optimize?standId=${selectedId}&daypart=${daypart}`).then((response) =>
        response.json(),
      ),
    ])
      .then(([overviewData, recommendation]: [{ stands: OverviewStand[] }, Recommendation]) => {
        if (cancelled) return;
        const stands = (overviewData.stands ?? []).map((item) =>
          item.standId === selectedId
            ? {
                ...item,
                baseDelta: recommendation.model.baseDelta,
                partnerName: recommendation.partner.name,
                decision: recommendation.decision,
                source: recommendation.source,
              }
            : item,
        );
        setOverview(stands);
        setRec(recommendation);
        setLiveError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setRec(null);
        setLiveError("The recommendation could not be loaded. Try another stand.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, daypart]);

  const selectStand = useCallback((id: string) => {
    setSelectedId(id);
    setLiveError(null);
  }, []);

  const refreshLive = useCallback(async () => {
    setLiveLoading(true);
    setLiveError(null);
    try {
      const response = await fetch(
        `/api/optimize?standId=${selectedId}&daypart=${daypart}&live=1`,
      );
      const data = (await response.json()) as Recommendation;
      setRec(data);
      setOverview((current) =>
        current.map((item) =>
          item.standId === selectedId
            ? {
                ...item,
                baseDelta: data.model.baseDelta,
                partnerName: data.partner.name,
                decision: data.decision,
                source: data.source,
              }
            : item,
        ),
      );
      if (data.source !== "live") {
        setLiveError("Live Qloo was unavailable, so the cached snapshot is showing.");
      }
    } catch {
      setLiveError("Live Qloo could not be reached. The cached snapshot is still available.");
    } finally {
      setLiveLoading(false);
    }
  }, [selectedId, daypart]);

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <svg className="brand-mark" viewBox="0 0 40 40" aria-hidden="true">
            <circle cx="20" cy="20" r="17" fill="none" stroke="#f2a65a" strokeWidth="1.4" />
            <circle cx="20" cy="20" r="11" fill="none" stroke="#24313d" strokeWidth="1.2" />
            <path d="M20 8 L28 20 L20 32 L12 20 Z" fill="#5ec28a" opacity="0.9" />
            <circle cx="20" cy="20" r="2.2" fill="#0b1117" />
          </svg>
          <div>
            <div className="wordmark">CONCOURSE</div>
            <div className="brand-sub">Stadium revenue lab</div>
          </div>
        </div>

        <div className="venue">
          <div className="venue-name">{venue.name}</div>
          <div className="venue-meta">
            {venue.city} · {compact(venue.capacity)} seats
          </div>
        </div>

        <div className="top-actions">
          <div className="segmented" role="group" aria-label="Game daypart">
            {DAYPARTS.map((item) => (
              <button
                key={item.key}
                type="button"
                aria-pressed={daypart === item.key}
                onClick={() => setDaypart(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button
            className="live-btn"
            type="button"
            onClick={refreshLive}
            disabled={liveLoading}
            title="Call the Qloo API for this stand"
          >
            {liveLoading ? <span className="spinner" /> : <span className="dot dot-amber" />}
            {liveLoading ? "Calling Qloo" : "Refresh live"}
          </button>
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <div className="kicker">A Qloo-powered concession planner</div>
          <h1>
            The menu is the <em>last guess.</em>
          </h1>
          <p>
            Concourse reads the team's fan signal and the section pulse around each stand, ranks
            partner restaurants with Qloo, and shows the per-cap case before you switch.
            One venue, many outlets, real constraints.
          </p>
        </div>
        <aside className="hero-note">
          <div className="label">Demo venue</div>
          <p>
            {venue.name}, {venue.stands.length} stands, three dayparts.
          </p>
          <div className="fine">
            Stand sales are illustrative. Partner rankings come from Qloo, either live or from a
            cached snapshot. The revenue model is deterministic and visible.
          </div>
        </aside>
      </section>

      <div className="grid">
        <div className="left-col">
        <section className="card map-card">
          <div className="card-head">
            <div>
              <div className="card-title">Concourse map</div>
              <div className="card-meta">
                Level 1 · 8 stands · {venue.neighborhood} · snapshot overview; selected stand live
              </div>
            </div>
            <div className="map-status">
              <span className="dot dot-green" />
              Modeled per-cap delta
            </div>
          </div>

          <ConcourseMap
            stands={venue.stands}
            selectedId={selectedId}
            overview={overview}
            onSelect={selectStand}
          />

          <div className="map-legend">
            <span className="legend-item">
              <span className="dot dot-green" /> Positive switch
            </span>
            <span className="legend-item">
              <span className="dot dot-amber" /> Selected stand
            </span>
            <span className="legend-item">
              <span className="dot dot-gray" /> No switch
            </span>
            <span className="legend-item">
              <span className="dot dot-red" /> Negative, blocked, or no switch
            </span>
          </div>
        </section>

        <aside className="card method-card">
          <div className="card-title">How the number is made</div>
          <div className="card-meta">Deterministic model · Qloo demand signal</div>
          <div className="method-steps">
            <div className="method-step">
              <span className="n">01</span>
              <div>
                <b>Qloo ranks the partner</b>
                <p>Team brand, section pulse, and the Concourse locality produce the partner restaurant ranking.</p>
              </div>
            </div>
            <div className="method-step">
              <span className="n">02</span>
              <div>
                <b>The model does the math</b>
                <p>Units, price, elasticity, and throughput capacity. The model, not the narrative, sets the number.</p>
              </div>
            </div>
            <div className="method-step">
              <span className="n">03</span>
              <div>
                <b>Constraints and the money decide</b>
                <p>Exclusivity, commissary, equipment, and staffing. A blocked partner is rejected, and a switch that loses money is declined.</p>
              </div>
            </div>
          </div>
          <div className="method-note">
            Stand sales are illustrative. The brief shows every assumption behind the number.
          </div>
        </aside>
        </div>

        <StandPanel
          rec={rec}
          stand={stand}
          daypart={daypart}
          loading={loading}
          liveLoading={liveLoading}
          liveError={liveError}
          onRefreshLive={refreshLive}
        />
      </div>

      <AgentTrace rec={rec} />

      <footer className="footer">
        <span>
          Built for the Qloo Agentic Hackathon · Qloo Taste AI for partner ranking · Deterministic
          revenue model
        </span>
        <span>Open source · MIT</span>
      </footer>
    </main>
  );
}
