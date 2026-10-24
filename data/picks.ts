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
    note: "A plantain bowl travels well and reads as a real local special, not a generic stadium item.",
  },
  s2: {
    partner: "G Bar",
    item: "Late-night pizza",
    price: 10.5,
    note: "Pizza fits the no-fryer constraint and gives the left-field concourse a shareable item.",
  },
  s3: {
    partner: "Cake's by Alejandro",
    item: "Family pastry box",
    price: 9.5,
    note: "A dessert box fits the family zone and avoids the bar signal in the top-ranked partner.",
  },
  s4: {
    partner: "Smokey Island Grille",
    item: "Chopped cheese fries",
    price: 9.0,
    note: "A large-group grill item matches the bleachers crowd and the existing fryer setup.",
  },
  s5: {
    partner: "Concourse Jamaican Bakery",
    item: "Beef patty",
    price: 6.5,
    note: "A handheld patty keeps the high-traffic Great Hall moving.",
  },
  s6: {
    partner: "Mofongo El Mocano (Mofongo Tipico)",
    item: "Pernil plate",
    price: 12.5,
    note: "A plated pork dish gives the terrace a sit-down option that still fits oven-only equipment.",
  },
  s7: {
    partner: "Mofongo El Mocano (Mofongo Tipico)",
    item: "Kids rice bowl",
    price: 8.0,
    note: "A smaller rice bowl fits the family zone and the no-alcohol rule.",
  },
  s8: {
    partner: "Concourse Jamaican Bakery",
    item: "Coconut drops",
    price: 6.5,
    note: "A portable dessert gives the post-game exit a low-staffing item.",
  },
};
