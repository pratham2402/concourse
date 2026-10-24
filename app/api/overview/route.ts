import { NextResponse } from "next/server";
import { buildOverview } from "@/lib/recommend";
import type { Daypart } from "@/lib/types";

export const dynamic = "force-dynamic";

const DAYPARTS: Daypart[] = ["pregame", "midgame", "postgame"];

function parseDaypart(value: string | null): Daypart {
  return DAYPARTS.includes(value as Daypart) ? (value as Daypart) : "midgame";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const daypart = parseDaypart(searchParams.get("daypart"));
  return NextResponse.json({ daypart, stands: buildOverview(daypart) });
}
