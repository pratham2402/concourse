# Concourse

### A per-stand concession mix optimizer for stadiums

Qloo Agentic Hackathon, deadline 30 October 2026.

## One line

Concourse tells a stadium concessionaire which local restaurant and brand partners belong in each stand and daypart, and what the mix change is worth in per-cap revenue.

## The buyer

A concessionaire such as Levy, Delaware North, or Aramark, or a club's F&B director. They run many stands under national contracts, equipment limits, commissary rules, and throughput constraints. The pain is per-cap spend and stand-level mix, not a lack of menu ideas.

## The problem

Concession assortments are historical and often uniform across a venue. Different stands and dayparts serve different fans. Local restaurant partnerships are relationship-driven. The venue already owns the two signals that matter: ticket-buyer geography and stand-level sales. Neither is joined to cultural taste.

## What it does

1. The concessionaire selects a venue, its stands, and a daypart.
2. In production, the app reads the venue's ticket-buyer zip codes and stand sales. The demo uses the team brand and a section pulse as a stand-in, and labels the stand sales as illustrative. Zip codes are mapped to Qloo locality affinities, not to individuals.
3. The team's Qloo brand entity seeds the fan taste profile. A stand can add a short section pulse (a few artists or brands) to sharpen its profile.
4. Qloo ranks local restaurants and brands by affinity to that section's taste, inside the venue's neighborhood.
5. A deterministic revenue model compares the incumbent item with the Qloo pick: units, price, margin, throughput cap, and daypart traffic. It produces a conservative, base, and upside per-cap delta. The language model explains the result; it never sets a number.
6. The app respects contract constraints: exclusive beverage partners, commissary eligibility, equipment, and stand throughput. A recommendation that breaks a constraint is rejected or flagged.
7. The operator sees a concourse map, a stand detail, a switch case, and a vendor brief.

## Why Qloo

A generic model would recommend the same stadium food everywhere. Qloo finds the local partners that over-index with the people who actually buy tickets for that section and that daypart. The team brand entity is a real fan-base signal, not a metro proxy. The local restaurant and brand data is native to Qloo.

## What we verified with the live API

- Qloo resolves team brand entities, including mid-market clubs.
- Six mid-market clubs tested: Cleveland Guardians, Milwaukee Brewers, Portland Trail Blazers, Real Salt Lake, Norwich City, Austin FC. All six returned local restaurant matches in their cities.
- The Yankees brand entity returned local Bronx restaurants and sports retail brands (LIDS, Air Jordan, 47, MLB, Foot Locker).
- The neighborhood "Concourse" resolved to Concourse Village with coordinates.
- Different artist seeds produced different restaurant rankings in the same neighborhood, so section-level profiles can be distinguished.
- Explainability returns the seed entity's effect on the top results.

## The demo

A Yankee Stadium concourse map with eight stands. The operator toggles pre-game, halftime, and post-game. Each stand shows its current mix, the recommended local partner, the projected per-cap delta, the constraints respected, and the Qloo evidence.

The strongest moment is one stand where the Qloo pick beats the incumbent on projected per-cap, with the calculation shown.

## Business model

SaaS per venue and season, plus a local partner marketplace fee. The buyer already spends on commissary, labor, and equipment; the product sells a measured mix change, not a menu PDF.

## Scope for the six days

- One demo venue, eight stands, three dayparts.
- Ticket-buyer zip profiles and stand sales are illustrative and labeled as such.
- Live Qloo calls for team brands, local restaurants, local brands, and explainability, with server-side caching.
- Deterministic revenue model with visible assumptions and a range.
- Concourse map, stand detail, switch case, vendor brief.
- Public repo with an MIT license, live deployment, and a text description.

Out of scope: real POS integration, contract ingestion, payments, multi-venue accounts.

## Risks and mitigations

- **National contracts and equipment.** The constraint panel is part of the model, not an afterthought. A recommendation that breaks exclusivity is rejected.
- **Ticket data privacy.** The production design uses aggregate zip-code shares and never models individuals. The demo uses the team brand and a section pulse.
- **Projection accuracy.** The model shows a range and the assumptions. It is a decision aid, not a guarantee. The demo labels sales data as illustrative.
- **Mid-market data.** Six clubs were tested successfully. If a venue's team brand is missing, the app falls back to the venue's locality plus a short section pulse.
- **Crowded gallery.** TasteShift stocks a generic event crowd; Carte Locale plans one shop's week. Neither does a multi-stand venue with dayparts, ticket geography, and a per-stand revenue case. Lead with that difference.

## Go/no-go

Build. The data path is verified. The only remaining risk is the revenue model's assumptions, which are visible and adjustable.

## Judge fit

- **Technological Implementation:** team brand entity, locality affinities, place and brand tags, explainability, deterministic model.
- **Design:** a physical concourse map and a clear switch case.
- **Potential Impact:** per-cap revenue for a buyer with real budget.
- **Quality of Idea:** a venue-operations use of Qloo that is not another planner.
