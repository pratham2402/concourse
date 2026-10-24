import type { Daypart } from "@/lib/types";

export type DemoPick = {
  item: string;
  price: number;
  tagMatch: string;
  matchTerms: string[];
  note: string;
};

export const picks: Record<string, DemoPick> = {
  s1: {
    item: "Mofongo bowl",
    price: 12.0,
    tagMatch: "mofongo",
    matchTerms: ["mofongo"],
    note: "A plantain bowl travels well and reads as a local special, not a generic stadium item.",
  },
  s2: {
    item: "Late-night pizza",
    price: 10.5,
    tagMatch: "pizza",
    matchTerms: ["pizza"],
    note: "A shareable pizza fits the no-fryer rule and the left-field crowd.",
  },
  s3: {
    item: "Family pastry box",
    price: 9.5,
    tagMatch: "dessert",
    matchTerms: ["bakery", "pastry", "cake", "pie", "donut", "dessert shop"],
    note: "A dessert box fits the family zone and avoids an alcohol signal.",
  },
  s4: {
    item: "Chopped cheese fries",
    price: 9.0,
    tagMatch: "grill",
    matchTerms: ["fries", "grill", "chopped cheese", "cheesesteak"],
    note: "A large-group grill item matches the bleachers crowd and the existing fryer setup.",
  },
  s5: {
    item: "Beef patty",
    price: 6.5,
    tagMatch: "patty",
    matchTerms: ["patty", "jamaican", "caribbean"],
    note: "A handheld patty keeps the high-traffic Great Hall moving.",
  },
  s6: {
    item: "Dessert box",
    price: 9.5,
    tagMatch: "dessert",
    matchTerms: ["bakery", "cake", "pie", "ice cream", "dessert shop", "pastry"],
    note: "The terrace is oven-only; a dessert box fits the equipment and the evening crowd.",
  },
  s7: {
    item: "Chicken rice bowl",
    price: 8.0,
    tagMatch: "rice bowl",
    matchTerms: ["rice bowl", "bowl", "dominican", "jamaican", "caribbean", "soul food"],
    note: "A family rice bowl with no bar signal passes the family-zone rule.",
  },
  s8: {
    item: "Late-night noodles",
    price: 10.5,
    tagMatch: "noodles",
    matchTerms: ["noodle", "ramen", "pho", "chinese", "asian", "thai", "sushi"],
    note: "The post-game crowd wants a hot, portable item, and the model checks the limited staffing.",
  },
};

export const daypartPicks: Partial<Record<string, Partial<Record<Daypart, DemoPick>>>> = {
  s1: {
    postgame: {
      item: "Cake slice",
      price: 7.5,
      tagMatch: "dessert",
      matchTerms: ["bakery", "cake", "pie", "dessert shop", "pastry"],
      note: "The post-game crowd is smaller and wants dessert; the item changes with the daypart.",
    },
  },
  s8: {
    pregame: {
      item: "Iced coffee",
      price: 5.5,
      tagMatch: "coffee",
      matchTerms: ["coffee", "cafe", "espresso", "bakery"],
      note: "The pre-game window is a coffee-and-walk crowd; the item changes with the daypart.",
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
