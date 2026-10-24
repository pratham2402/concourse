import { NextResponse } from "next/server";
import { getStand, venue } from "@/data/venue";
import { getLocalPartners, isQlooConfigured } from "@/lib/qloo";
import {
  buildRecommendation,
  fallbackPartner,
  getSnapshotPartners,
} from "@/lib/recommend";
import type { Daypart, Partner } from "@/lib/types";

export const dynamic = "force-dynamic";

const DAYPARTS: Daypart[] = ["pregame", "midgame", "postgame"];

function parseDaypart(value: string | null): Daypart {
  return DAYPARTS.includes(value as Daypart) ? (value as Daypart) : "midgame";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const standId = searchParams.get("standId") ?? "s1";
  const daypart = parseDaypart(searchParams.get("daypart"));
  const wantsLive = searchParams.get("live") === "1";
  const stand = getStand(standId);

  let partners: Partner[] = [];
  let source: "live" | "snapshot" | "fallback" = "snapshot";
  let liveError: string | null = null;

  if (wantsLive && isQlooConfigured()) {
    try {
      partners = await getLocalPartners({
        teamBrandId: venue.teamBrandId,
        seedEntityId: stand.seedEntityId,
        locality: venue.locality,
        take: 8,
      });
      source = "live";
    } catch (error) {
      liveError = error instanceof Error ? error.message : "Live Qloo request failed";
    }
  }

  if (partners.length === 0) {
    partners = getSnapshotPartners(stand.id);
    source = partners.length ? "snapshot" : "fallback";
  }

  if (partners.length === 0) {
    partners = [fallbackPartner(stand)];
    source = "fallback";
  }

  const recommendation = buildRecommendation({ standId: stand.id, daypart, partners, source });

  if (wantsLive && source !== "live") {
    recommendation.trace.splice(3, 0, {
      label: "Live query",
      detail: liveError
        ? `Live Qloo unavailable: ${liveError}. Using the cached snapshot.`
        : "Live Qloo unavailable. Using the cached snapshot.",
      status: "warn",
    });
  }

  return NextResponse.json(recommendation);
}
