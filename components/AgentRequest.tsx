"use client";

import { useEffect, useState } from "react";
import { AGENT_PRESETS } from "@/lib/presets";
import { money } from "@/lib/types";
import type { AgentResponse, LLMReview } from "@/lib/types";

type Props = {
  onResult: (data: AgentResponse) => void;
  resetSignal: number;
};

function deltaLabel(value: number | undefined): string {
  if (value === undefined) return "";
  return `${value >= 0 ? "+" : "-"}${money(Math.abs(value))}`;
}

function reviewTitle(review: LLMReview): string {
  if (review.action === "keep") return "Keep the incumbent";
  if (review.partnerName && review.dish) return `Switch to ${review.partnerName} with ${review.dish}`;
  if (review.partnerName) return `Switch to ${review.partnerName}`;
  return "Agent review";
}

export default function AgentRequest({ onResult, resetSignal }: Props) {
  const [presetId, setPresetId] = useState(AGENT_PRESETS[0].id);
  const [loading, setLoading] = useState(false);
  const [review, setReview] = useState<LLMReview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setReview(null);
    setError(null);
  }, [resetSignal]);

  const preset = AGENT_PRESETS.find((item) => item.id === presetId) ?? AGENT_PRESETS[0];
  const isOffline =
    review !== null && review.status !== "ok";

  async function runAgent() {
    setLoading(true);
    setError(null);
    setReview(null);
    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presetId: preset.id }),
      });
      const data = (await response.json()) as AgentResponse & { error?: string };
      if (!response.ok || data.error) {
        throw new Error(data.error ?? "The agent call failed.");
      }
      setReview(data.review);
      onResult(data);
    } catch (event) {
      setError(event instanceof Error ? event.message : "The agent call failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card agent-card">
      <div className="card-head">
        <div>
          <div className="card-title">Ask the operator agent</div>
          <div className="card-meta">
            Pick a preset. The agent reviews the filtered Qloo shortlist and can switch or keep.
          </div>
        </div>
        <span className="map-status">
          <span className={`dot ${isOffline ? "dot-amber" : "dot-green"}`} />
          Agent review
        </span>
      </div>

      <div className="agent-presets" role="group" aria-label="Operator request presets">
        {AGENT_PRESETS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`agent-preset ${item.id === preset.id ? "active" : ""}`}
            aria-pressed={item.id === preset.id}
            onClick={() => {
              setPresetId(item.id);
              setReview(null);
              setError(null);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="agent-request-line">{preset.request}</div>

      <div className="agent-run">
        <button className="btn btn-primary" type="button" onClick={runAgent} disabled={loading}>
          {loading ? "Running agent..." : "Run agent"}
        </button>
        <span className="agent-run-note">
          The agent chooses only from the shortlist. It never sets the revenue numbers.
        </span>
      </div>

      {error ? (
        <div className="agent-review error">
          <div className="agent-review-title">Agent unavailable</div>
          <div className="agent-review-reason">{error}. The deterministic view is still live.</div>
        </div>
      ) : null}

      {review ? (
        <div className={`agent-review ${review.status}`}>
          {review.status === "ok" ? (
            <>
              <div className="agent-review-head">
                <span className={`agent-badge ${review.action ?? ""}`}>
                  {review.action === "keep" ? "Agent keep" : "Agent switch"}
                </span>
                <span className="agent-model">
                  {review.model ?? "model"}
                  {review.latencyMs !== undefined ? ` · ${review.latencyMs}ms` : ""}
                </span>
              </div>
              <div className="agent-review-title">{reviewTitle(review)}</div>
              <div className="agent-review-reason">{review.reason}</div>
              <div className="agent-review-check">
                {review.action === "keep"
                  ? "Deterministic check: accepted. The incumbent stays."
                  : review.accepted
                    ? `Deterministic check: accepted. ${deltaLabel(review.baseDelta)} per fan.`
                    : `Deterministic check: vetoed. ${review.vetoReason ?? "The switch did not clear the rules."} The deterministic recommendation stands.`}
              </div>
            </>
          ) : (
            <>
              <div className="agent-review-title">
                {review.status === "disabled"
                  ? "Agent offline"
                  : review.status === "limit"
                    ? "Agent limit reached"
                    : review.status === "invalid"
                      ? "Agent answer rejected"
                      : "Agent unavailable"}
              </div>
              <div className="agent-review-reason">
                {review.reason ?? "The agent could not complete this request."} The deterministic
                view is still live.
              </div>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
