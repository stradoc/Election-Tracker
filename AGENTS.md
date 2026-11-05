# AGENTS.md: working guide for TippingPoint

**Read and follow [`RULES.md`](RULES.md) first.** This file explains how the project fits
together and gives step-by-step recipes for extending it. [`CHANGELOG.md`](CHANGELOG.md) says
what was done most recently and what to pick up next. Start there if you are continuing work.

## What this is

TippingPoint is an election tracker: a map-first site with NYT-style data depth. Phase 1
(done) covers presidential results for 2016, 2020 and 2024, by state and county, with:

- a uniform-swing "what if" slider
- the tipping-point state outlined on the map

The full roadmap (swing, turnout, demographics, polling, "if only group X voted", then
Congress, governors, money, state legislatures and live data) is in
[Roadmap](#roadmap) below.

## Quick start

```sh
npm install          # all workspaces; npm's cache stays in ./.npm-cache (see .npmrc)
npm run data         # pipeline: download → normalize → check → write data/processed
npm run dev          # API on :8787 + web on :5173 (Vite proxies /api)
npm test             # Vitest, all workspaces
npm run typecheck    # tsc for every workspace
npm run lint         # ESLint
npm run format       # Prettier
```

The MEDSL **county** file sits behind a Dataverse guestbook form, so it must be downloaded
once by hand. `npm run data` prints the exact steps and where to save it. Until then the
site shows states only, and opening a state says county results haven't been generated.

## Repo map

```
RULES.md  AGENTS.md  CLAUDE.md (imports both)  CHANGELOG.md  README.md
packages/shared/          @tippingpoint/shared: used by every other workspace
  data/*.json             reference tables (EV apportionment, elections, no-county states)
  src/schema.ts           PlaceResult, ResultsDataset, Manifest: the shapes every layer uses
  src/registry.ts         ELECTIONS (from data/elections.json), DATASETS
  src/sources.ts          SOURCES: every upstream dataset, pinned version, license
  src/fips.ts             states by FIPS / postal; NO_COUNTY_LAYER
  src/ev-tables.ts        electoral votes per year (from data/apportionment.json)
  src/margins.ts          margin convention, formatMargin ("D+3.2")
  src/swing.ts            applyUniformSwing
  src/electoral.ts        electoralTotals, winnerOf, tippingPoint
  src/scenario.ts         computeScenario: the ONLY way views get adjusted numbers
  src/dev-config.ts       DEFAULT_API_PORT (server + Vite proxy)
scripts/data/             @tippingpoint/data: the pipeline (`npm run data`)
  src/run.ts              CLI; runs every stage for every registered election
  src/paths.ts            data/raw/<source>/ and data/processed/ locations
  src/sources/            stage 1: fetch only (dataverse.ts; ev-districts.ts + .json curated)
  src/normalize/          stage 2: raw → PlaceResult (president.ts; county-fips-fixes.json)
  src/join.ts             stage 3: coverage checks (results ↔ map shapes ↔ state totals)
  src/emit.ts             stage 5: write JSON + manifest.json + coverage.json
apps/server/              @tippingpoint/server: Fastify API
  src/routes/dataset.ts   GET /api/elections, GET /api/:year/:office/:dataset[/:stateFips]
  src/providers/          ResultsProvider interface; StaticProvider (data/processed)
apps/web/                 @tippingpoint/web: React 18 + Vite + plain CSS + D3
  src/pages/ElectionPage.tsx   wires URL → data → computeScenario → views
  src/map/                UsMap (one map for nation/state/county), useMapZoom, geometry,
                          HoverCard, marginBins (+ margin-bins.json, bins.css)
  src/components/         EvBar, SwingSlider, TippingPointNote, DistrictTiles, Legend,
                          ResultsTable, SegmentedControl
  src/styles/tokens.css   every colour/type/motion value, light + dark
  src/data/api.ts         the only place the web app fetches
data/raw, data/processed  generated, gitignored (third-party data is never committed)
```

## How data flows

```
SOURCES (shared) ──► sources/ fetch ──► data/raw/<id>/
                     normalize/      ──► PlaceResult[]  (one shape for every level)
                     join.ts         ──► coverage.json  (unmatched FIPS, sum mismatches)
                     [derive/]       ──► Phase 2: swing, turnout, group estimates, polls
                     emit.ts         ──► data/processed/<year>/<office>/results[/<fips>].json
StaticProvider ──► Fastify /api ──► web useResults() ──► computeScenario(places, scenario)
                                                       ──► UsMap, EvBar, tables, tiles
```

Key conventions:

- **Geographic key.**
  - State: 2-digit FIPS (`"42"`).
  - County: 5-digit FIPS (`"42003"`).
  - ME/NE district: `"23-2"`.
  - Results, us-atlas shapes and (Phase 2) ACS demographics all join on these keys.
- **Margin.** Margin = (dem − rep) / total votes, as a fraction. Positive = Democratic.
  The UI works in points; it converts once in ElectionPage.
- **One scenario engine.** Swing (and later "only group X voted") are fields on `Scenario`,
  applied in `computeScenario`. Views never adjust numbers themselves.
- **URL is state.** `/2024/president/pa?swing=-2.5`. The back button zooms out, and every view
  is a shareable link.
- **Colours.**
  - Margins become a `data-bin` attribute via `marginBin()`.
  - `bins.css` maps the bin to `--bin-fill`, and `tokens.css` sets the per-theme values.
  - The palette was checked with the dataviz validator; the notes are in `tokens.css`.
    Re-validate if you change it.

## Code conventions (and why)

- **Node runs TypeScript directly** (built-in type stripping, Node ≥ 22.18). There is no
  tsx or ts-node. This means:
  - Only erasable syntax: no `enum`, `namespace` or constructor parameter properties.
  - Relative imports include `.ts`.
  - JSON imports use `with { type: 'json' }`.
- **A TypeScript-patterns hook runs on every Write/Edit** (an editor plugin). It rejects:
  - magic numbers: use a named `const`, or put tables in JSON
  - raw `for`/`while` loops: use map/filter/reduce/forEach
  - nested ternaries
  - `.then()`: use `await`
  - regexes without a comment above them that quotes a match and a non-match

  That's why reference data lives in JSON and tests are table-driven.

- **Tests are table-driven.** `foo.test.ts` reads its cases from `foo.test.json`. Data-backed
  tests skip themselves until `npm run data` has produced `data/processed`.
- **npm side effects stay in the repo.** `.npmrc` sets `cache=.npm-cache`. Temporary files go
  in `.tmp/`. For headless Chrome screenshots, set `HOME`, `XDG_CONFIG_HOME` and
  `XDG_CACHE_HOME` to `.tmp/chrome-home` and `--user-data-dir=.tmp/chrome-profile`.
- **Dependency override.** Root `package.json` overrides `minimatch` to `^11.0.1`, because the
  lint tooling's pinned 10.x has a DoS advisory (GHSA-g3hv-75wg-m249). Remove the override
  once eslint/typescript-eslint ship with 11.x.

## Recipes

### Add a presidential year (e.g. 2028)

1. `packages/shared/data/elections.json`: add `{ "year": 2028, "dem": …, "rep": … }`.
2. `packages/shared/data/apportionment.json`: check that a row covers 2028. The 2020
   census row covers 2024–2028, and 2032 needs the 2030 census.
3. `scripts/data/src/sources/ev-districts.json`: add certified ME/NE district results, with
   sources. Check the district sums against the statewide totals.
4. `packages/shared/src/sources.ts`: bump the MEDSL `version` once MEDSL publishes the year.
   Re-download by deleting the old file in `data/raw/<id>/`.
5. `npm run data` and read the coverage table. Then add the known outcome to
   `scripts/data/src/pipeline.test.json` and run `npm test`.

### Add a data source

1. Add it to `SOURCES` in `packages/shared/src/sources.ts`: title, publisher, url, license,
   and the pinned version. The page's Sources list picks it up automatically.
2. `scripts/data/src/sources/<id>.ts`: fetch into `rawDirFor(id)` only, with no parsing. Reuse
   `fetchDataverseFile` for Dataverse.
3. `scripts/data/src/normalize/<id>.ts`: convert raw rows into a shared schema type. Add the
   type to `schema.ts` if it's new (Phase 2: `GeoProfile`, `Turnout`, `GroupEstimate`,
   `PollAverage`).
4. Wire it into `run.ts`. Extend `join.ts` so unmatched ids are reported, and `emit.ts` to
   write it.
5. Add table-driven tests with a small JSON fixture.

### Add a dataset the API serves (Phase 2 analysis data)

1. Add its id to `DATASETS` in `packages/shared/src/registry.ts`. The server route accepts
   it automatically.
2. Emit `data/processed/<year>/<office>/<dataset>[/<fips>].json` from the pipeline.
3. Web: fetch it through a hook in `src/data/api.ts`, mirroring `useResults`.

### Add a what-if control

1. Add a field to `Scenario` in `packages/shared/src/scenario.ts` and handle it inside
   `computeScenario`. Update `ACTUAL_RESULTS` and `isActual`.
2. Add the control to the page. Put its value in the URL search params, as `swing` is.
3. Add cases to `packages/shared/src/shared.test.json`.

### Add an office (Phase 3: Senate, House, governor)

`Office` already lists every office. You will need:

- registry rows for the office
- a normalizer for its MEDSL file
- seat thresholds (51 / 218) for the bar
- an office `SegmentedControl` on the page

`EvBar` is presidential: add a seat bar alongside it rather than branching inside it.

## Roadmap

Phase 2 (next, the priority) is NYT-depth analysis for presidential 2016–2024. Each item
is one module:

- **Swing** (places):
  - county shift arrows between two cycles, and a state swing ranking
  - swing by county type (ACS % college, % Hispanic, density)
- **Turnout:**
  - state VEP turnout (UF Election Lab) and county turnout (votes ÷ ACS CVAP)
  - turnout by group from CPS (people)
- **Demographics** (places): a county profile next to the results, and scatters. Show the
  ecological-fallacy note.
- **Polling:** final 538 average vs. result, as polling error by state
  (`fivethirtyeight/data/polls`).
- **If only X voted** (people): CES validated voters, partial pooling, calibrated to actual
  results, as a new `Scenario` field.
- Every analysis module declares its evidence type (places or people) and shows a shared
  evidence badge.

Later phases: 3. Congress + governor 4. Money (FEC) 5. State legislatures 6. Live data (a `ResultsProvider` for AP/DDHQ) 7. Optional precinct layer 8. Candidate pages and compass
