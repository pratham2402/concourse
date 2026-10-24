import type { Daypart } from "@/lib/types";

export type DemoPick = {
  partner: string;
  item: string;
  price: number;
  note: string;
};

export const picks: Record<string, DemoPick> = {
  s1: {
    partner: "Mofongo El Mocano (Mofongo Tipico)",
    item: "Mofongo bowl",
    price: 12.0,
    note: "Rank 1 in the section. A plantain bowl travels well and reads as a real local special, not a generic stadium item.",
  },
  s2: {
    partner: "G Bar",
    item: "Late-night pizza",
    price: 10.5,
    note: "Rank 2 in the section. Rank 1 is a plantain bowl; this stand needs a shareable item that fits the no-fryer rule.",
  },
  s3: {
    partner: "Cake's by Alejandro",
    item: "Family pastry box",
    price: 9.5,
    note: "Rank 4 in the section. A dessert box fits the family zone and avoids the bar signal in the top-ranked partner.",
  },
  s4: {
    partner: "Smokey Island Grille",
    item: "Chopped cheese fries",
    price: 9.0,
    note: "Rank 3 in the section. A large-group grill item matches the bleachers crowd and the existing fryer setup.",
  },
  s5: {
    partner: "Concourse Jamaican Bakery",
    item: "Beef patty",
    price: 6.5,
    note: "Rank 3 in the section. A handheld patty keeps the high-traffic Great Hall moving.",
  },
  s6: {
    partner: "Cake's by Alejandro",
    item: "Dessert box",
    price: 9.5,
    note: "Rank 3 in the section. The terrace is oven-only; a dessert box fits the equipment and the evening crowd.",
  },
  s7: {
    partner: "El Nuevo Bohío",
    item: "Chicken rice bowl",
    price: 8.0,
    note: "Rank 4 in the section. A family rice bowl with no bar signal passes the family-zone rule.",
  },
  s8: {
    partner: "King Dragon",
    item: "Late-night noodles",
    price: 10.5,
    note: "Rank 6 in the section. The post-game crowd wants a hot, portable item, and the model checks the limited staffing.",
  },
};

export const daypartPicks: Partial<Record<string, Partial<Record<Daypart, DemoPick>>>> = {
  s1: {
    postgame: {
      partner: "Cake's by Alejandro",
      item: "Cake slice",
      price: 7.5,
      note: "The post-game crowd is smaller and wants dessert; this is rank 5 in the same section.",
    },
  },
  s8: {
    pregame: {
      partner: "Starbucks Coffee Company",
      item: "Iced coffee",
      price: 5.5,
      note: "The pre-game window is a coffee-and-walk crowd; this is rank 3 in the same section.",
    },
  },
};

export function getPick(standId: string, daypart: Daypart): DemoPick {
  const fallback = picks[standId];
  if (!fallback) {
    throw new Error(`No menu pick for stand ${standId}`);
  }
  return daypartPicks[standId]?.[daypart] ?? fallback;
}
