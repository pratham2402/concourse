# Concourse

A per-stand concession mix optimizer for stadiums, built for the Qloo Agentic Hackathon.

Live demo: https://concourse-delta.vercel.app/

Concourse tells a concessionaire which partner restaurants and brand partners belong in each stand and daypart, and what the switch is worth in per-cap revenue. It uses the team's Qloo brand entity and a section pulse as the fan signal, then runs a deterministic revenue model over units, price, elasticity, and throughput.

## The problem

Concession assortments are historical and often uniform across a venue. Different stands and dayparts serve different fans. Restaurant partnerships are relationship-driven. The venue already owns the signals that matter, ticket-buyer geography and stand sales, but the demo does not have the raw rows. It uses the team brand and a section pulse as a stand-in, and the brief says so.

## The demo

The demo uses Yankee Stadium, eight stands, and three dayparts. The stand sales and traffic are illustrative. The Qloo partner rankings are real: the app calls the live hackathon API on first load and on **Refresh live**, and falls back to a committed snapshot when it cannot.

The strongest view is one stand where the Qloo pick beats the incumbent on modeled per-cap, with the calculation and the constraints shown.

## How it works

1. The team's Qloo brand entity seeds the fan profile. Each stand adds a section pulse, a few artists or brands that reflect the section.
2. `/v2/insights` ranks partner restaurants by affinity to the team and section seeds, scoped to the venue's locality, with explainability on. The agent filters national chains, picks the highest-ranked local partner that matches the dish and passes the constraints, and declines the switch when the base case loses money or no coherent partner matches.
3. A deterministic model compares the incumbent item with the Qloo pick. It applies units, price, a transparent price elasticity, and the stand's throughput cap. It returns a conservative, base, and upside per-cap delta.
4. The constraint layer checks the venue's exclusive beverage partner, family-zone alcohol rule, commissary approval, equipment, and staffing. A blocked partner is rejected, and a switch that loses money is declined.
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

## Agent review (optional)

The operator request card is optional. It sends the filtered Qloo shortlist to a Nebius Token Factory model, which can choose a partner and dish or keep the incumbent. The deterministic check keeps the final veto. Stand and daypart clicks never call the model; only the **Run agent** button does.

Set these in `.env.local` for local work and in Vercel Project Settings, Environment Variables for Production and Preview:

- `NEBIUS_API_KEY`: server-side only.
- `LLM_ENABLED=true`: turns the card on. The default is off.
- `LLM_MODEL`: a text-to-text model with a public endpoint in your Nebius project. The default is `nvidia/nemotron-3-super-120b-a12b`, the reasoning model the earlier Nebius x NVIDIA project used on this account. The faster alternative is `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B`. A model marked **Public endpoint: Not available** requires a dedicated endpoint and will return 403 on the shared API. Copy the exact ID from a model page that says **Public endpoint: Available**.
- `LLM_DISABLE_AFTER`: default `2026-11-06T00:00:00Z`. After this date the card says the agent is offline.
- `LLM_TOTAL_CALL_LIMIT`: default 200 calls per server instance.
- `LLM_DAILY_CALL_LIMIT`: default 50 calls per instance.
- `LLM_PER_IP_HOURLY_LIMIT`: default 6.
- `LLM_MAX_TOKENS`: default 2500. The default model is a reasoning model, so it needs headroom for the answer.
- `LLM_TIMEOUT_MS`: default 20000.

The call limits are in-memory per server instance, so they are a guard, not a global ledger. Keep the Nebius prepaid balance at the amount you are willing to spend, turn off auto-top-up, and revoke the key after judging. To stop the agent immediately, set `LLM_ENABLED=false` or remove the key; the app falls back to the deterministic decision.

## Tests

```bash
npm test
```

Twenty-one tests cover the throughput cap, the cost ratio, the Qloo rank and popularity lift, the family-zone block, the substring edge case, category matching, the national-chain filter, the no-switch decision, the capacity note, partner selection, the daypart overrides, and the LLM response parser and expiry check.

## Deploy

1. Import https://github.com/pratham2402/concourse at https://vercel.com/new.
2. Add `QLOO_API_KEY` to Production, Preview, and Development. The key is server-side only.
3. For the optional agent review, add the Nebius variables from the section above and redeploy.
4. Deploy. The first load calls the live Qloo API; without a key the app uses the committed snapshot.

## Project structure

```text
app/
  page.tsx                 Main dashboard
  api/optimize/route.ts    Single-stand recommendation
  api/overview/route.ts    Stand deltas for the map
  api/agent/route.ts       Optional LLM review of the shortlist
  globals.css
components/
  AgentRequest.tsx         Operator request card
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
  presets.ts               Operator request presets
  llm.ts                   Nebius client, limits, validation
tests/
  model.test.ts            Revenue model and constraint tests
  llm.test.ts              LLM parser and expiry tests
scripts/
  snapshot.mjs             Refresh the cached partner rankings
  shot.mjs                 Screenshot helper
  interact.mjs             Live-button test helper
```

## License

MIT. See [LICENSE](LICENSE).
