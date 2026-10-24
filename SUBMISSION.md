# Concourse: Devpost submission copy

## Elevator pitch

The menu is the last guess. Concourse shows stadium concessionaires which partner restaurants belong in each stand and what the switch is worth in per-cap revenue.

## About the project

### Inspiration

Concession menus are planned by habit. A stadium has eight stands, three dayparts, and a different crowd in each section. The venue already knows who buys tickets and what sells. It does not join that to what those fans actually love. Concourse is the join.

### What it does

The operator picks a stand and a daypart. Concourse uses the team's Qloo brand entity and a section pulse to rank partner restaurants, then runs a deterministic revenue model over units, price, elasticity, and throughput. It shows a conservative, base, and upside per-cap delta, checks the venue's exclusive beverage, family-zone, commissary, equipment, and staffing rules, and exports a vendor brief. A blocked partner is rejected. A switch is recommended only when the base case is positive and a local partner matches the dish; otherwise the app says keep the incumbent. National chains are filtered from the demo candidate set. An optional operator request sends the filtered shortlist to a Nebius-hosted model, which can choose a partner and dish or keep the incumbent; the deterministic check keeps the final veto. The agent trace shows every tool call.

### How we built it

Next.js, React, TypeScript. The Qloo Insights API ranks partner restaurants with explainability. The agent filters national chains, picks the highest-ranked local partner that matches the dish and passes the venue constraints, and declines the switch when the base case loses money or no coherent partner matches. The optional agent review uses Nebius Token Factory with a closed JSON schema, a candidate whitelist, per-instance call caps, and a deterministic fallback. The first load calls the live API; the committed snapshot is the fallback. The revenue model is deterministic and visible in the UI. Twenty-one Vitest tests cover the cap, the lift, the constraint edge cases, category matching, the no-switch decision, the daypart overrides, and the LLM response parser and expiry check. The repo includes the snapshot script and the full source.

### Challenges

The fan-base proxy. Qloo has team brand entities, verified across six mid-market clubs, but the demo does not have real ticket-buyer rows. The app uses the team brand and a section pulse and labels the stand sales as illustrative. The next step is to ingest the venue's aggregate zip-code shares.

The second challenge is the constraint layer. A partner restaurant is not a drop-in menu item. The app flags commissary, exclusivity, equipment, and staffing instead of pretending they do not exist.

### Accomplishments

A working app, a real Qloo call, a per-cap model with a visible range, a genuine agent run log, a constraint layer that rejects blocked partners, a decision layer that declines a losing or incoherent switch, and an optional LLM review that can choose a partner and dish or decline. The trace shows the Qloo query, the chain filter, the chosen partner, the model inputs, the constraint result, the keep-or-switch decision, and the LLM review when it runs. The app does not hardcode the partner names: Qloo ranks them, the dish match filters them, the constraints reject the rest, and the money decides whether to switch.

### What we learned

The money unit changes the product. A menu recommendation is a mood board. A per-cap delta with a range and a constraint list is a decision. The model has to be deterministic and the narrative has to stay out of the numbers.

### What's next for Concourse

Ingest real ticket-buyer zip shares and stand sales. Add a second venue. Expand the partner graph from restaurants to merch and beverage. Keep the model transparent.

## Built with

Qloo Insights API, Qloo Taste Graph, Nebius Token Factory (optional agent review), Next.js, React, TypeScript, Vercel.

## Links

- Live demo: https://concourse-delta.vercel.app/
- Repository: https://github.com/pratham2402/concourse
