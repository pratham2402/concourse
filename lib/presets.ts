import type { Daypart } from "@/lib/types";

export type AgentPreset = {
  id: string;
  label: string;
  standId: string;
  daypart: Daypart;
  request: string;
};

export const AGENT_PRESETS: AgentPreset[] = [
  {
    id: "bleachers-grill",
    label: "Bleachers grill item",
    standId: "s4",
    daypart: "midgame",
    request: "Find a large-group grill item for the Bleachers stand at mid-game.",
  },
  {
    id: "home-value",
    label: "Home Plate value item",
    standId: "s1",
    daypart: "midgame",
    request: "Find a value item for the Home Plate stand at mid-game.",
  },
  {
    id: "postgame-late",
    label: "Post-Game late night",
    standId: "s8",
    daypart: "postgame",
    request: "Find a late-night hot item for the Post-Game stand with limited staffing.",
  },
];

export function getAgentPreset(id: string): AgentPreset | undefined {
  return AGENT_PRESETS.find((preset) => preset.id === id);
}
