# Concourse: Devpost submission copy

## Elevator pitch

The menu is the last guess. Concourse shows stadium concessionaires which partner restaurants belong in each stand and what the switch is worth in per-cap revenue.

## About the project

### Inspiration

Concession menus are planned by habit. A stadium has eight stands, three dayparts, and a different crowd in each section. The venue knows who buys tickets and what sells, but it does not connect that to what those fans actually love. I built Concourse to make that connection.

### What it does

The operator picks a stand and a daypart. Concourse uses the team's Qloo brand entity and a section pulse to rank partner restaurants, then runs a deterministic revenue model over units, price, elasticity, and throughput. It shows a conservative, base, and upside per-cap delta, checks the venue's exclusive beverage, family-zone, commissary, equipment, and staffing rules, and exports a vendor brief. A blocked partner is rejected. A switch is recommended only when the base case is positive and a local partner matches the dish; otherwise the app says keep the incumbent. National chains are filtered from the demo candidate set. An optional operator request sends the filtered shortlist to a Nebius-hosted model, which can choose a partner and dish or keep the incumbent; the deterministic check keeps the final veto. The trace shows every pipeline step, including the agent review.

### How I built it

I built the app with Next.js, React, and TypeScript. The Qloo Insights API ranks partner restaurants with explainability. A deterministic shortlist filters national chains and drops partners that fail the venue rules, then the model prices the switch. An optional agent review uses Nebius Token Factory with a prompt-enforced JSON contract, a candidate whitelist, validation, per-instance call caps, and a deterministic fallback. The agent can switch partner and dish or keep the incumbent, and a deterministic check keeps the final veto. The selected stand calls the live API on load and on selection; the map overview is a snapshot, and the committed snapshot is the fallback. The revenue model is deterministic and visible in the UI. The Vitest suite covers the cap, the lift, the constraint edge cases, category matching, the no-switch decision, the daypart overrides, the agent trace and veto path, the retry, and the LLM response parser and expiry check. The repo includes the snapshot script and the full source.

### Challenges

The fan-base proxy. Qloo has team brand entities, verified across six mid-market clubs, but I did not have real ticket-buyer rows. The app uses the team brand and a section pulse and labels the stand sales as illustrative. The next step is to ingest the venue's aggregate zip-code shares.

The second challenge was the constraint layer. A partner restaurant is not a drop-in menu item. The app flags commissary, exclusivity, equipment, and staffing instead of pretending they do not exist.

### Accomplishments

I shipped the app, the live Qloo call, and the per-cap model with a visible range. The constraint layer rejects blocked partners, and the decision layer declines switches that lose money. The optional LLM review can choose a partner and dish or keep the incumbent, and the trace records each step. Partner names are not hardcoded. They come from Qloo, get narrowed by the dish match and the venue rules, and the model decides whether the switch is worth it.

### What I learned

I started with a menu recommendation, which was easy to argue about and hard to budget. The per-cap delta gave the operator a number to check, and the constraint list showed what the number would cost. That is why the model stays deterministic and the LLM only reviews the shortlist.

### What's next for Concourse

Next I want real ticket-buyer zip shares and stand sales, then a second venue. After that, the partner graph can expand from restaurants to merch and beverage.

## Built with

Qloo Insights API, Qloo Taste Graph, Nebius Token Factory (optional agent review), Next.js, React, TypeScript, Vercel.

## Links

- Live demo: https://concourse-delta.vercel.app/
- Repository: https://github.com/pratham2402/concourse
