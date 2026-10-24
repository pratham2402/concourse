import { NextResponse } from "next/server";
import { getStand } from "@/data/venue";
import { runAgent } from "@/lib/agent";
import type { Daypart } from "@/lib/types";

export const dynamic = "force-dynamic";

const DAYPARTS: Daypart[] = ["pregame", "midgame", "postgame"];

function parseDaypart(value: string | null): Daypart {
  return DAYPARTS.includes(value as Daypart) ? (value as Daypart) : "midgame";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const standId = searchParams.get("standId") ?? "s1";
  const daypart = parseDaypart(searchParams.get("daypart"));
  const live = searchParams.get("live") !== "0";
  const stand = getStand(standId);

  const recommendation = await runAgent({ standId: stand.id, daypart, live });
  return NextResponse.json(recommendation);
}
