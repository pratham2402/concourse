# Concourse

A per-stand concession mix optimizer for stadiums, built for the Qloo Agentic Hackathon.

Concourse tells a concessionaire which local restaurant and brand partners belong in each stand and daypart, and what the switch is worth in per-cap revenue. It uses the team's Qloo brand entity and a section pulse as the fan signal, then runs a deterministic revenue model over units, price, elasticity, and throughput.

## The problem

Concession assortments are historical and often uniform across a venue. Different stands and dayparts serve different fans. Local restaurant partnerships are relationship-driven. The venue already owns the signals that matter, ticket-buyer geography and stand sales, but the demo does not have the raw rows. It uses the team brand and a section pulse as a stand-in, and the brief says so.

## The demo

The demo uses Yankee Stadium, eight stands, and three dayparts. The stand sales and traffic are illustrative. The Qloo partner rankings are real: the app calls the live hackathon API on first load and on **Refresh live**, and falls back to a committed snapshot when it cannot.

The strongest view is one stand where the Qloo pick beats the incumbent on modeled per-cap, with the calculation and the constraints shown.

## How it works

1. The team's Qloo brand entity seeds the fan profile. Each stand adds a section pulse, a few artists or brands that reflect the section.
2. `/v2/insights` ranks local restaurants by affinity to the team and section seeds, scoped to the venue's locality, with explainability on. The agent picks the highest-ranked partner that matches the stand's menu category and passes the constraints.
3. A deterministic model compares the incumbent item with the Qloo pick. It applies units, price, a transparent price elasticity, and the stand's throughput cap. It returns a conservative, base, and upside per-cap delta.
4. The constraint layer checks the venue's exclusive beverage partner, family-zone alcohol rule, commissary approval, equipment, and staffing. A blocked partner is rejected.
5. The agent narrates the result from the model outputs. The deterministic model sets the number.

Qloo endpoints used:

- `/search` for entity resolution during development.
- `/v2/insights` with `filter.type=urn:entity:place`, `filter.tags=urn:tag:genre:place:restaurant`, `signal.interests.entities`, `filter.location.query`, and `feature.explainability=true`.

## Data and model notes

- Stand sales, traffic, menu costs, and daypart splits are illustrative.
- The partner snapshot in `data/qloo-snapshot.json` is committed so the demo works without a key. It contains no credentials.
- The live API key is server-side only. The client never sees it.
- The model is a decision aid, not a guarantee. The app shows the assumptions and a range.
- The demo uses the team brand and a section pulse. A production deployment would add the venue's aggregate zip-code shares. The app does not model individuals.

## Run locally

```bash
npm install
cp .env.example .env.local
# add your Qloo hackathon key to .env.local
npm run dev
```

Open `http://localhost:3000`.

Without a key, the app still works from the committed snapshot. The **Refresh live** button will report that live Qloo is unavailable.

To refresh the committed snapshot:

```bash
set -a; . .env.local; set +a
node scripts/snapshot.mjs
```

## Tests

```bash
npm test
```

Eleven tests cover the throughput cap, the cost ratio, the Qloo rank and popularity lift, the family-zone block, the substring edge case, category matching, partner selection, and the daypart overrides.

## Deploy

1. Import https://github.com/pratham2402/concourse at https://vercel.com/new.
2. Add `QLOO_API_KEY` to Production, Preview, and Development. The key is server-side only.
3. Deploy. The first load calls the live Qloo API; without a key the app uses the committed snapshot.

## Project structure

```text
app/
  page.tsx                 Main dashboard
  api/optimize/route.ts    Single-stand recommendation
  api/overview/route.ts    Stand deltas for the map
  globals.css
components/
  ConcourseMap.tsx
  StandPanel.tsx
  AgentTrace.tsx
data/
  venue.ts                 Demo venue, stands, constraints
  picks.ts                 Curated menu ideas paired to Qloo partners
  qloo-snapshot.json       Cached partner rankings
lib/
  qloo.ts                  Qloo API client
  model.ts                 Revenue model and constraint check
  recommend.ts             Recommendation assembly
tests/
  model.test.ts            Revenue model and constraint tests
scripts/
  snapshot.mjs             Refresh the cached partner rankings
  shot.mjs                 Screenshot helper
  interact.mjs             Live-button test helper
```

## License

MIT. See [LICENSE](LICENSE).
